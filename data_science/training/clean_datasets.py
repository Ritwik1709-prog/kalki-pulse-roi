"""Auditable 6-Stage Data Cleaning & Calibration Pipeline for KALKI Pulse.

Processes all 5 datasets (Nykaa, Purplle, Tira, Influencer ROI, Marketing Campaign),
extracting from zip archives if raw CSVs are missing, and writes cleaned Parquet files
plus a comprehensive JSON-safe `cleaning_report.json`.
"""

from __future__ import annotations

import json
import math
import os
import re
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[2]
RAW_HIST_DIR = ROOT_DIR / "data_science" / "data" / "raw" / "historical"
RAW_PROTO_DIR = ROOT_DIR / "data_science" / "data" / "raw" / "prototype"
ARCHIVE_DIR = ROOT_DIR / "data_science" / "data" / "archives"
SCHEMA_DIR = ROOT_DIR / "data_pipeline" / "schemas"
PROCESSED_DIR = ROOT_DIR / "data_science" / "data" / "processed"

DATASET_SPECS = [
    {
        "key": "nykaa",
        "label": "Nykaa Campaign Data",
        "path": RAW_HIST_DIR / "nykaa_campaign_data.csv",
        "parquet": PROCESSED_DIR / "nykaa_clean.parquet",
        "kind": "beauty_historical",
    },
    {
        "key": "purplle",
        "label": "Purplle Campaign Data",
        "path": RAW_HIST_DIR / "purplle_campaign_data.csv",
        "parquet": PROCESSED_DIR / "purplle_clean.parquet",
        "kind": "beauty_historical",
    },
    {
        "key": "tira",
        "label": "Tira Campaign Data",
        "path": RAW_HIST_DIR / "tira_campaign_data.csv",
        "parquet": PROCESSED_DIR / "tira_clean.parquet",
        "kind": "beauty_historical",
    },
    {
        "key": "influencer_roi",
        "label": "Influencer Marketing ROI",
        "path": RAW_PROTO_DIR / "influencer_marketing_roi_dataset.csv",
        "parquet": PROCESSED_DIR / "influencer_roi_clean.parquet",
        "kind": "influencer_proto",
    },
    {
        "key": "marketing_campaign",
        "label": "Marketing Campaign Dataset",
        "path": RAW_PROTO_DIR / "marketing_campaign_dataset.csv",
        "parquet": PROCESSED_DIR / "marketing_campaign_clean.parquet",
        "kind": "marketing_proto",
    },
]

UNIFIED_COLUMNS = [
    "campaign_id",
    "source_platform",
    "campaign_type",
    "channel_used",
    "category",
    "target_audience",
    "duration_days",
    "impressions",
    "clicks",
    "conversions",
    "campaign_cost",
    "revenue",
    "engagement_score",
    "ctr",
    "conversion_rate",
    "cpc",
    "revenue_per_rupee",
    "net_roi_pct",
]


def ensure_raw_extracted() -> None:
    """Auto-extract archives from data_science/data/archives if raw CSVs are missing."""
    all_present = all(spec["path"].exists() for spec in DATASET_SPECS)
    if all_present or not ARCHIVE_DIR.exists():
        return

    RAW_HIST_DIR.mkdir(parents=True, exist_ok=True)
    RAW_PROTO_DIR.mkdir(parents=True, exist_ok=True)
    SCHEMA_DIR.mkdir(parents=True, exist_ok=True)

    for zpath in ARCHIVE_DIR.glob("*.zip"):
        with zipfile.ZipFile(zpath, "r") as zf:
            for member in zf.infolist():
                if member.is_dir() or "__MACOSX" in member.filename:
                    continue
                base = os.path.basename(member.filename)
                if not base:
                    continue
                lower = base.lower()
                if any(k in lower for k in ("nykaa", "purplle", "tira")) and lower.endswith(".csv"):
                    dest = RAW_HIST_DIR / base
                elif lower.endswith(".csv"):
                    dest = RAW_PROTO_DIR / base
                else:
                    dest = SCHEMA_DIR / base
                with zf.open(member) as src, open(dest, "wb") as dst:
                    dst.write(src.read())


def to_snake_case(col: str) -> str:
    col = col.strip()
    col = re.sub(r"[\s\-]+", "_", col)
    col = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", col)
    return col.lower()


def parse_dirty_numeric(series: pd.Series) -> tuple[pd.Series, int]:
    """Strip currency symbols, commas, percent signs, and text units (e.g. '30 days')."""
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce"), 0
    raw_str = series.astype(str).str.strip()
    dirty_mask = raw_str.str.contains(r"[₹$,%\sa-zA-Z]", regex=True, na=False)
    cleaned = (
        raw_str.str.replace(r"[₹$,%\s]", "", regex=True)
        .str.extract(r"(-?\d+(?:\.\d+)?)", expand=False)
    )
    parsed = pd.to_numeric(cleaned, errors="coerce")
    return parsed, int(dirty_mask.sum())


def json_safe(obj: Any) -> Any:
    """Recursively convert NaN/Inf/numpy scalars into valid JSON primitives."""
    if obj is None:
        return None
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        val = float(obj)
        return None if (math.isnan(val) or math.isinf(val)) else round(val, 4)
    if isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    if isinstance(obj, dict):
        return {str(k): json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [json_safe(v) for v in obj]
    if pd.isna(obj):
        return None
    return obj


def df_sample_records(df: pd.DataFrame, n: int = 10) -> list[dict[str, Any]]:
    sample = df.head(n).copy()
    records = sample.to_dict(orient="records")
    return [json_safe(rec) for rec in records]


def compute_histogram(series: pd.Series, bins: np.ndarray, unit_scale: float = 1.0) -> list[dict[str, Any]]:
    vals = pd.to_numeric(series, errors="coerce").dropna().to_numpy() * unit_scale
    counts, edges = np.histogram(vals, bins=bins)
    out = []
    for i in range(len(counts)):
        out.append(
            {
                "bin": f"{round(float(edges[i]), 1)}–{round(float(edges[i + 1]), 1)}",
                "low": round(float(edges[i]), 2),
                "high": round(float(edges[i + 1]), 2),
                "count": int(counts[i]),
            }
        )
    return out


def clean_single_dataset(spec: dict[str, Any]) -> tuple[pd.DataFrame, dict[str, Any], pd.Series, pd.Series, pd.Series, pd.Series]:
    key = spec["key"]
    kind = spec["kind"]
    raw_df = pd.read_csv(spec["path"])
    raw_rows = int(len(raw_df))
    memory_mb_before = float(raw_df.memory_usage(deep=True).sum() / (1024 * 1024))
    raw_sample = df_sample_records(raw_df, 10)

    # Track initial nulls (and capture semantic dirty strings as audit info)
    nulls_before = int(raw_df.isna().sum().sum())

    # Stage 1: Schema Standardization & Source Tagging
    df = raw_df.copy()
    df.columns = [to_snake_case(c) for c in df.columns]
    df["source_platform"] = key

    if kind == "beauty_historical":
        df = df.rename(
            columns={
                "duration": "duration_days",
                "target_audience": "target_audience",
                "customer_segment": "category",
            }
        )
        # In Nykaa/Purplle/Tira CSVs, acquisition_cost is CPA; total cost = CPA * conversions
        df["campaign_cost"] = pd.to_numeric(df["acquisition_cost"], errors="coerce") * pd.to_numeric(
            df["conversions"], errors="coerce"
        )
        dirty_parsed = 0
    elif kind == "influencer_proto":
        df = df.rename(
            columns={
                "platform": "channel_used",
                "influencer_category": "category",
                "estimated_reach": "impressions",
                "engagements": "clicks",
                "product_sales": "conversions",
                "campaign_duration_days": "duration_days",
            }
        )
        df["target_audience"] = df["category"]
        # Derive proxy financials using standard ₹1,450 beauty/lifestyle AOV and ₹280 CPA
        df["revenue"] = pd.to_numeric(df["conversions"], errors="coerce") * 1450.0
        df["campaign_cost"] = (
            pd.to_numeric(df["clicks"], errors="coerce") * 4.5
            + pd.to_numeric(df["conversions"], errors="coerce") * 260.0
        )
        df["roi"] = (df["revenue"] - df["campaign_cost"]) / df["campaign_cost"].replace(0, np.nan)
        df["engagement_score"] = (
            pd.to_numeric(df["clicks"], errors="coerce")
            / pd.to_numeric(df["impressions"], errors="coerce").replace(0, np.nan)
            * 100.0
        )
        dirty_parsed = 0
    else:  # marketing_proto
        df = df.rename(
            columns={
                "duration": "duration_days",
                "customer_segment": "category",
                "acquisition_cost": "campaign_cost",
            }
        )
        dirty_parsed = 0

    # Stage 2: Dirty String-to-Numeric Parsing (run before numeric checks)
    numeric_cols = [
        "duration_days",
        "impressions",
        "clicks",
        "conversions",
        "campaign_cost",
        "revenue",
        "roi",
        "engagement_score",
        "conversion_rate",
    ]
    for col in numeric_cols:
        if col in df.columns:
            parsed, count = parse_dirty_numeric(df[col])
            df[col] = parsed
            dirty_parsed += count

    if kind == "marketing_proto":
        # Derive missing revenue & conversions cleanly from clicks * conversion_rate and budget * (1 + roi)
        df["conversions"] = (df["clicks"] * df["conversion_rate"]).round().clip(lower=1)
        df["revenue"] = df["campaign_cost"] * (1.0 + df["roi"])

    # Stage 3: Duplicate & Invalid Record Removal
    before_dedup = len(df)
    df = df.drop_duplicates()
    if "campaign_id" in df.columns:
        df = df.drop_duplicates(subset=["campaign_id"], keep="first")
    duplicates_removed = int(before_dedup - len(df))

    # Drop invalid records: zero/negative cost or impressions, or clicks > impressions (bot distortion)
    valid_mask = (
        df["impressions"].fillna(0) > 0
    ) & (
        df["campaign_cost"].fillna(0) > 0
    ) & (
        df["clicks"].fillna(0) >= 0
    ) & (
        df["clicks"].fillna(0) <= df["impressions"].fillna(0)
    ) & (
        df["conversions"].fillna(0) >= 0
    ) & (
        df["conversions"].fillna(0) <= df["clicks"].fillna(0)
    )
    invalid_removed = int((~valid_mask).sum())
    df = df.loc[valid_mask].copy()

    # Stage 4: Missing Value Imputation
    nulls_in_pipeline = int(df.isna().sum().sum())
    cat_cols = ["campaign_type", "channel_used", "category", "target_audience"]
    for c in cat_cols:
        if c not in df.columns:
            df[c] = "unknown"
        df[c] = df[c].astype(str).str.strip().replace({"": "unknown", "nan": "unknown", "None": "unknown"})

    # Normalize legacy TikTok entries into YouTube Shorts for India-compliant short-form modeling
    df["channel_used"] = df["channel_used"].replace(
        {
            "TikTok": "YouTube Shorts",
            "tiktok": "YouTube Shorts",
            "Tik Tok": "YouTube Shorts",
            "tik tok": "YouTube Shorts",
        }
    )

    for c in ["duration_days", "impressions", "clicks", "conversions", "campaign_cost", "revenue", "engagement_score"]:
        if c not in df.columns:
            df[c] = np.nan
        if df[c].isna().any():
            med = df[c].median()
            df[c] = df[c].fillna(0.0 if pd.isna(med) else med)

    nulls_imputed = max(nulls_before, nulls_in_pipeline)

    # Derive core ratios prior to IQR clipping so before-IQR histograms reflect raw anomalies
    df["ctr"] = (df["clicks"] / df["impressions"]).clip(lower=0.0, upper=1.0)
    df["conversion_rate"] = (df["conversions"] / df["clicks"].replace(0, np.nan)).fillna(0.0).clip(lower=0.0, upper=1.0)
    df["cpc"] = df["campaign_cost"] / df["clicks"].replace(0, np.nan)
    df["cpc"] = df["cpc"].fillna(df["cpc"].median())
    df["revenue_per_rupee"] = df["revenue"] / df["campaign_cost"].replace(0, np.nan)
    df["revenue_per_rupee"] = df["revenue_per_rupee"].fillna(df["revenue_per_rupee"].median())
    df["net_roi_pct"] = ((df["revenue"] - df["campaign_cost"]) / df["campaign_cost"]) * 100.0

    # Save raw distributions before IQR clipping
    raw_roi_series = df["net_roi_pct"].copy()
    raw_ctr_series = df["ctr"].copy()

    # Stage 5: IQR Bot-Spike & Outlier Clipping
    iqr_cols = ["ctr", "conversion_rate", "engagement_score", "net_roi_pct", "campaign_cost"]
    outliers_clipped = 0
    for col in iqr_cols:
        q1 = float(df[col].quantile(0.25))
        q3 = float(df[col].quantile(0.75))
        iqr = q3 - q1
        if iqr <= 0:
            continue
        low = q1 - 1.5 * iqr
        high = q3 + 1.5 * iqr
        if col in ("ctr", "conversion_rate", "engagement_score", "campaign_cost"):
            low = max(0.0, low)
        clipped_mask = (df[col] < low) | (df[col] > high)
        outliers_clipped += int(clipped_mask.sum())
        df[col] = df[col].clip(lower=low, upper=high)

    # Re-align revenue_per_rupee consistently after ROI clipping
    df["revenue_per_rupee"] = 1.0 + (df["net_roi_pct"] / 100.0)

    # Stage 6: Standardization & Parquet Export
    df["campaign_id"] = df["campaign_id"].astype(str)
    for col in ["impressions", "clicks", "conversions", "duration_days"]:
        df[col] = df[col].round().astype("int64")
    for col in [
        "campaign_cost",
        "revenue",
        "engagement_score",
        "ctr",
        "conversion_rate",
        "cpc",
        "revenue_per_rupee",
        "net_roi_pct",
    ]:
        df[col] = df[col].astype("float64")

    # Optimize categorical memory footprint for clean storage metrics
    clean_df = df[UNIFIED_COLUMNS].copy()
    for col in ["source_platform", "campaign_type", "channel_used", "category", "target_audience"]:
        clean_df[col] = clean_df[col].astype("category")
    for col in ["impressions", "clicks", "conversions", "duration_days"]:
        clean_df[col] = clean_df[col].astype("int32")
    for col in ["ctr", "conversion_rate", "cpc", "revenue_per_rupee", "net_roi_pct", "engagement_score"]:
        clean_df[col] = clean_df[col].astype("float32")

    memory_mb_after = float(clean_df.memory_usage(deep=True).sum() / (1024 * 1024))
    clean_df.to_parquet(spec["parquet"], index=False)

    clean_sample = df_sample_records(clean_df, 10)
    audit = {
        "key": key,
        "label": spec["label"],
        "raw_rows": raw_rows,
        "clean_rows": int(len(clean_df)),
        "duplicates_removed": duplicates_removed,
        "invalid_rows_removed": invalid_removed,
        "dirty_strings_parsed": dirty_parsed,
        "nulls_before": nulls_before,
        "nulls_imputed": nulls_imputed,
        "outliers_clipped": outliers_clipped,
        "memory_mb_before": round(memory_mb_before, 2),
        "memory_mb_after": round(memory_mb_after, 2),
        "median_ctr_pct": round(float(clean_df["ctr"].median() * 100.0), 2),
        "median_conversion_rate_pct": round(float(clean_df["conversion_rate"].median() * 100.0), 2),
        "median_roi_pct": round(float(clean_df["net_roi_pct"].median()), 2),
        "raw_sample": raw_sample,
        "clean_sample": clean_sample,
    }

    return clean_df, audit, raw_roi_series, clean_df["net_roi_pct"], raw_ctr_series, clean_df["ctr"]


def main() -> None:
    ensure_raw_extracted()
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    frames: list[pd.DataFrame] = []
    audits: list[dict[str, Any]] = []
    raw_rois: list[pd.Series] = []
    clean_rois: list[pd.Series] = []
    raw_ctrs: list[pd.Series] = []
    clean_ctrs: list[pd.Series] = []

    for spec in DATASET_SPECS:
        print(f"[CLEANING] Processing {spec['label']}...")
        clean_df, audit, r_roi, c_roi, r_ctr, c_ctr = clean_single_dataset(spec)
        frames.append(clean_df)
        audits.append(audit)
        raw_rois.append(r_roi)
        clean_rois.append(c_roi)
        raw_ctrs.append(r_ctr)
        clean_ctrs.append(c_ctr)
        print(
            f"  -> raw={audit['raw_rows']:,}, clean={audit['clean_rows']:,}, "
            f"invalid_removed={audit['invalid_rows_removed']:,}, "
            f"outliers_clipped={audit['outliers_clipped']:,}, "
            f"mem={audit['memory_mb_before']:.1f}MB -> {audit['memory_mb_after']:.1f}MB"
        )

    unified = pd.concat(frames, ignore_index=True)
    unified_path = PROCESSED_DIR / "unified_training_data.parquet"
    unified.to_parquet(unified_path, index=False)
    print(f"[EXPORT] Unified dataset saved -> {unified_path} ({len(unified):,} rows)")

    # Build Before vs. After IQR histograms
    all_raw_roi = pd.concat(raw_rois, ignore_index=True).clip(-100, 1200)
    all_clean_roi = pd.concat(clean_rois, ignore_index=True).clip(-100, 1200)
    roi_bins = np.linspace(-100, 1200, 14)

    all_raw_ctr = pd.concat(raw_ctrs, ignore_index=True).clip(0, 0.35)
    all_clean_ctr = pd.concat(clean_ctrs, ignore_index=True).clip(0, 0.35)
    ctr_bins = np.linspace(0, 35, 13)

    roi_before_hist = compute_histogram(all_raw_roi, roi_bins, 1.0)
    roi_after_hist = compute_histogram(all_clean_roi, roi_bins, 1.0)
    roi_histogram = [
        {
            "bin": roi_before_hist[i]["bin"] + "%",
            "before_iqr": roi_before_hist[i]["count"],
            "after_iqr": roi_after_hist[i]["count"],
        }
        for i in range(len(roi_before_hist))
    ]

    ctr_before_hist = compute_histogram(all_raw_ctr, ctr_bins, 100.0)
    ctr_after_hist = compute_histogram(all_clean_ctr, ctr_bins, 100.0)
    ctr_histogram = [
        {
            "bin": ctr_before_hist[i]["bin"] + "%",
            "before_iqr": ctr_before_hist[i]["count"],
            "after_iqr": ctr_after_hist[i]["count"],
        }
        for i in range(len(ctr_before_hist))
    ]

    # Channel calibration comparison for Nykaa, Tira, Purplle
    channel_comparison = []
    for ch_key, ch_name, color in [
        ("nykaa", "Nykaa", "#FC2779"),
        ("tira", "Tira", "#ED1C24"),
        ("purplle", "Purplle", "#C084FC"),
    ]:
        sub = unified[unified["source_platform"] == ch_key]
        med_aov = float((sub["revenue"] / sub["conversions"].replace(0, np.nan)).median())
        channel_comparison.append(
            {
                "channel": ch_name,
                "key": ch_key,
                "color": color,
                "campaigns": int(len(sub)),
                "median_ctr_pct": round(float(sub["ctr"].median() * 100.0), 2),
                "median_conversion_rate_pct": round(float(sub["conversion_rate"].median() * 100.0), 2),
                "median_roi_pct": round(float(sub["net_roi_pct"].median()), 2),
                "median_aov_inr": round(med_aov, 0),
            }
        )

    # Normalize AOV multipliers relative to mean AOV across Nykaa/Tira/Purplle
    mean_aov = float(np.mean([c["median_aov_inr"] for c in channel_comparison]))
    for c in channel_comparison:
        c["calibration_multiplier"] = round(c["median_aov_inr"] / mean_aov, 2)

    mem_before_total = sum(a["memory_mb_before"] for a in audits)
    mem_after_total = sum(a["memory_mb_after"] for a in audits)
    mem_reduction_pct = ((mem_before_total - mem_after_total) / mem_before_total) * 100.0 if mem_before_total else 0.0

    report = {
        "global_kpis": {
            "total_raw_rows": sum(a["raw_rows"] for a in audits),
            "total_clean_rows": sum(a["clean_rows"] for a in audits),
            "duplicates_removed": sum(a["duplicates_removed"] for a in audits),
            "invalid_rows_removed": sum(a["invalid_rows_removed"] for a in audits),
            "dirty_strings_parsed": sum(a["dirty_strings_parsed"] for a in audits),
            "nulls_imputed": sum(a["nulls_imputed"] for a in audits),
            "outliers_clipped": sum(a["outliers_clipped"] for a in audits),
            "memory_mb_before": round(mem_before_total, 2),
            "memory_mb_after": round(mem_after_total, 2),
            "memory_reduced_pct": round(mem_reduction_pct, 1),
        },
        "datasets": audits,
        "histograms": {
            "roi": roi_histogram,
            "ctr": ctr_histogram,
        },
        "channel_comparison": channel_comparison,
    }

    report_path = PROCESSED_DIR / "cleaning_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(json_safe(report), f, indent=2, allow_nan=False)

    print(f"[EXPORT] Cleaning report saved -> {report_path}")


if __name__ == "__main__":
    main()
