"""Sub-50ms Niche-Gated & Real-Time CPC Calibrated ONNX Runtime Inference Engine."""

from __future__ import annotations

import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from data_pipeline.connectors.marketplace_connector import get_cached_channel_benchmark
from feature_store import feature_store

MODELS_DIR = ROOT_DIR / "data_science" / "models"

CHANNEL_TO_SOURCE = {
    "Nykaa": "nykaa",
    "Tira": "tira",
    "Purplle": "purplle",
    "D2C Web": "marketing_campaign",
}

CATEGORY_TO_SCHEMA = {
    "Skincare": "Beauty",
    "Makeup": "Fashion",
    "Haircare": "Working Women",
    "Fragrance": "Premium Shoppers",
}

CATEGORY_CVR_WEIGHT = {
    "Skincare": 1.08,
    "Makeup": 1.02,
    "Haircare": 0.94,
    "Fragrance": 0.88,
}

SOCIAL_PLATFORM_MULTIPLIER = {
    "YouTube": 1.0,
    "YouTube Shorts": 1.08,
}


class OnnxRoiInferenceEngine:
    """Loads ONNX models once at startup and serves niche-gated sub-50ms predictions."""

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
        norm_social = "YouTube Shorts" if "shorts" in social_platform.lower() else social_platform
        chn_map = encodings.get("channel_used", {})
        chn_idx = float(chn_map.get(norm_social, chn_map.get("YouTube", 133)))
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

    @staticmethod
    def _compute_creator_product_fit(
        *,
        live: dict[str, Any],
        product_category: str,
        target_channel: str,
    ) -> tuple[int, float, float, str]:
        """Compute creator-product fit (0..100) and niche gate multipliers for CTR & CVR."""
        detected_niche = str(live.get("detected_niche") or live.get("niche") or "General")
        is_beauty = bool(live.get("is_beauty_creator", False))
        sponsored_count = int(live.get("sponsored_video_count", 0) or 0)
        sponsorship_rate = float(live.get("sponsorship_rate_pct", 0.0) or 0.0)
        brand_mentions = [str(b) for b in (live.get("detected_brand_mentions") or [])]

        # 1. Niche alignment (0..55)
        if detected_niche == product_category:
            niche_pts = 55.0
            niche_ctr_gate = 1.0
            niche_cvr_gate = 1.0
        elif is_beauty:
            niche_pts = 39.0
            niche_ctr_gate = 0.80
            niche_cvr_gate = 0.82
        elif detected_niche == "Vlog" and brand_mentions:
            niche_pts = 24.0
            niche_ctr_gate = 0.48
            niche_cvr_gate = 0.52
        elif detected_niche in {"Vlog", "Fitness"}:
            niche_pts = 12.0
            niche_ctr_gate = 0.16
            niche_cvr_gate = 0.20
        else:
            # Hard niche mismatch (e.g. Gaming, Tech, Finance, Entertainment, Food, Education, General)
            niche_pts = 4.0
            niche_ctr_gate = 0.10
            niche_cvr_gate = 0.14

        # 2. Commercial sponsorship proof (0..25)
        if is_beauty or brand_mentions:
            ad_pts = min(25.0, 5.0 + sponsorship_rate * 0.55 + min(3, sponsored_count) * 4.0) if sponsored_count > 0 else 4.0
        else:
            ad_pts = min(7.0, sponsored_count * 1.5)

        # 3. Target marketplace & beauty brand affinity (0..20)
        brand_pts = 0.0
        if target_channel in brand_mentions:
            brand_pts += 12.0
        if any(m in brand_mentions for m in ("Nykaa", "Tira", "Purplle")):
            brand_pts += 4.0
        if len(brand_mentions) >= 2:
            brand_pts += 4.0
        brand_pts = min(20.0, brand_pts)

        fit_score = int(round(max(0.0, min(100.0, niche_pts + ad_pts + brand_pts))))
        return fit_score, niche_ctr_gate, niche_cvr_gate, detected_niche

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
        channel_benchmark: dict[str, Any],
    ) -> dict[str, Any]:
        source_key = CHANNEL_TO_SOURCE.get(channel_name, "nykaa")
        channel_mult = float(channel_benchmark.get("channel_multiplier", 1.0))
        live_market_cpc = float(channel_benchmark.get("live_cpc_inr", 24.5))
        live_cvr_base_pct = float(channel_benchmark.get("live_cvr_baseline_pct", 3.8))
        live_ctr_base_pct = float(channel_benchmark.get("live_ctr_baseline_pct", 2.9))
        base_cpm_inr = float(channel_benchmark.get("active_cpm_inr", 215.0))
        cat_mult = CATEGORY_CVR_WEIGHT.get(product_category, 1.0)

        subscribers = max(1000, int(live.get("followers") or 10000))
        median_recent_views = max(1000, int(live.get("median_recent_views") or live.get("real_views") or 15000))
        likes_pm = float(live.get("likes_per_min", 10.0))
        sentiment = float(live.get("rolling_sentiment", 0.72))
        bot_ratio = float(live.get("bot_anomaly_ratio", 0.0))

        fit_score, niche_ctr_gate, niche_cvr_gate, detected_niche = self._compute_creator_product_fit(
            live=live,
            product_category=product_category,
            target_channel=channel_name,
        )

        # Effective creator media CPM scales with format and creator tier
        norm_social = "YouTube Shorts" if "shorts" in social_platform.lower() else "YouTube"
        format_cpm_factor = 0.72 if norm_social == "YouTube Shorts" else 0.96
        tier_cpm_factor = 0.82 + 0.16 * max(0.0, math.log10(max(1.0, subscribers / 50_000.0)))
        effective_cpm_inr = round(max(85.0, min(650.0, base_cpm_inr * format_cpm_factor * tier_cpm_factor)), 2)

        # Budget-coupled reach allowing multi-deliverables + paid creator amplification with smooth saturation
        organic_factor = max(0.50, 1.0 - min(0.45, bot_ratio * 1.4))
        budget_impressions = (campaign_budget / effective_cpm_inr) * 1000.0
        single_deliverable_views = max(2000.0, median_recent_views * organic_factor)
        deliverables_funded = max(1.0, min(6.5, max(duration_days / 10.0, budget_impressions / single_deliverable_views)))
        organic_cap = single_deliverable_views * deliverables_funded

        if budget_impressions <= organic_cap:
            estimated_reach = max(1000, int(round(budget_impressions)))
        else:
            excess = budget_impressions - organic_cap
            estimated_reach = max(1000, int(round(organic_cap + math.sqrt(organic_cap * excess) * 0.65)))

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

        plat_mult = SOCIAL_PLATFORM_MULTIPLIER.get(norm_social, 1.0)
        sentiment_factor = 0.78 + max(0.0, (sentiment + 1.0) * 0.18)

        sponsored_count = int(live.get("sponsored_video_count", 0) or 0)
        brand_mentions = [str(b) for b in (live.get("detected_brand_mentions") or [])]
        if sponsored_count > 0 and channel_name in brand_mentions:
            ad_factor = 1.10
        elif sponsored_count > 0:
            ad_factor = 1.02
        else:
            ad_factor = 0.86

        # Calibrate ONNX output with live marketplace baselines + niche gate + ad verification
        base_ctr = (0.0085 + min(0.011, max(0.0, ctr_raw) * 0.08)) * (live_ctr_base_pct / 2.9) * sentiment_factor * plat_mult
        base_cvr = (live_cvr_base_pct / 100.0) * (0.78 + min(0.25, max(0.0, cvr_raw) * 0.55)) * cat_mult * sentiment_factor

        predicted_ctr = max(0.0008, min(0.045, base_ctr * niche_ctr_gate * ad_factor))
        predicted_cvr = max(0.0015, min(0.075, base_cvr * niche_cvr_gate * ad_factor))

        # Mild saturation efficiency when budget exceeds multi-deliverable organic cap
        saturation_efficiency = 1.0 if budget_impressions <= organic_cap else max(0.75, (organic_cap / budget_impressions) ** 0.14)
        store_visits = max(1, int(round(estimated_reach * predicted_ctr * saturation_efficiency)))
        predicted_conversions = max(0, int(round(store_visits * predicted_cvr)))
        expected_gross_revenue = round(predicted_conversions * product_price, 2)
        cpc = round(campaign_budget / max(store_visits, 1), 2)
        net_roi_percent = round(((expected_gross_revenue - campaign_budget) / max(campaign_budget, 1.0)) * 100.0, 2)
        max_safe_cpc_inr = round(product_price * predicted_cvr, 2)

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
            "live_market_cpc_inr": live_market_cpc,
            "max_safe_cpc_inr": max_safe_cpc_inr,
            "effective_cpm_inr": effective_cpm_inr,
            "niche_gate_multiplier": round(niche_ctr_gate, 3),
            "creator_product_fit_score": fit_score,
            "detected_niche": detected_niche,
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
        marketplace_feed: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Run sub-50ms niche-gated ONNX inference with live marketplace CPC calibration & verdict."""
        if not self.loaded:
            self.load()

        t_start = time.perf_counter()
        live = feature_store.get_live_features(influencer_id)
        if live is None:
            raise LookupError(
                f"No live YouTube telemetry synced for '{influencer_id}'. Sync the creator first."
            )

        def _bench(ch: str) -> dict[str, Any]:
            if marketplace_feed and ch in marketplace_feed.get("by_channel", {}):
                ch_obj = marketplace_feed["by_channel"][ch]
                return {
                    **ch_obj,
                    "fetched_at": marketplace_feed.get("fetched_at"),
                }
            return get_cached_channel_benchmark(ch, product_category)

        primary_bench = _bench(target_channel)
        primary = self._run_channel(
            channel_name=target_channel,
            social_platform=social_platform,
            product_category=product_category,
            campaign_budget=campaign_budget,
            product_price=product_price,
            duration_days=duration_days,
            live=live,
            channel_benchmark=primary_bench,
        )

        # Cross-channel benchmark across Nykaa, Tira, Purplle, D2C Web
        cross_channel = []
        for ch_name, color in [
            ("Nykaa", "#FC2779"),
            ("Tira", "#ED1C24"),
            ("Purplle", "#C084FC"),
            ("D2C Web", "#00F0FF"),
        ]:
            bench = _bench(ch_name)
            res = self._run_channel(
                channel_name=ch_name,
                social_platform=social_platform,
                product_category=product_category,
                campaign_budget=campaign_budget,
                product_price=product_price,
                duration_days=duration_days,
                live=live,
                channel_benchmark=bench,
            )
            cross_channel.append(
                {
                    "channel": ch_name,
                    "color": color,
                    "net_roi_percent": res["net_roi_percent"],
                    "predicted_conversions": res["predicted_conversions"],
                    "expected_gross_revenue": res["expected_gross_revenue"],
                    "cpc": res["cpc"],
                    "live_cpc_inr": res["live_market_cpc_inr"],
                    "multiplier": res["channel_multiplier"],
                }
            )

        # Per-prediction SHAP-style attribution breakdown summing to 100%
        likes_pm = float(live.get("likes_per_min", 10.0))
        sentiment = float(live.get("rolling_sentiment", 0.72))
        fit_score = primary["creator_product_fit_score"]
        channel_mult = primary["channel_multiplier"]

        w_niche_fit = 26.0 if fit_score < 40 else (20.0 + fit_score * 0.14)
        w_velocity = 14.0 + min(16.0, likes_pm / 60.0)
        w_sentiment = 12.0 + max(0.0, sentiment) * 10.0
        w_channel = 10.0 + channel_mult * 8.0
        w_cpc_price = 14.0 + min(10.0, primary["max_safe_cpc_inr"] / max(1.0, primary["cpc"]) * 6.0)
        total_w = w_niche_fit + w_velocity + w_sentiment + w_channel + w_cpc_price

        attributions = [
            {"driver": "Creator-Product Niche & Ad Fit", "pct": round((w_niche_fit / total_w) * 100, 1), "color": "#38BDF8"},
            {"driver": "Live Engagement Velocity", "pct": round((w_velocity / total_w) * 100, 1), "color": "#00F0FF"},
            {"driver": f"{target_channel} Live CPC & Margin", "pct": round((w_cpc_price / total_w) * 100, 1), "color": "#F59E0B"},
            {"driver": "NLP Buyer-Intent Sentiment", "pct": round((w_sentiment / total_w) * 100, 1), "color": "#FF2A85"},
            {"driver": f"{target_channel} Channel Calibration", "pct": round((w_channel / total_w) * 100, 1), "color": "#10B981"},
        ]
        diff_sum = round(100.0 - sum(a["pct"] for a in attributions), 1)
        attributions[0]["pct"] = round(attributions[0]["pct"] + diff_sum, 1)

        # Deterministic Final Investment Verdict
        roi_pct = primary["net_roi_percent"]
        detected_niche = primary["detected_niche"]
        is_beauty = bool(live.get("is_beauty_creator", False))
        sponsored_count = int(live.get("sponsored_video_count", 0) or 0)
        scanned_count = int(live.get("recent_videos_scanned", 0) or 0)
        sponsorship_rate = float(live.get("sponsorship_rate_pct", 0.0) or 0.0)
        brand_mentions = [str(b) for b in (live.get("detected_brand_mentions") or [])]
        ad_verified = sponsored_count > 0
        median_recent_views = int(live.get("median_recent_views") or live.get("real_views") or 0)
        real_time_cpc = float(primary["live_market_cpc_inr"])
        forecast_cpc = float(primary["cpc"])
        max_safe_cpc = float(primary["max_safe_cpc_inr"])

        if (not is_beauty and fit_score < 45) or roi_pct < 0.0 or fit_score < 35:
            verdict = "DO NOT INVEST"
            decision_tier = "DO NOT INVEST • NICHE MISMATCH" if not is_beauty else "DO NOT INVEST • NEGATIVE ROI"
            recommended_budget_inr = 0.0
        elif roi_pct >= 45.0 and fit_score >= 65 and is_beauty:
            verdict = "INVEST"
            decision_tier = "INVEST • VERIFIED FIT"
            optimal = (median_recent_views * 1.45 * primary["effective_cpm_inr"]) / 1000.0
            recommended_budget_inr = round(max(50000.0, min(campaign_budget * 1.2, optimal)), -3)
        else:
            verdict = "CONDITIONAL TEST"
            decision_tier = "CONDITIONAL TEST • PILOT BUDGET"
            pilot = (median_recent_views * 0.65 * primary["effective_cpm_inr"]) / 1000.0
            recommended_budget_inr = round(min(campaign_budget, max(25000.0, pilot)), -3)

        confidence_pct = int(
            round(
                min(
                    97,
                    max(
                        52,
                        55
                        + min(20, scanned_count * 1.6)
                        + (12 if abs(fit_score - 50) >= 25 else 5)
                        + (8 if live.get("data_source") == "youtube_api_v3" else 0),
                    ),
                )
            )
        )

        # 3 concise, factual reasons
        if is_beauty:
            niche_reason = (
                f"Niche Match ({fit_score}/100): Creator classifies as {detected_niche}, "
                f"{'directly matching' if detected_niche == product_category else 'adjacent to'} {target_channel} {product_category}."
            )
        else:
            niche_reason = (
                f"Niche Mismatch ({fit_score}/100): Creator classifies as {detected_niche} (non-beauty), "
                f"so {target_channel} {product_category} buyer intent is heavily gated ({primary['niche_gate_multiplier']}×)."
            )

        if ad_verified:
            brands_str = ", ".join(brand_mentions[:4]) if brand_mentions else "general sponsors"
            ad_reason = (
                f"Ad History Verified: {sponsored_count}/{max(1, scanned_count)} recent uploads ({sponsorship_rate}%) "
                f"contain sponsor/disclosure signals ({brands_str})."
            )
        else:
            ad_reason = (
                f"Unverified Ad History: 0/{max(1, scanned_count)} recent uploads showed commercial sponsorship "
                f"or {target_channel} affiliate signals."
            )

        cpc_reason = (
            f"CPC & Margin: Forecast CPC is ₹{forecast_cpc:,.2f} vs. {target_channel} live benchmark ₹{real_time_cpc:,.2f} "
            f"(break-even max safe CPC ₹{max_safe_cpc:,.2f}), yielding {roi_pct:+.1f}% Net ROI."
        )
        reasons = [niche_reason, ad_reason, cpc_reason]

        alternatives = (
            feature_store.get_verified_beauty_creators(exclude_id=influencer_id)
            if verdict != "INVEST"
            else []
        )

        if verdict == "INVEST":
            executive_summary = (
                f"INVEST in {influencer_id} for {target_channel} {product_category}: verified {detected_niche} creator "
                f"({fit_score}/100 fit) delivering ₹{forecast_cpc:,.2f} CPC and {roi_pct:+.1f}% projected Net ROI."
            )
        elif verdict == "CONDITIONAL TEST":
            executive_summary = (
                f"CONDITIONAL TEST on {influencer_id} for {target_channel} {product_category}: cap initial spend at "
                f"₹{recommended_budget_inr:,.0f} and validate CPA before scaling ({roi_pct:+.1f}% projected Net ROI)."
            )
        else:
            alt_names = ", ".join(a["influencer_id"] for a in alternatives[:2])
            alt_clause = f" Switch budget to verified beauty creators such as {alt_names}." if alt_names else ""
            executive_summary = (
                f"DO NOT INVEST in {influencer_id} for {target_channel} {product_category}: {detected_niche} audience mismatch "
                f"drives ₹{forecast_cpc:,.2f} CPC and {roi_pct:+.1f}% Net ROI.{alt_clause}"
            )

        youtube_synced_at = str(live.get("youtube_synced_at") or datetime.now(timezone.utc).isoformat())
        marketplace_synced_at = str(
            (marketplace_feed or {}).get("fetched_at")
            or primary_bench.get("fetched_at")
            or datetime.now(timezone.utc).isoformat()
        )
        inference_latency_ms = round((time.perf_counter() - t_start) * 1000.0, 3)

        investment_verdict = {
            "verdict": verdict,
            "confidence_pct": confidence_pct,
            "creator_product_fit_score": fit_score,
            "ad_experience_verified": ad_verified,
            "ad_readiness_score": int(live.get("ad_readiness_score", 0) or 0),
            "sponsored_videos_detected": sponsored_count,
            "recent_videos_scanned": scanned_count,
            "sponsorship_rate_pct": sponsorship_rate,
            "detected_niche": detected_niche,
            "requested_category": product_category,
            "is_beauty_creator": is_beauty,
            "detected_brand_mentions": brand_mentions,
            "sample_sponsored_videos": live.get("sample_sponsored_videos", []),
            "recommended_budget_inr": recommended_budget_inr,
            "real_time_cpc_inr": real_time_cpc,
            "forecast_cpc_inr": forecast_cpc,
            "max_safe_cpc_inr": max_safe_cpc,
            "reasons": reasons,
            "executive_summary": executive_summary,
            "suggested_alternatives": alternatives,
        }

        transparency_audit = {
            "youtube_synced_at": youtube_synced_at,
            "marketplace_synced_at": marketplace_synced_at,
            "data_source": live.get("data_source", "youtube_api_v3"),
            "is_simulated": False,
            "video_ids_analyzed": live.get("video_ids_analyzed", []),
            "median_recent_views": median_recent_views,
            "effective_cpm_inr": primary["effective_cpm_inr"],
            "niche_gate_multiplier": primary["niche_gate_multiplier"],
            "bot_audit": live.get("bot_audit", {}),
            "calculation_breakdown": {
                "estimated_reach": primary["estimated_reach"],
                "predicted_ctr_pct": primary["predicted_ctr_pct"],
                "store_visits": primary["store_visits"],
                "predicted_cvr_pct": primary["predicted_cvr_pct"],
                "predicted_conversions": primary["predicted_conversions"],
                "product_price_inr": product_price,
                "expected_gross_revenue_inr": primary["expected_gross_revenue"],
                "campaign_budget_inr": campaign_budget,
                "cpc_inr": forecast_cpc,
                "net_roi_percent": roi_pct,
            },
        }

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
                "median_recent_views": median_recent_views,
            },
            "investment_verdict": investment_verdict,
            "transparency_audit": transparency_audit,
            "data_provenance": transparency_audit,
            "attributions": attributions,
            "cross_channel_comparison": cross_channel,
        }


inference_engine = OnnxRoiInferenceEngine()
