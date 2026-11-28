"""Protected FastAPI routes for Niche-Gated ONNX ROI Prediction, Live Marketplace Feeds & Real YouTube Telemetry."""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from auth import UserPublic, get_current_user
from database import get_db
from feature_store import feature_store
from inference import inference_engine
from data_pipeline.connectors.marketplace_connector import get_live_marketplace_feed
from data_pipeline.connectors.youtube_connector import (
    compute_live_bot_audit,
    extract_youtube_video_details,
    fetch_youtube_comments,
    lookup_youtube_handle,
    lookup_youtube_video_with_channel_context,
    parse_youtube_handle,
    poll_youtube_video_stats,
)
from data_pipeline.consumer.redis_aggregator import ingest_protobuf_packet
from data_pipeline.simulator.prototype_stream_producer import build_live_youtube_protobuf_event

router = APIRouter(prefix="/api", tags=["ONNX Prediction & Live Streams"])


class PredictRoiRequest(BaseModel):
    influencer_id: str = Field(..., min_length=2, max_length=80)
    social_platform: Literal["YouTube", "YouTube Shorts"] = "YouTube Shorts"
    target_channel: Literal["Nykaa", "Tira", "Purplle", "D2C Web"] = "Nykaa"
    product_category: Literal["Skincare", "Makeup", "Haircare", "Fragrance"] = "Skincare"
    campaign_budget: float = Field(default=150000.0, gt=0)
    product_price: float = Field(default=1450.0, gt=0)
    duration_days: int = Field(default=14, ge=1, le=90)
    save_to_history: bool = True


class TrackYoutubeRequest(BaseModel):
    video_url_or_id: str = Field(..., min_length=2, max_length=300)


class TelemetryActionRequest(BaseModel):
    influencer_id: str | None = Field(default=None, max_length=80)


@router.get("/channels/live-feed")
async def channels_live_feed(
    refresh: bool = Query(default=False),
    _: UserPublic = Depends(get_current_user),
) -> dict[str, Any]:
    """Return live telemetry, active sale/campaign pulse, real-time CPC & verified beauty benchmarks."""
    feed = await get_live_marketplace_feed(force_refresh=refresh)
    return {
        **feed,
        "verified_beauty_creators": feature_store.get_verified_beauty_creators(),
    }


@router.post("/predict-roi")
async def predict_roi(
    payload: PredictRoiRequest,
    current_user: UserPublic = Depends(get_current_user),
) -> dict[str, Any]:
    """Run niche-gated ONNX inference on live creator telemetry + live marketplace CPC."""
    cid = payload.influencer_id.strip()

    # If creator is not yet in the live feature store, fetch live via YouTube Data API v3
    if not feature_store.has_creator(cid):
        if not os.getenv("YOUTUBE_API_KEY"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="YOUTUBE_API_KEY is not configured. Live creator verification is unavailable.",
            )
        handle_match = parse_youtube_handle(cid)
        if not handle_match:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Creator '{cid}' is not in the live feed yet. Enter a valid YouTube @handle (e.g. @SuperPrincessjo).",
            )
        try:
            channel_res = await lookup_youtube_handle(handle_match)
        except LookupError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"YouTube Data API v3 lookup failed for '{cid}': {exc}",
            ) from exc

        item = channel_res["primary_item"]
        raw_proto = build_live_youtube_protobuf_event(item)
        ingest_protobuf_packet(raw_proto, feature_store, metadata=item)
        cid = str(item["influencer_id"])

    marketplace_feed = await get_live_marketplace_feed()
    try:
        result = inference_engine.predict_campaign_roi(
            influencer_id=cid,
            social_platform=payload.social_platform,
            target_channel=payload.target_channel,
            product_category=payload.product_category,
            campaign_budget=payload.campaign_budget,
            product_price=payload.product_price,
            duration_days=payload.duration_days,
            marketplace_feed=marketplace_feed,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    now_dt = datetime.now(timezone.utc)
    created_at = now_dt.isoformat()
    expires_at = (now_dt + timedelta(minutes=60)).isoformat()

    if payload.save_to_history:
        with get_db() as conn:
            cursor = conn.execute(
                """
                INSERT INTO prediction_history (
                    user_id, session_id, expires_at, influencer_id, social_platform, target_channel,
                    product_category, campaign_budget, product_price, estimated_reach, predicted_ctr_pct,
                    store_visits, predicted_conversions, expected_gross_revenue, cpc,
                    net_roi_percent, inference_latency_ms, decision_tier, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    current_user.id,
                    current_user.session_id,
                    expires_at,
                    result["influencer_id"],
                    result["social_platform"],
                    result["target_channel"],
                    result["product_category"],
                    result["campaign_budget"],
                    result["product_price"],
                    result["estimated_reach"],
                    result["predicted_ctr_pct"],
                    result["store_visits"],
                    result["predicted_conversions"],
                    result["expected_gross_revenue"],
                    result["cpc"],
                    result["net_roi_percent"],
                    result["inference_latency_ms"],
                    result["decision_tier"],
                    created_at,
                ),
            )
            result["prediction_id"] = cursor.fetchone()["id"]
            result["created_at"] = created_at

    return result


@router.get("/creators/live-feed")
def creators_live_feed(
    _: UserPublic = Depends(get_current_user),
) -> dict[str, Any]:
    """Return live-ingested creators and their real-time rolling telemetry & niche verification."""
    return feature_store.list_creators_feed()


@router.get("/stream/telemetry/{influencer_id:path}")
def stream_creator_telemetry(
    influencer_id: str,
    _: UserPublic = Depends(get_current_user),
) -> dict[str, Any]:
    """Return rolling 30-point time series, rolling velocity metrics, and latest YT comments."""
    return feature_store.get_creator_telemetry(influencer_id.strip())


@router.post("/telemetry/refresh")
async def refresh_live_telemetry(
    payload: TelemetryActionRequest,
    _: UserPublic = Depends(get_current_user),
) -> dict[str, Any]:
    """Force an immediate live YouTube Data API v3 + Marketplace feed refresh."""
    if not os.getenv("YOUTUBE_API_KEY"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="YOUTUBE_API_KEY is not configured. Live telemetry refresh is unavailable.",
        )

    refreshed_items: list[dict[str, Any]] = []
    cid = (payload.influencer_id or "").strip()
    try:
        if cid and cid.startswith("@") and feature_store.has_creator(cid):
            feat = feature_store.get_live_features(cid)
            if feat and feat.get("video_id"):
                items = await poll_youtube_video_stats([str(feat["video_id"])], include_comments=True)
                for item in items:
                    raw_proto = build_live_youtube_protobuf_event(item)
                    ingest_protobuf_packet(raw_proto, feature_store, metadata=item)
                refreshed_items.extend(items)
        if not refreshed_items:
            items = await poll_youtube_video_stats(include_comments=True)
            for item in items:
                raw_proto = build_live_youtube_protobuf_event(item)
                ingest_protobuf_packet(raw_proto, feature_store, metadata=item)
            refreshed_items.extend(items)
        feature_store.set_live_status("live", None)
    except Exception as exc:
        feature_store.set_live_status("live_feed_unavailable", str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Live YouTube telemetry refresh failed: {exc}",
        ) from exc

    marketplace_feed = await get_live_marketplace_feed(force_refresh=True)
    return {
        "status": "refreshed",
        "refreshed_count": len(refreshed_items),
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "marketplace_status": marketplace_feed.get("status"),
        "marketplace_fetched_at": marketplace_feed.get("fetched_at"),
    }


@router.post("/telemetry/audit")
async def run_live_bot_audit(
    payload: TelemetryActionRequest,
    _: UserPublic = Depends(get_current_user),
) -> dict[str, Any]:
    """Compute real engagement-to-view ratio, duplicate/spam comment checks & view anomalies."""
    cid = (payload.influencer_id or "").strip()
    feat = feature_store.get_live_features(cid) if cid else None
    if feat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Creator '{cid}' has no live telemetry loaded to audit.",
        )

    vid = feat.get("video_id")
    comments = list(feat.get("recent_comments") or [])
    if vid and os.getenv("YOUTUBE_API_KEY"):
        fresh_comments = await fetch_youtube_comments(str(vid), max_results=12)
        if fresh_comments:
            comments = fresh_comments

    videos_slice = [
        {
            "views": feat.get("real_views") or feat.get("median_recent_views") or 0,
            "likes": feat.get("real_likes") or 0,
            "comments_count": feat.get("real_comments") or 0,
        }
    ]
    audit = compute_live_bot_audit(videos_slice, comments)

    # Update feature store record with fresh live audit
    if vid:
        raw_proto = build_live_youtube_protobuf_event(
            {
                "video_id": vid,
                "influencer_id": feat["influencer_id"],
                "platform": feat["platform"],
                "likes_per_min_signal": int(round(feat.get("likes_per_min", 1))),
                "comments_per_min_signal": int(round(feat.get("comments_per_min", 0))),
                "shares_per_min_signal": int(round(feat.get("shares_per_min", 0))),
                "estimated_sentiment": feat.get("rolling_sentiment", 0.7),
            }
        )
        ingest_protobuf_packet(
            raw_proto,
            feature_store,
            metadata={
                "data_source": "youtube_api_v3",
                "detected_niche": feat.get("detected_niche"),
                "is_beauty_creator": feat.get("is_beauty_creator"),
                "recent_comments": comments,
                "bot_audit": audit,
                "bot_anomaly_ratio": audit["bot_anomaly_ratio"],
                "views": feat.get("real_views"),
                "likes": feat.get("real_likes"),
                "comments_count": feat.get("real_comments"),
            },
        )

    return {
        "status": "audited",
        "influencer_id": feat["influencer_id"],
        "bot_audit": audit,
        "comments_checked": len(comments),
    }


@router.post("/youtube/track")
async def track_live_youtube_video(
    payload: TrackYoutubeRequest,
    _: UserPublic = Depends(get_current_user),
) -> dict[str, Any]:
    """Track live YouTube @handle (10-15 uploads + topicDetails + ad proof) OR Video/Shorts URL."""
    if not os.getenv("YOUTUBE_API_KEY"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="YOUTUBE_API_KEY is not configured in environment.",
        )

    raw_query = payload.video_url_or_id.strip()
    handle_match = parse_youtube_handle(raw_query)

    if handle_match:
        try:
            channel_res = await lookup_youtube_handle(handle_match)
        except LookupError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"YouTube Data API v3 @handle lookup failed: {exc}",
            ) from exc

        item = channel_res["primary_item"]
        raw_proto = build_live_youtube_protobuf_event(item)
        ingest_protobuf_packet(raw_proto, feature_store, metadata=item)
        feature_store.set_live_status("live", None)
        updated_creator = feature_store.get_live_features(str(item["influencer_id"]))

        return {
            "status": "youtube_channel_tracked",
            "lookup_type": "channel_handle",
            "quota_units_used": channel_res["quota_units_used"],
            "handle": channel_res["handle"],
            "channel_id": channel_res.get("channel_id"),
            "subscriber_count": channel_res["subscriber_count"],
            "channel_view_count": channel_res["channel_view_count"],
            "video_count": channel_res["video_count"],
            "latest_videos": channel_res["latest_videos"],
            "video_id": item["video_id"],
            "influencer_id": item["influencer_id"],
            "platform": item["platform"],
            "platform_key": item["platform_key"],
            "duration_seconds": item.get("duration_seconds", 0),
            "video_title": item["video_title"],
            "channel_title": channel_res["channel_title"],
            "niche": channel_res["detected_niche"],
            "detected_niche": channel_res["detected_niche"],
            "is_beauty_creator": channel_res["is_beauty_creator"],
            "ad_readiness_score": channel_res["ad_readiness_score"],
            "sponsored_video_count": channel_res["sponsored_video_count"],
            "sponsored_videos_detected": channel_res["sponsored_videos_detected"],
            "recent_videos_scanned": channel_res["recent_videos_scanned"],
            "sponsorship_rate_pct": channel_res["sponsorship_rate_pct"],
            "detected_brand_mentions": channel_res["detected_brand_mentions"],
            "sample_sponsored_videos": channel_res["sample_sponsored_videos"],
            "sponsored_video_examples": channel_res["sponsored_video_examples"],
            "median_recent_views": channel_res["median_recent_views"],
            "video_ids_analyzed": channel_res["video_ids_analyzed"],
            "bot_audit": channel_res["bot_audit"],
            "youtube_synced_at": channel_res["youtube_synced_at"],
            "real_views": item["views"],
            "real_likes": item["likes"],
            "real_comments": item["comments_count"],
            "computed_sentiment": item["estimated_sentiment"],
            "recent_comments": item["recent_comments"],
            "creator_features": updated_creator,
        }

    try:
        video_id, is_shorts_url = extract_youtube_video_details(raw_query)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    try:
        item = await lookup_youtube_video_with_channel_context(video_id, is_shorts_url=is_shorts_url)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"YouTube Data API v3 request failed: {exc}",
        ) from exc

    raw_proto = build_live_youtube_protobuf_event(item)
    ingest_protobuf_packet(raw_proto, feature_store, metadata=item)
    feature_store.set_live_status("live", None)
    updated_creator = feature_store.get_live_features(str(item["influencer_id"]))

    return {
        "status": "youtube_video_tracked",
        "lookup_type": "video_url",
        "quota_units_used": 4,
        "video_id": item["video_id"],
        "channel_id": item.get("channel_id"),
        "influencer_id": item["influencer_id"],
        "platform": item["platform"],
        "platform_key": item["platform_key"],
        "duration_seconds": item.get("duration_seconds", 0),
        "video_title": item["video_title"],
        "channel_title": item["channel_title"],
        "niche": item["detected_niche"],
        "detected_niche": item["detected_niche"],
        "is_beauty_creator": item["is_beauty_creator"],
        "ad_readiness_score": item["ad_readiness_score"],
        "sponsored_video_count": item["sponsored_video_count"],
        "sponsored_videos_detected": item["sponsored_videos_detected"],
        "recent_videos_scanned": item["recent_videos_scanned"],
        "sponsorship_rate_pct": item["sponsorship_rate_pct"],
        "detected_brand_mentions": item["detected_brand_mentions"],
        "sample_sponsored_videos": item["sample_sponsored_videos"],
        "sponsored_video_examples": item["sponsored_video_examples"],
        "median_recent_views": item["median_recent_views"],
        "video_ids_analyzed": item["video_ids_analyzed"],
        "bot_audit": item.get("bot_audit", {}),
        "youtube_synced_at": item.get("youtube_synced_at"),
        "real_views": item["views"],
        "real_likes": item["likes"],
        "real_comments": item["comments_count"],
        "computed_sentiment": item["estimated_sentiment"],
        "recent_comments": item["recent_comments"],
        "latest_videos": [],
        "creator_features": updated_creator,
    }


@router.get("/predictions/history")
def get_prediction_history(
    current_user: UserPublic = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Return strictly active-session, non-expired campaign evaluations for this user."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, influencer_id, social_platform, target_channel, product_category,
                   campaign_budget, product_price, estimated_reach, predicted_ctr_pct,
                   store_visits, predicted_conversions, expected_gross_revenue, cpc,
                   net_roi_percent, inference_latency_ms, decision_tier, created_at
            FROM prediction_history
            WHERE user_id = %s AND session_id = %s AND expires_at > %s
            ORDER BY id DESC
            LIMIT 25
            """,
            (current_user.id, current_user.session_id, now_iso),
        ).fetchall()
    return [dict(r) for r in rows]


@router.delete("/predictions/history")
def clear_prediction_history(
    current_user: UserPublic = Depends(get_current_user),
) -> dict[str, str]:
    """Explicitly clear the authenticated user's saved session evaluations."""
    with get_db() as conn:
        conn.execute(
            "DELETE FROM prediction_history WHERE user_id = %s",
            (current_user.id,),
        )
    return {"status": "cleared"}
