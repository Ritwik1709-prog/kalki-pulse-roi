"""Protected FastAPI routes for Sub-50ms ONNX ROI Prediction & Live Protobuf Streaming."""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from auth import UserPublic, get_current_user
from database import get_db
from feature_store import feature_store
from inference import inference_engine
from data_pipeline.connectors.youtube_connector import (
    extract_youtube_video_details,
    lookup_youtube_handle,
    parse_youtube_handle,
    poll_youtube_video_stats,
    register_tracked_video_id,
)
from data_pipeline.consumer.redis_aggregator import ingest_protobuf_packet
from data_pipeline.simulator.prototype_stream_producer import (
    build_live_youtube_protobuf_event,
    build_protobuf_event,
)

router = APIRouter(prefix="/api", tags=["ONNX Prediction & Live Streams"])


class PredictRoiRequest(BaseModel):
    influencer_id: str = Field(default="@koyal_bhattacharjee_shorts", min_length=2, max_length=80)
    social_platform: Literal["YouTube", "YouTube Shorts"] = "YouTube Shorts"
    target_channel: Literal["Nykaa", "Tira", "Purplle", "D2C Web"] = "Nykaa"
    product_category: Literal["Skincare", "Makeup", "Haircare", "Fragrance"] = "Skincare"
    campaign_budget: float = Field(default=300000.0, gt=0)
    product_price: float = Field(default=1450.0, gt=0)
    duration_days: int = Field(default=14, ge=1, le=90)
    save_to_history: bool = True


class StreamBurstRequest(BaseModel):
    influencer_id: str = Field(default="@koyal_bhattacharjee_shorts", min_length=2, max_length=80)
    burst_type: Literal["viral", "bot_spike"] = "viral"
    platform: Literal["YouTube", "YouTube Shorts"] | None = None


class TrackYoutubeRequest(BaseModel):
    video_url_or_id: str = Field(..., min_length=2, max_length=300)


@router.post("/predict-roi")
def predict_roi(
    payload: PredictRoiRequest,
    current_user: UserPublic = Depends(get_current_user),
) -> dict[str, Any]:
    """Run ONNX inference, persist to prediction_history, and return attribution forecast."""
    result = inference_engine.predict_campaign_roi(
        influencer_id=payload.influencer_id.strip(),
        social_platform=payload.social_platform,
        target_channel=payload.target_channel,
        product_category=payload.product_category,
        campaign_budget=payload.campaign_budget,
        product_price=payload.product_price,
        duration_days=payload.duration_days,
    )

    created_at = datetime.now(timezone.utc).isoformat()
    if payload.save_to_history:
        with get_db() as conn:
            cursor = conn.execute(
                """
                INSERT INTO prediction_history (
                    user_id, influencer_id, social_platform, target_channel, product_category,
                    campaign_budget, product_price, estimated_reach, predicted_ctr_pct,
                    store_visits, predicted_conversions, expected_gross_revenue, cpc,
                    net_roi_percent, inference_latency_ms, decision_tier, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    current_user.id,
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
            result["prediction_id"] = cursor.lastrowid
            result["created_at"] = created_at

    return result


@router.get("/creators/live-feed")
def creators_live_feed(
    _: UserPublic = Depends(get_current_user),
) -> dict[str, Any]:
    """Return tracked creators and their real-time rolling velocity & sentiment."""
    return feature_store.list_creators_feed()


@router.get("/stream/telemetry/{influencer_id:path}")
def stream_creator_telemetry(
    influencer_id: str,
    _: UserPublic = Depends(get_current_user),
) -> dict[str, Any]:
    """Return rolling 30-point time series, rolling velocity metrics, and latest YT comments."""
    return feature_store.get_creator_telemetry(influencer_id.strip())


@router.post("/stream/burst")
def trigger_stream_burst(
    payload: StreamBurstRequest,
    _: UserPublic = Depends(get_current_user),
) -> dict[str, Any]:
    """Emit serialized Protobuf EngagementEvent packets simulating a viral or bot burst."""
    emitted: list[dict[str, Any]] = []
    for _ in range(3):
        raw_proto = build_protobuf_event(
            payload.influencer_id.strip(),
            burst_multiplier=2.2 if payload.burst_type == "viral" else 1.0,
            simulate_bot_spike=(payload.burst_type == "bot_spike"),
            platform_override=payload.platform,
        )
        record = ingest_protobuf_packet(raw_proto, feature_store)
        emitted.append(record)

    updated = feature_store.get_live_features(payload.influencer_id.strip())
    return {
        "status": "burst_ingested",
        "burst_type": payload.burst_type,
        "packets_emitted": len(emitted),
        "latest_event": emitted[-1],
        "creator_features": updated,
    }


@router.post("/youtube/track")
async def track_live_youtube_video(
    payload: TrackYoutubeRequest,
    _: UserPublic = Depends(get_current_user),
) -> dict[str, Any]:
    """Track live YouTube @handle (4 quota units) OR YouTube/Shorts Video URL via API v3."""
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
        updated_creator = feature_store.get_live_features(str(item["influencer_id"]))

        return {
            "status": "youtube_channel_tracked",
            "lookup_type": "channel_handle",
            "quota_units_used": channel_res["quota_units_used"],
            "handle": channel_res["handle"],
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
            "niche": item["niche"],
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
        items = await poll_youtube_video_stats(
            [video_id],
            include_comments=True,
            comments_limit=8,
            shorts_url_ids={video_id} if is_shorts_url else set(),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"YouTube Data API v3 request failed: {exc}",
        ) from exc

    if not items:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No public YouTube video found for ID '{video_id}'.",
        )

    item = items[0]
    register_tracked_video_id(video_id, is_shorts_url=(is_shorts_url or item.get("platform_key") == "youtube_shorts"))
    raw_proto = build_live_youtube_protobuf_event(item)
    ingest_protobuf_packet(raw_proto, feature_store, metadata=item)
    updated_creator = feature_store.get_live_features(str(item["influencer_id"]))

    return {
        "status": "youtube_video_tracked",
        "lookup_type": "video_url",
        "quota_units_used": 2,
        "video_id": item["video_id"],
        "influencer_id": item["influencer_id"],
        "platform": item["platform"],
        "platform_key": item["platform_key"],
        "duration_seconds": item.get("duration_seconds", 0),
        "video_title": item["video_title"],
        "channel_title": item["channel_title"],
        "niche": item["niche"],
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
    """Return the authenticated brand user's saved campaign evaluations."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, influencer_id, social_platform, target_channel, product_category,
                   campaign_budget, product_price, estimated_reach, predicted_ctr_pct,
                   store_visits, predicted_conversions, expected_gross_revenue, cpc,
                   net_roi_percent, inference_latency_ms, decision_tier, created_at
            FROM prediction_history
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 25
            """,
            (current_user.id,),
        ).fetchall()
    return [dict(r) for r in rows]
