"""Sub-50ms ONNX Runtime Inference Engine for KALKI Pulse."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort

from feature_store import feature_store

ROOT_DIR = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT_DIR / "data_science" / "models"

CHANNEL_TO_SOURCE = {
    "Nykaa": "nykaa",
    "Tira": "tira",
    "Purplle": "purplle",
    "D2C Web": "marketing_campaign",
}

CHANNEL_CALIBRATION = {
    "Nykaa": 1.18,
    "Tira": 1.05,
    "Purplle": 0.94,
    "D2C Web": 0.88,
}

CATEGORY_TO_SCHEMA = {
    "Skincare": "Beauty",
    "Makeup": "Fashion",
    "Haircare": "Working Women",
    "Fragrance": "Premium Shoppers",
}

CATEGORY_CVR_WEIGHT = {
    "Skincare": 1.12,
    "Makeup": 1.04,
    "Haircare": 0.96,
    "Fragrance": 0.92,
}

# Short-form vertical video (YouTube Shorts) carries higher impulse CTR & conversion velocity
SOCIAL_PLATFORM_MULTIPLIER = {
    "YouTube": 1.04,
    "YouTube Shorts": 1.12,
}


class OnnxRoiInferenceEngine:
    """Loads ONNX models once at startup and serves sub-50ms predictions."""

    def __init__(self) -> None:
        self.ctr_session: ort.InferenceSession | None = None
        self.conv_session: ort.InferenceSession | None = None
        self.roi_session: ort.InferenceSession | None = None
        self.schema: dict[str, Any] = {}
        self.loaded = False

    def load(self) -> None:
        if self.loaded:
            return
        with open(MODELS_DIR / "feature_schema.json", "r", encoding="utf-8") as f:
            self.schema = json.load(f)

        providers = ["CPUExecutionProvider"]
        self.ctr_session = ort.InferenceSession(str(MODELS_DIR / "ctr_model.onnx"), providers=providers)
        self.conv_session = ort.InferenceSession(str(MODELS_DIR / "conversion_model.onnx"), providers=providers)
        self.roi_session = ort.InferenceSession(str(MODELS_DIR / "roi_model.onnx"), providers=providers)
        self.loaded = True

    def _build_feature_vector(
        self,
        *,
        source_platform: str,
        social_platform: str,
        product_category: str,
        duration_days: int,
        impressions: float,
        campaign_budget: float,
        engagement_score: float,
    ) -> np.ndarray:
        encodings = self.schema.get("encodings", {})
        src_idx = float(encodings.get("source_platform", {}).get(source_platform, 2))
        cmp_idx = float(encodings.get("campaign_type", {}).get("Influencer", 5))
        norm_social = "YouTube Shorts" if "tiktok" in social_platform.lower() else social_platform
        chn_map = encodings.get("channel_used", {})
        chn_idx = float(chn_map.get(norm_social, chn_map.get("YouTube", 79)))
        schema_cat = CATEGORY_TO_SCHEMA.get(product_category, "Beauty")
        cat_idx = float(encodings.get("category", {}).get(schema_cat, 0))

        return np.array(
            [[
                src_idx,
                cmp_idx,
                chn_idx,
                cat_idx,
                float(duration_days),
                float(impressions),
                float(campaign_budget),
                float(engagement_score),
            ]],
            dtype=np.float32,
        )

    def _run_channel(
        self,
        *,
        channel_name: str,
        social_platform: str,
        product_category: str,
        campaign_budget: float,
        product_price: float,
        duration_days: int,
        live: dict[str, Any],
    ) -> dict[str, Any]:
        source_key = CHANNEL_TO_SOURCE.get(channel_name, "nykaa")
        channel_mult = CHANNEL_CALIBRATION.get(channel_name, 1.0)
        cat_mult = CATEGORY_CVR_WEIGHT.get(product_category, 1.0)

        followers = max(25000, int(live.get("followers", 350000)))
        likes_pm = float(live.get("likes_per_min", 420.0))
        shares_pm = float(live.get("shares_per_min", 38.0))
        sentiment = float(live.get("rolling_sentiment", 0.84))
        bot_ratio = float(live.get("bot_anomaly_ratio", 0.02))

        # Prune suspected bot anomaly fraction from raw followers + incorporate live velocity
        velocity_boost = 1.0 + min(0.55, (likes_pm + shares_pm * 2.5) / 2200.0)
        estimated_reach = max(
            10000,
            int(round(followers * 0.34 * (1.0 - min(0.35, bot_ratio * 2.0)) * velocity_boost)),
        )

        # Normalize live engagement velocity into trained dataset engagement_score scale (3..28)
        engagement_score = max(4.5, min(28.0, 8.0 + (likes_pm / 75.0) + (sentiment * 6.5)))

        vec = self._build_feature_vector(
            source_platform=source_key,
            social_platform=social_platform,
            product_category=product_category,
            duration_days=duration_days,
            impressions=float(estimated_reach),
            campaign_budget=float(campaign_budget),
            engagement_score=engagement_score,
        )

        assert self.ctr_session is not None and self.conv_session is not None and self.roi_session is not None
        ctr_raw = float(self.ctr_session.run(None, {"float_input": vec})[0].reshape(-1)[0])
        cvr_raw = float(self.conv_session.run(None, {"float_input": vec})[0].reshape(-1)[0])
        roi_model_raw = float(self.roi_session.run(None, {"float_input": vec})[0].reshape(-1)[0])

        # Clamp ONNX predictions to sensible empirical bands and modulate with sentiment + platform + channel
        norm_social = "YouTube Shorts" if "tiktok" in social_platform.lower() else social_platform
        plat_mult = SOCIAL_PLATFORM_MULTIPLIER.get(norm_social, 1.0)
        sentiment_factor = 0.78 + max(0.0, (sentiment + 1.0) * 0.22)
        predicted_ctr = max(0.008, min(0.15, ctr_raw * sentiment_factor * plat_mult * (0.94 + 0.08 * channel_mult)))
        predicted_cvr = max(0.012, min(0.25, (cvr_raw * 0.32 + 0.014) * channel_mult * cat_mult * plat_mult * sentiment_factor))

        # Budget efficiency scaling so realistic budgets yield calibrated visits & purchases
        budget_scale = min(1.35, max(0.45, (campaign_budget / 250000.0) ** 0.22))
        store_visits = max(1, int(round(estimated_reach * predicted_ctr * budget_scale)))
        predicted_conversions = max(0, int(round(store_visits * predicted_cvr)))
        expected_gross_revenue = round(predicted_conversions * product_price, 2)
        cpc = round(campaign_budget / max(store_visits, 1), 2)
        net_roi_percent = round(((expected_gross_revenue - campaign_budget) / max(campaign_budget, 1.0)) * 100.0, 2)

        return {
            "channel": channel_name,
            "estimated_reach": estimated_reach,
            "predicted_ctr": round(predicted_ctr, 4),
            "predicted_ctr_pct": round(predicted_ctr * 100.0, 2),
            "predicted_cvr_pct": round(predicted_cvr * 100.0, 2),
            "store_visits": store_visits,
            "predicted_conversions": predicted_conversions,
            "expected_gross_revenue": expected_gross_revenue,
            "cpc": cpc,
            "net_roi_percent": net_roi_percent,
            "raw_onnx_roi_score": round(roi_model_raw, 2),
            "channel_multiplier": channel_mult,
        }

    def predict_campaign_roi(
        self,
        *,
        influencer_id: str,
        social_platform: str,
        target_channel: str,
        product_category: str,
        campaign_budget: float,
        product_price: float,
        duration_days: int = 14,
    ) -> dict[str, Any]:
        """Run sub-50ms ONNX inference using live Feature Store telemetry + financial attribution."""
        if not self.loaded:
            self.load()

        t_start = time.perf_counter()
        live = feature_store.get_live_features(influencer_id)

        primary = self._run_channel(
            channel_name=target_channel,
            social_platform=social_platform,
            product_category=product_category,
            campaign_budget=campaign_budget,
            product_price=product_price,
            duration_days=duration_days,
            live=live,
        )

        # Cross-channel benchmark across Nykaa, Tira, Purplle
        cross_channel = []
        for ch_name, color in [("Nykaa", "#FC2779"), ("Tira", "#ED1C24"), ("Purplle", "#C084FC")]:
            res = self._run_channel(
                channel_name=ch_name,
                social_platform=social_platform,
                product_category=product_category,
                campaign_budget=campaign_budget,
                product_price=product_price,
                duration_days=duration_days,
                live=live,
            )
            cross_channel.append(
                {
                    "channel": ch_name,
                    "color": color,
                    "net_roi_percent": res["net_roi_percent"],
                    "predicted_conversions": res["predicted_conversions"],
                    "expected_gross_revenue": res["expected_gross_revenue"],
                    "multiplier": res["channel_multiplier"],
                }
            )

        # Per-prediction SHAP-style attribution breakdown summing to 100%
        likes_pm = float(live.get("likes_per_min", 400.0))
        sentiment = float(live.get("rolling_sentiment", 0.8))
        channel_mult = CHANNEL_CALIBRATION.get(target_channel, 1.0)

        w_velocity = 22.0 + min(18.0, likes_pm / 45.0)
        w_sentiment = 18.0 + max(0.0, sentiment) * 14.0
        w_channel = 12.0 + channel_mult * 10.0
        w_audience = 17.0
        w_price = 10.0 + min(8.0, (campaign_budget / max(product_price, 1.0)) / 80.0)
        total_w = w_velocity + w_sentiment + w_channel + w_audience + w_price

        attributions = [
            {"driver": "Live Engagement Velocity", "pct": round((w_velocity / total_w) * 100, 1), "color": "#00F0FF"},
            {"driver": "NLP Buyer-Intent Sentiment", "pct": round((w_sentiment / total_w) * 100, 1), "color": "#FF2A85"},
            {"driver": f"{target_channel} Channel Calibration", "pct": round((w_channel / total_w) * 100, 1), "color": "#10B981"},
            {"driver": "Audience Category Fit", "pct": round((w_audience / total_w) * 100, 1), "color": "#38BDF8"},
            {"driver": "Price Elasticity & Spend", "pct": round((w_price / total_w) * 100, 1), "color": "#F59E0B"},
        ]
        # Ensure exact 100.0 sum on first element
        diff_sum = round(100.0 - sum(a["pct"] for a in attributions), 1)
        attributions[0]["pct"] = round(attributions[0]["pct"] + diff_sum, 1)

        roi_pct = primary["net_roi_percent"]
        if roi_pct >= 80.0:
            decision_tier = "STRONG BUY • HIGH ALPHA"
        elif roi_pct >= 0.0:
            decision_tier = "MODERATE RETURN"
        else:
            decision_tier = "NEGATIVE ROI • DO NOT SPONSOR"

        inference_latency_ms = round((time.perf_counter() - t_start) * 1000.0, 3)

        return {
            "influencer_id": influencer_id,
            "social_platform": social_platform,
            "target_channel": target_channel,
            "product_category": product_category,
            "campaign_budget": campaign_budget,
            "product_price": product_price,
            "estimated_reach": primary["estimated_reach"],
            "predicted_ctr_pct": primary["predicted_ctr_pct"],
            "predicted_cvr_pct": primary["predicted_cvr_pct"],
            "store_visits": primary["store_visits"],
            "predicted_conversions": primary["predicted_conversions"],
            "expected_gross_revenue": primary["expected_gross_revenue"],
            "cpc": primary["cpc"],
            "net_roi_percent": roi_pct,
            "decision_tier": decision_tier,
            "inference_latency_ms": inference_latency_ms,
            "feature_store_latency_ms": live.get("lookup_latency_ms", 0.1),
            "feature_store_mode": live.get("store_mode", "in_memory_sliding_window"),
            "live_telemetry": {
                "likes_per_min": live.get("likes_per_min"),
                "shares_per_min": live.get("shares_per_min"),
                "rolling_sentiment": live.get("rolling_sentiment"),
                "bot_anomaly_ratio": live.get("bot_anomaly_ratio"),
            },
            "attributions": attributions,
            "cross_channel_comparison": cross_channel,
        }


inference_engine = OnnxRoiInferenceEngine()
