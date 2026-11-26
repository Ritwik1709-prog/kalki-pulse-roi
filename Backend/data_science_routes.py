"""Protected FastAPI endpoints serving Data Cleaning & ONNX Model telemetry."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from auth import UserPublic, get_current_user

ROOT_DIR = Path(__file__).resolve().parents[1]
CLEANING_REPORT_PATH = ROOT_DIR / "data_science" / "data" / "processed" / "cleaning_report.json"
MODEL_METRICS_PATH = ROOT_DIR / "data_science" / "models" / "model_metrics.json"
FEATURE_SCHEMA_PATH = ROOT_DIR / "data_science" / "models" / "feature_schema.json"

router = APIRouter(prefix="/api/data-science", tags=["Data Science & ONNX"])


def _load_json(path: Path, missing_label: str) -> dict[str, Any]:
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{missing_label} not generated yet. Run the Phase 3 training pipeline first.",
        )
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/cleaning-report")
def get_cleaning_report(
    _: UserPublic = Depends(get_current_user),
) -> dict[str, Any]:
    """Return the full 6-stage data cleaning audit report and 10-row samples."""
    return _load_json(CLEANING_REPORT_PATH, "Cleaning report")


@router.get("/model-metrics")
def get_model_metrics(
    _: UserPublic = Depends(get_current_user),
) -> dict[str, Any]:
    """Return XGBoost + ONNX metrics, SHAP importances, and feature schema."""
    metrics = _load_json(MODEL_METRICS_PATH, "Model metrics")
    schema = _load_json(FEATURE_SCHEMA_PATH, "Feature schema")
    return {
        **metrics,
        "feature_schema": schema,
    }
