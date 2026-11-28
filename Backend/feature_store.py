"""Dual-mode sub-millisecond Velocity Feature Store (Redis + Thread-Safe In-Memory Live Store)."""

from __future__ import annotations

import json
import os
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

try:
    import redis  # type: ignore
except ImportError:
    redis = None  # type: ignore


@dataclass
class CreatorRecord:
    influencer_id: str
    display_name: str
    platform: str
    niche: str
    followers: int
    base_likes_per_min: float
    base_comments_per_min: float
    base_shares_per_min: float
    base_sentiment: float
    events: deque[dict[str, Any]] = field(default_factory=lambda: deque(maxlen=120))
    total_events: int = 0
    bot_flagged_events: int = 0
    data_source: str = "youtube_api_v3"
    is_simulated: bool = False
    video_id: str | None = None
    channel_id: str | None = None
    video_title: str | None = None
    channel_title: str | None = None
    real_views: int = 0
    real_likes: int = 0
    real_comments: int = 0
    median_recent_views: int = 0
    latest_delta_views: int = 0
    latest_delta_likes: int = 0
    recent_comments: list[dict[str, Any]] = field(default_factory=list)
    # Real creator verification & sponsorship metadata
    detected_niche: str = "General"
    is_beauty_creator: bool = False
    ad_readiness_score: int = 0
    sponsored_video_count: int = 0
    recent_videos_scanned: int = 0
    sponsorship_rate_pct: float = 0.0
    detected_brand_mentions: list[str] = field(default_factory=list)
    sample_sponsored_videos: list[dict[str, Any]] = field(default_factory=list)
    video_ids_analyzed: list[str] = field(default_factory=list)
    bot_audit: dict[str, Any] = field(default_factory=dict)
    youtube_synced_at: str = ""


class VelocityFeatureStore:
    """Tracks rolling 1-hour live social engagement velocity, sentiment & creator verification."""

    def __init__(self, redis_url: str | None = None) -> None:
        self._lock = threading.RLock()
        self._creators: dict[str, CreatorRecord] = {}
        self._global_ticker: deque[dict[str, Any]] = deque(maxlen=40)
        self._watched_creator_id: str | None = None
        self._redis_client: Any = None
        self.backend_mode = "in_memory_sliding_window"
        self.live_feed_status: str = "initializing"
        self.live_feed_error: str | None = None
        self.last_polled_at: str | None = None

        url = redis_url or os.getenv("REDIS_URL")
        if url and redis is not None:
            try:
                client = redis.Redis.from_url(url, socket_connect_timeout=0.4, decode_responses=True)
                client.ping()
                self._redis_client = client
                self.backend_mode = "redis_live"
            except Exception:
                self._redis_client = None
                self.backend_mode = "in_memory_sliding_window"

    def set_live_status(self, status: str, error: str | None = None) -> None:
        with self._lock:
            self.live_feed_status = status
            self.live_feed_error = error
            if status == "live":
                self.last_polled_at = datetime.now(timezone.utc).isoformat()

    def has_creator(self, influencer_id: str) -> bool:
        with self._lock:
            return influencer_id in self._creators

    def record_event(
        self,
        *,
        event_id: str,
        influencer_id: str,
        platform: str,
        timestamp: str,
        likes_delta: int,
        comments_delta: int,
        shares_delta: int,
        estimated_sentiment: float,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Ingest a live decoded Protobuf EngagementEvent into the 1-hour sliding window."""
        now_ts = time.time()
        meta = metadata or {}
        data_source = str(meta.get("data_source", "youtube_api_v3"))
        norm_platform = "YouTube Shorts" if "shorts" in platform.lower() else (platform or "YouTube")

        bot_audit = meta.get("bot_audit") if isinstance(meta.get("bot_audit"), dict) else {}
        bot_anomaly_val = float(meta.get("bot_anomaly_ratio") or bot_audit.get("bot_anomaly_ratio") or 0.0)
        real_views = int(meta.get("views") or 0)
        real_likes = int(meta.get("likes") or 0)
        is_bot_spike = bool(
            bot_anomaly_val >= 0.25
            or (real_views > 0 and (real_likes / max(1, real_views)) > 0.35)
        )

        views_delta_val = int(meta.get("real_delta_views") or 0)
        likes_delta_real = int(meta.get("real_delta_likes") or 0)
        source_tag = str(meta.get("platform_key") or data_source)

        detected_niche = str(meta.get("detected_niche") or meta.get("niche") or "General")
        is_beauty = bool(meta.get("is_beauty_creator", detected_niche in {"Skincare", "Makeup", "Haircare", "Fragrance"}))

        # Lightweight live velocity indicator (niche-aware, bounded)
        niche_factor = 1.0 if is_beauty else 0.15
        short_mult = 1.08 if norm_platform == "YouTube Shorts" else 1.0
        live_roi_pct = round(
            max(
                -95.0,
                min(
                    350.0,
                    (-45.0 + (likes_delta * 0.42 + shares_delta * 1.4) * max(0.25, estimated_sentiment + 0.3))
                    * short_mult
                    * niche_factor,
                ),
            ),
            1,
        )

        entry = {
            "event_id": event_id,
            "influencer_id": influencer_id,
            "platform": norm_platform,
            "ts": now_ts,
            "time_label": datetime.now(timezone.utc).strftime("%H:%M:%S"),
            "timestamp": timestamp,
            "likes_delta": int(likes_delta),
            "comments_delta": int(comments_delta),
            "shares_delta": int(shares_delta),
            "views_delta": views_delta_val,
            "real_likes_delta": likes_delta_real,
            "estimated_sentiment": round(max(-1.0, min(1.0, float(estimated_sentiment))), 3),
            "live_roi_pct": live_roi_pct,
            "source_tag": source_tag,
            "is_bot_spike": is_bot_spike,
            "data_source": data_source,
            "is_simulated": False,
            "video_id": meta.get("video_id"),
            "video_title": meta.get("video_title"),
            "latest_comment": meta.get("latest_comment"),
            "real_views": meta.get("views"),
            "real_likes": meta.get("likes"),
        }

        with self._lock:
            rec = self._creators.get(influencer_id)
            if rec is None:
                rec = CreatorRecord(
                    influencer_id=influencer_id,
                    display_name=str(meta.get("channel_title") or influencer_id.lstrip("@")),
                    platform=norm_platform,
                    niche=detected_niche,
                    detected_niche=detected_niche,
                    is_beauty_creator=is_beauty,
                    followers=int(meta.get("subscriber_count") or meta.get("estimated_reach") or 0),
                    base_likes_per_min=max(1.0, float(likes_delta)),
                    base_comments_per_min=max(0.0, float(comments_delta)),
                    base_shares_per_min=max(0.0, float(shares_delta)),
                    base_sentiment=float(estimated_sentiment),
                    data_source=data_source,
                    is_simulated=False,
                )
                self._creators[influencer_id] = rec

            if meta:
                rec.data_source = data_source
                rec.is_simulated = False
                rec.platform = norm_platform
                rec.niche = detected_niche
                rec.detected_niche = detected_niche
                rec.is_beauty_creator = is_beauty
                if meta.get("video_id"):
                    rec.video_id = str(meta["video_id"])
                if meta.get("channel_id"):
                    rec.channel_id = str(meta["channel_id"])
                if meta.get("video_title"):
                    rec.video_title = str(meta["video_title"])
                if meta.get("channel_title"):
                    rec.channel_title = str(meta["channel_title"])
                    rec.display_name = str(meta["channel_title"])
                if meta.get("subscriber_count") is not None and int(meta["subscriber_count"]) > 0:
                    rec.followers = int(meta["subscriber_count"])
                elif meta.get("estimated_reach"):
                    rec.followers = int(meta["estimated_reach"])
                if meta.get("views") is not None:
                    rec.real_views = int(meta["views"])
                if meta.get("likes") is not None:
                    rec.real_likes = int(meta["likes"])
                if meta.get("comments_count") is not None:
                    rec.real_comments = int(meta["comments_count"])
                if meta.get("median_recent_views") is not None:
                    rec.median_recent_views = int(meta["median_recent_views"])
                elif rec.median_recent_views == 0 and rec.real_views > 0:
                    rec.median_recent_views = rec.real_views
                if meta.get("real_delta_views") is not None:
                    rec.latest_delta_views = int(meta["real_delta_views"])
                if meta.get("real_delta_likes") is not None:
                    rec.latest_delta_likes = int(meta["real_delta_likes"])
                if meta.get("recent_comments"):
                    rec.recent_comments = list(meta["recent_comments"])
                if meta.get("ad_readiness_score") is not None:
                    rec.ad_readiness_score = int(meta["ad_readiness_score"])
                if meta.get("sponsored_video_count") is not None:
                    rec.sponsored_video_count = int(meta["sponsored_video_count"])
                if meta.get("recent_videos_scanned") is not None:
                    rec.recent_videos_scanned = int(meta["recent_videos_scanned"])
                if meta.get("sponsorship_rate_pct") is not None:
                    rec.sponsorship_rate_pct = float(meta["sponsorship_rate_pct"])
                if meta.get("detected_brand_mentions") is not None:
                    rec.detected_brand_mentions = list(meta["detected_brand_mentions"])
                if meta.get("sample_sponsored_videos") is not None:
                    rec.sample_sponsored_videos = list(meta["sample_sponsored_videos"])
                if meta.get("video_ids_analyzed") is not None:
                    rec.video_ids_analyzed = list(meta["video_ids_analyzed"])
                if meta.get("bot_audit") is not None:
                    rec.bot_audit = dict(meta["bot_audit"])
                if meta.get("youtube_synced_at"):
                    rec.youtube_synced_at = str(meta["youtube_synced_at"])
                else:
                    rec.youtube_synced_at = timestamp

            rec.events.append(entry)
            rec.total_events += 1
            if is_bot_spike:
                rec.bot_flagged_events += 1
            self._global_ticker.appendleft(entry)

            # Prune events older than 1 hour (3600s)
            cutoff = now_ts - 3600.0
            while len(rec.events) > 1 and rec.events[0]["ts"] < cutoff:
                rec.events.popleft()

        if self._redis_client is not None:
            try:
                key = f"kalki:creator:{influencer_id}:events"
                pipe = self._redis_client.pipeline()
                pipe.lpush(key, json.dumps(entry))
                pipe.ltrim(key, 0, 119)
                pipe.expire(key, 3600)
                pipe.execute()
            except Exception:
                pass

        return entry

    def get_live_features(self, influencer_id: str) -> dict[str, Any] | None:
        """Return <1ms rolling aggregates and verification metadata for a live creator."""
        t0 = time.perf_counter()
        with self._lock:
            rec = self._creators.get(influencer_id)
            if rec is None:
                return None

            recent = list(rec.events)
            clean_events = [e for e in recent if not e.get("is_bot_spike")] or recent
            n = max(1, len(clean_events))
            likes_pm = sum(e["likes_delta"] for e in clean_events) / n
            comments_pm = sum(e["comments_delta"] for e in clean_events) / n
            shares_pm = sum(e["shares_delta"] for e in clean_events) / n
            sentiment = sum(e["estimated_sentiment"] for e in clean_events) / n
            audit_bot_ratio = float(rec.bot_audit.get("bot_anomaly_ratio", 0.0) or 0.0)
            event_bot_ratio = rec.bot_flagged_events / max(1, rec.total_events)
            bot_ratio = max(audit_bot_ratio, event_bot_ratio)

            history = [
                {
                    "time": e["time_label"],
                    "likes_per_min": e["likes_delta"],
                    "shares_per_min": e["shares_delta"],
                    "comments_per_min": e["comments_delta"],
                    "views_delta": e.get("views_delta", 0),
                    "sentiment": e["estimated_sentiment"],
                    "live_roi_pct": e.get("live_roi_pct", 0.0),
                    "source_tag": e.get("source_tag", rec.data_source),
                    "is_bot_spike": e["is_bot_spike"],
                }
                for e in recent[-30:]
            ]

            return {
                "influencer_id": rec.influencer_id,
                "display_name": rec.display_name,
                "platform": rec.platform,
                "niche": rec.detected_niche,
                "detected_niche": rec.detected_niche,
                "is_beauty_creator": rec.is_beauty_creator,
                "ad_readiness_score": rec.ad_readiness_score,
                "sponsored_video_count": rec.sponsored_video_count,
                "sponsored_videos_detected": rec.sponsored_video_count,
                "recent_videos_scanned": rec.recent_videos_scanned,
                "sponsorship_rate_pct": rec.sponsorship_rate_pct,
                "detected_brand_mentions": list(rec.detected_brand_mentions),
                "sample_sponsored_videos": list(rec.sample_sponsored_videos),
                "sponsored_video_examples": list(rec.sample_sponsored_videos),
                "followers": rec.followers,
                "median_recent_views": rec.median_recent_views or rec.real_views,
                "likes_per_min": round(likes_pm, 1),
                "comments_per_min": round(comments_pm, 1),
                "shares_per_min": round(shares_pm, 1),
                "rolling_sentiment": round(sentiment, 3),
                "total_events": rec.total_events,
                "bot_anomaly_ratio": round(bot_ratio, 4),
                "bot_audit": dict(rec.bot_audit),
                "history": history,
                "time_series": history,
                "lookup_latency_ms": round((time.perf_counter() - t0) * 1000.0, 4),
                "store_mode": self.backend_mode,
                "data_source": rec.data_source,
                "is_simulated": False,
                "video_id": rec.video_id,
                "channel_id": rec.channel_id,
                "video_title": rec.video_title,
                "channel_title": rec.channel_title,
                "video_ids_analyzed": list(rec.video_ids_analyzed),
                "youtube_synced_at": rec.youtube_synced_at,
                "real_views": rec.real_views,
                "real_likes": rec.real_likes,
                "real_comments": rec.real_comments,
                "latest_delta_views": rec.latest_delta_views,
                "latest_delta_likes": rec.latest_delta_likes,
                "recent_comments": rec.recent_comments,
            }

    def set_watched_creator(self, influencer_id: str) -> None:
        """Remember the currently inspected creator."""
        with self._lock:
            self._watched_creator_id = influencer_id

    def get_verified_beauty_creators(self, *, exclude_id: str | None = None) -> list[dict[str, Any]]:
        """Return live-ingested verified beauty creators ranked by ad_readiness_score and engagement."""
        with self._lock:
            ids = list(self._creators.keys())
        out: list[dict[str, Any]] = []
        for cid in ids:
            if exclude_id and cid == exclude_id:
                continue
            feat = self.get_live_features(cid)
            if not feat:
                continue
            if feat.get("is_beauty_creator"):
                out.append(
                    {
                        "influencer_id": feat["influencer_id"],
                        "display_name": feat["display_name"],
                        "platform": feat["platform"],
                        "detected_niche": feat["detected_niche"],
                        "ad_readiness_score": feat["ad_readiness_score"],
                        "sponsored_video_count": feat["sponsored_video_count"],
                        "detected_brand_mentions": feat["detected_brand_mentions"],
                        "median_recent_views": feat["median_recent_views"],
                    }
                )
        out.sort(
            key=lambda x: (x["ad_readiness_score"], x["sponsored_video_count"], x["median_recent_views"]),
            reverse=True,
        )
        return out[:5]

    def get_creator_telemetry(self, influencer_id: str) -> dict[str, Any]:
        """Return 30-point sliding time series, rolling metrics, and recent YT comments."""
        self.set_watched_creator(influencer_id)
        feat = self.get_live_features(influencer_id)
        with self._lock:
            ticker = list(self._global_ticker)[:20]
            youtube_live_active = any(
                c.data_source == "youtube_api_v3" for c in self._creators.values()
            )
            feed_status = self.live_feed_status
            feed_error = self.live_feed_error

        if feat is None:
            return {
                "influencer_id": influencer_id,
                "found": False,
                "platform": "YouTube",
                "data_source": "youtube_api_v3",
                "is_simulated": False,
                "store_mode": self.backend_mode,
                "youtube_live_active": youtube_live_active,
                "live_feed_status": feed_status,
                "live_feed_error": feed_error,
                "time_series": [],
                "rolling_metrics": {
                    "likes_per_min": 0,
                    "comments_per_min": 0,
                    "shares_per_min": 0,
                    "rolling_sentiment": 0,
                    "bot_anomaly_ratio": 0,
                    "real_views": 0,
                    "real_likes": 0,
                    "real_comments": 0,
                    "latest_delta_views": 0,
                    "latest_delta_likes": 0,
                    "lookup_latency_ms": 0.0,
                },
                "recent_comments": [],
                "recent_events": ticker,
            }

        return {
            "influencer_id": feat["influencer_id"],
            "found": True,
            "platform": feat["platform"],
            "data_source": feat["data_source"],
            "is_simulated": False,
            "store_mode": self.backend_mode,
            "youtube_live_active": youtube_live_active,
            "live_feed_status": feed_status,
            "live_feed_error": feed_error,
            "detected_niche": feat["detected_niche"],
            "is_beauty_creator": feat["is_beauty_creator"],
            "ad_readiness_score": feat["ad_readiness_score"],
            "sponsored_video_count": feat["sponsored_video_count"],
            "sponsorship_rate_pct": feat["sponsorship_rate_pct"],
            "detected_brand_mentions": feat["detected_brand_mentions"],
            "sample_sponsored_videos": feat["sample_sponsored_videos"],
            "bot_audit": feat["bot_audit"],
            "youtube_synced_at": feat["youtube_synced_at"],
            "time_series": feat["history"],
            "rolling_metrics": {
                "likes_per_min": feat["likes_per_min"],
                "comments_per_min": feat["comments_per_min"],
                "shares_per_min": feat["shares_per_min"],
                "rolling_sentiment": feat["rolling_sentiment"],
                "bot_anomaly_ratio": feat["bot_anomaly_ratio"],
                "real_views": feat.get("real_views", 0),
                "real_likes": feat.get("real_likes", 0),
                "real_comments": feat.get("real_comments", 0),
                "latest_delta_views": feat.get("latest_delta_views", 0),
                "latest_delta_likes": feat.get("latest_delta_likes", 0),
                "lookup_latency_ms": feat["lookup_latency_ms"],
            },
            "video_id": feat.get("video_id"),
            "video_title": feat.get("video_title"),
            "channel_title": feat.get("channel_title"),
            "recent_comments": feat.get("recent_comments", []),
            "recent_events": ticker,
        }

    def list_creators_feed(self) -> dict[str, Any]:
        """Return all live-ingested creators with rolling telemetry and recent ticker events."""
        with self._lock:
            ids = list(self._creators.keys())
            ticker = list(self._global_ticker)[:20]
            feed_status = self.live_feed_status
            feed_error = self.live_feed_error
            last_polled = self.last_polled_at

        creators = [c for cid in ids if (c := self.get_live_features(cid)) is not None]
        creators.sort(
            key=lambda c: (
                0 if c.get("is_beauty_creator") else 1,
                -int(c.get("ad_readiness_score", 0)),
                -int(c.get("median_recent_views", 0)),
            )
        )
        youtube_api_configured = bool(os.getenv("YOUTUBE_API_KEY"))
        return {
            "store_mode": self.backend_mode,
            "ingestion_mode": "live",
            "youtube_api_configured": youtube_api_configured,
            "youtube_live_active": bool(creators) and youtube_api_configured,
            "live_feed_status": feed_status if youtube_api_configured else "live_feed_unavailable",
            "live_feed_error": (
                feed_error
                if youtube_api_configured
                else "YOUTUBE_API_KEY is not configured. Live YouTube feed unavailable."
            ),
            "last_polled_at": last_polled,
            "youtube_videos_tracked": len(creators),
            "creators": creators,
            "ticker": ticker,
        }


feature_store = VelocityFeatureStore()
