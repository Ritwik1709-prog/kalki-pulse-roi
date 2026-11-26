"""XGBoost-to-ONNX Training, Parity Benchmarking & SHAP Explainability Pipeline."""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import onnx
import onnxruntime as ort
import pandas as pd
import shap
from onnxmltools import convert_xgboost
from onnxmltools.convert.common.data_types import FloatTensorType
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

ROOT_DIR = Path(__file__).resolve().parents[2]
PROCESSED_DIR = ROOT_DIR / "data_science" / "data" / "processed"
MODELS_DIR = ROOT_DIR / "data_science" / "models"
UNIFIED_PATH = PROCESSED_DIR / "unified_training_data.parquet"
CLEANING_REPORT_PATH = PROCESSED_DIR / "cleaning_report.json"

CAT_COLS = ["source_platform", "campaign_type", "channel_used", "category"]
NUM_COLS = ["duration_days", "impressions", "campaign_cost", "engagement_score"]
FEATURE_NAMES = [
    "source_platform_idx",
    "campaign_type_idx",
    "channel_used_idx",
    "category_idx",
    "duration_days",
    "impressions",
    "campaign_cost",
    "engagement_score",
]


def encode_features(df: pd.DataFrame) -> tuple[np.ndarray, dict[str, dict[str, int]]]:
    """Encode categorical + numerical columns into pure float32 numpy ndarray."""
    encodings: dict[str, dict[str, int]] = {}
    encoded_cols: list[np.ndarray] = []

    for col in CAT_COLS:
        vals = df[col].astype(str).fillna("unknown")
        unique_vals = sorted(vals.unique().tolist())
        mapping = {v: i for i, v in enumerate(unique_vals)}
        encodings[col] = mapping
        encoded_cols.append(vals.map(mapping).fillna(0).to_numpy(dtype=np.float32))

    for col in NUM_COLS:
        encoded_cols.append(pd.to_numeric(df[col], errors="coerce").fillna(0.0).to_numpy(dtype=np.float32))

    X = np.column_stack(encoded_cols).astype(np.float32)
    return X, encodings


def train_and_export_target(
    name: str,
    onnx_filename: str,
    X_train: np.ndarray,
    X_test: np.ndarray,
    y_train: np.ndarray,
    y_test: np.ndarray,
) -> tuple[XGBRegressor, dict[str, Any]]:
    """Train single-target XGBRegressor on float32 ndarray, convert to ONNX, verify parity & latency."""
    model = XGBRegressor(
        n_estimators=180,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        tree_method="hist",
        n_jobs=-1,
        random_state=42,
    )
    model.fit(X_train, y_train)

    xgb_preds = model.predict(X_test).astype(np.float32)
    r2 = float(r2_score(y_test, xgb_preds))
    mae = float(mean_absolute_error(y_test, xgb_preds))
    rmse = float(np.sqrt(mean_squared_error(y_test, xgb_preds)))

    # Convert to ONNX using anonymous float_input tensor (opset 12)
    initial_type = [("float_input", FloatTensorType([None, X_train.shape[1]]))]
    onnx_model = convert_xgboost(model, initial_types=initial_type, target_opset=12)
    onnx.checker.check_model(onnx_model)

    onnx_path = MODELS_DIR / onnx_filename
    onnx.save_model(onnx_model, str(onnx_path))

    # Load into ONNX Runtime CPUExecutionProvider and verify parity
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    input_name = sess.get_inputs()[0].name
    ort_preds = sess.run(None, {input_name: X_test})[0].reshape(-1).astype(np.float32)

    max_abs_diff = float(np.max(np.abs(xgb_preds - ort_preds)))
    mean_abs_diff = float(np.mean(np.abs(xgb_preds - ort_preds)))

    # Benchmark single-row inference latency across 1,000 runs
    single_row = X_test[:1].copy()
    for _ in range(25):  # warmup
        sess.run(None, {input_name: single_row})

    latencies_ms: list[float] = []
    for _ in range(1000):
        t0 = time.perf_counter()
        sess.run(None, {input_name: single_row})
        latencies_ms.append((time.perf_counter() - t0) * 1000.0)

    lat_arr = np.array(latencies_ms, dtype=np.float64)
    metrics = {
        "model_file": onnx_filename,
        "test_r2": round(r2, 4),
        "test_mae": round(mae, 4),
        "test_rmse": round(rmse, 4),
        "parity_max_abs_diff": round(max_abs_diff, 6),
        "parity_mean_abs_diff": round(mean_abs_diff, 6),
        "onnx_latency_mean_ms": round(float(np.mean(lat_arr)), 4),
        "onnx_latency_p95_ms": round(float(np.percentile(lat_arr, 95)), 4),
        "onnx_latency_p99_ms": round(float(np.percentile(lat_arr, 99)), 4),
        "sub_5ms_verified": bool(float(np.percentile(lat_arr, 99)) < 5.0),
        "onnx_size_kb": round(onnx_path.stat().st_size / 1024.0, 1),
    }

    print(
        f"[{name}] R2={metrics['test_r2']} | MAE={metrics['test_mae']} | "
        f"MaxDiff={metrics['parity_max_abs_diff']} | "
        f"Latency(mean={metrics['onnx_latency_mean_ms']}ms, p99={metrics['onnx_latency_p99_ms']}ms)"
    )
    return model, metrics


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    df = pd.read_parquet(UNIFIED_PATH)
    print(f"[TRAIN] Loaded {len(df):,} rows from {UNIFIED_PATH}")

    X, encodings = encode_features(df)
    y_ctr = df["ctr"].to_numpy(dtype=np.float32)
    y_conv = df["conversion_rate"].to_numpy(dtype=np.float32)
    y_roi = df["net_roi_pct"].to_numpy(dtype=np.float32)

    indices = np.arange(len(df))
    train_idx, test_idx = train_test_split(indices, test_size=0.2, random_state=42)

    X_train, X_test = X[train_idx], X[test_idx]

    _, ctr_metrics = train_and_export_target(
        "ctr_model", "ctr_model.onnx", X_train, X_test, y_ctr[train_idx], y_ctr[test_idx]
    )
    _, conv_metrics = train_and_export_target(
        "conversion_model", "conversion_model.onnx", X_train, X_test, y_conv[train_idx], y_conv[test_idx]
    )
    roi_model, roi_metrics = train_and_export_target(
        "roi_model", "roi_model.onnx", X_train, X_test, y_roi[train_idx], y_roi[test_idx]
    )

    # SHAP global feature importance on held-out test sample (ROI model)
    print("[SHAP] Computing TreeExplainer importances on 2,000 test rows...")
    shap_sample = X_test[:2000]
    explainer = shap.TreeExplainer(roi_model)
    shap_values = explainer.shap_values(shap_sample)
    mean_abs_shap = np.mean(np.abs(shap_values), axis=0)
    total_shap = float(np.sum(mean_abs_shap)) or 1.0

    human_labels = {
        "source_platform_idx": "Marketplace Platform",
        "campaign_type_idx": "Campaign Format",
        "channel_used_idx": "Distribution Channel",
        "category_idx": "Beauty / Product Category",
        "duration_days": "Campaign Duration (Days)",
        "impressions": "Reach / Impressions Volume",
        "campaign_cost": "Allocated Campaign Budget",
        "engagement_score": "Engagement Velocity Score",
    }

    shap_drivers = []
    for fname, val in sorted(zip(FEATURE_NAMES, mean_abs_shap), key=lambda x: x[1], reverse=True):
        pct = (float(val) / total_shap) * 100.0
        shap_drivers.append(
            {
                "feature": fname,
                "label": human_labels.get(fname, fname),
                "mean_abs_shap": round(float(val), 4),
                "importance_pct": round(pct, 1),
            }
        )

    # Pull channel multipliers from cleaning report if available
    channel_multipliers = {"nykaa": 1.02, "tira": 1.01, "purplle": 0.97}
    if CLEANING_REPORT_PATH.exists():
        with open(CLEANING_REPORT_PATH, "r", encoding="utf-8") as f:
            creport = json.load(f)
        for ch in creport.get("channel_comparison", []):
            channel_multipliers[ch["key"]] = ch.get("calibration_multiplier", 1.0)

    feature_schema = {
        "feature_names": FEATURE_NAMES,
        "categorical_columns": CAT_COLS,
        "numeric_columns": NUM_COLS,
        "encodings": encodings,
        "channel_multipliers": channel_multipliers,
        "targets": {
            "ctr_model": "ctr (decimal 0..1)",
            "conversion_model": "conversion_rate (decimal 0..1)",
            "roi_model": "net_roi_pct (percentage)",
        },
    }
    schema_path = MODELS_DIR / "feature_schema.json"
    with open(schema_path, "w", encoding="utf-8") as f:
        json.dump(feature_schema, f, indent=2)

    model_metrics = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "models": {
            "ctr": ctr_metrics,
            "conversion": conv_metrics,
            "roi": roi_metrics,
        },
        "shap_importances": shap_drivers,
    }
    metrics_path = MODELS_DIR / "model_metrics.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(model_metrics, f, indent=2)

    print(f"[EXPORT] Saved schema -> {schema_path}")
    print(f"[EXPORT] Saved metrics -> {metrics_path}")


if __name__ == "__main__":
    main()
