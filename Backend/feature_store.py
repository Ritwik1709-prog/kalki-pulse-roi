"""Dual-mode sub-millisecond Velocity Feature Store (Redis + Thread-Safe In-Memory Fallback)."""

from __future__ import annotations

import json
import os
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

try:
    import redis  # type: ignore
except ImportError:
    redis = None  # type: ignore

ROOT_DIR = Path(__file__).resolve().parents[1]
PROTO_CSV_PATH = ROOT_DIR / "data_science" / "data" / "raw" / "prototype" / "influencer_marketing_roi_dataset.csv"


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
    data_source: str = "protobuf_replay"
    video_id: str | None = None
    video_title: str | None = None
    channel_title: str | None = None
    real_views: int = 0
    real_likes: int = 0
    real_comments: int = 0
    latest_delta_views: int = 0
    latest_delta_likes: int = 0
    recent_comments: list[dict[str, Any]] = field(default_factory=list)


CURATED_CREATORS: list[dict[str, Any]] = [
    {
        "influencer_id": "@diya_skincare",
        "display_name": "Diya Nair",
        "platform": "YouTube",
        "niche": "Skincare",
        "followers": 540000,
        "likes_per_min": 410.0,
        "comments_per_min": 88.0,
        "shares_per_min": 39.0,
        "sentiment": 0.88,
    },
    {
        "influencer_id": "@rohan_grooming",
        "display_name": "Rohan Kapoor",
        "platform": "YouTube",
        "niche": "Haircare",
        "followers": 420000,
        "likes_per_min": 295.0,
        "comments_per_min": 52.0,
        "shares_per_min": 24.0,
        "sentiment": 0.79,
    },
    {
        "influencer_id": "@meera_glam",
        "display_name": "Meera Hegde",
        "platform": "YouTube Shorts",
        "niche": "Makeup",
        "followers": 690000,
        "likes_per_min": 640.0,
        "comments_per_min": 82.0,
        "shares_per_min": 74.0,
        "sentiment": 0.86,
    },
]


class VelocityFeatureStore:
    """Tracks rolling 1-hour social engagement velocity and sentiment per creator."""

    def __init__(self, redis_url: str | None = None) -> None:
        self._lock = threading.RLock()
        self._creators: dict[str, CreatorRecord] = {}
        self._global_ticker: deque[dict[str, Any]] = deque(maxlen=40)
        self._watched_creator_id: str | None = None
        self._redis_client: Any = None
        self.backend_mode = "in_memory_sliding_window"

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

        self._seed_initial_creators()

    def _seed_initial_creators(self) -> None:
        now_ts = time.time()
        now_iso = datetime.now(timezone.utc).isoformat()

        for item in CURATED_CREATORS:
            cid = item["influencer_id"]
            rec = CreatorRecord(
                influencer_id=cid,
                display_name=item["display_name"],
                platform=item["platform"],
                niche=item["niche"],
                followers=item["followers"],
                base_likes_per_min=item["likes_per_min"],
                base_comments_per_min=item["comments_per_min"],
                base_shares_per_min=item["shares_per_min"],
                base_sentiment=item["sentiment"],
                total_events=12,
            )
            # Pre-populate 12 historical points so live charts draw immediately
            for step in range(12):
                jitter = 0.88 + ((step * 7) % 5) * 0.06
                pt = {
                    "event_id": f"seed_{cid}_{step}",
                    "influencer_id": cid,
                    "platform": item["platform"],
                    "ts": now_ts - (11 - step) * 4.0,
                    "time_label": datetime.fromtimestamp(now_ts - (11 - step) * 4.0, tz=timezone.utc).strftime("%H:%M:%S"),
                    "timestamp": now_iso,
                    "likes_delta": round(item["likes_per_min"] * jitter),
                    "comments_delta": round(item["comments_per_min"] * jitter),
                    "shares_delta": round(item["shares_per_min"] * jitter),
                    "estimated_sentiment": round(min(0.98, item["sentiment"] * (0.95 + (step % 3) * 0.03)), 3),
                    "is_bot_spike": False,
                }
                rec.events.append(pt)
            self._creators[cid] = rec
            self._global_ticker.append(rec.events[-1])

        # Augment with real sampled profiles from Prototyping dataset if present
        if PROTO_CSV_PATH.exists():
            try:
                df = pd.read_csv(PROTO_CSV_PATH, nrows=60)
                seen_combos: set[tuple[str, str]] = set()
                idx = 0
                for _, row in df.iterrows():
                    plat_raw = str(row.get("platform", "YouTube")).strip()
                    if "tiktok" in plat_raw.lower():
                        plat = "YouTube Shorts"
                    elif "youtube" in plat_raw.lower():
                        plat = "YouTube"
                    else:
                        continue
                    cat = str(row.get("influencer_category", "Beauty"))
                    combo = (plat, cat)
                    if combo in seen_combos:
                        continue
                    seen_combos.add(combo)
                    idx += 1
                    plat_slug = "ys" if plat == "YouTube Shorts" else plat.lower()[:2]
                    cid = f"@{cat.lower().replace(' ', '_')}_{plat_slug}_{idx:02d}"
                    if cid in self._creators:
                        continue
                    reach = int(row.get("estimated_reach", 250000))
                    eng = int(row.get("engagements", 18000))
                    dur = max(1, int(row.get("campaign_duration_days", 14)))
                    lpm = max(45.0, min(950.0, round(eng / (dur * 18.0), 1)))
                    cpm = max(8.0, round(lpm * 0.14, 1))
                    spm = max(4.0, round(lpm * 0.08, 1))
                    sent = round(0.65 + (idx % 5) * 0.05, 2)
                    rec = CreatorRecord(
                        influencer_id=cid,
                        display_name=f"{cat} Creator ({plat})",
                        platform=plat,
                        niche=cat,
                        followers=max(25000, reach),
                        base_likes_per_min=lpm,
                        base_comments_per_min=cpm,
                        base_shares_per_min=spm,
                        base_sentiment=min(0.95, sent),
                        total_events=6,
                    )
                    for step in range(6):
                        rec.events.append(
                            {
                                "event_id": f"proto_{cid}_{step}",
                                "influencer_id": cid,
                                "platform": plat,
                                "ts": now_ts - (5 - step) * 4.0,
                                "time_label": datetime.fromtimestamp(
                                    now_ts - (5 - step) * 4.0, tz=timezone.utc
                                ).strftime("%H:%M:%S"),
                                "timestamp": now_iso,
                                "likes_delta": round(lpm),
                                "comments_delta": round(cpm),
                                "shares_delta": round(spm),
                                "estimated_sentiment": rec.base_sentiment,
                                "is_bot_spike": False,
                            }
                        )
                    self._creators[cid] = rec
                    if len(self._creators) >= 12:
                        break
            except Exception:
                pass

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
        """Ingest a decoded Protobuf EngagementEvent into the 1-hour sliding window."""
        now_ts = time.time()
        meta = metadata or {}
        data_source = str(meta.get("data_source", "protobuf_replay"))
        norm_platform = "YouTube Shorts" if "tiktok" in platform.lower() else (platform or "YouTube")
        is_bot_spike = (
            data_source == "protobuf_replay"
            and (likes_delta > 3500 or (shares_delta > 0 and likes_delta / max(shares_delta, 1) > 95))
        )

        # Lightweight instantaneous projected ROI signal for smooth live Recharts tracking
        short_mult = 1.12 if norm_platform == "YouTube Shorts" else (1.04 if norm_platform == "YouTube" else 1.0)
        live_roi_pct = round(
            max(
                -45.0,
                min(
                    8500.0,
                    (120.0 + (likes_delta * 1.45 + shares_delta * 5.2) * max(0.25, estimated_sentiment + 0.35))
                    * short_mult,
                ),
            ),
            1,
        )

        views_delta_val = int(meta.get("real_delta_views") or 0)
        likes_delta_real = int(meta.get("real_delta_likes") or 0)
        source_tag = str(
            meta.get("platform_key")
            or ("youtube_api_v3" if data_source == "youtube_api_v3" else "protobuf_replay")
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
                    display_name=str(meta.get("channel_title") or influencer_id.lstrip("@").replace("_", " ").title()),
                    platform=norm_platform,
                    niche=str(meta.get("niche") or "Skincare"),
                    followers=int(meta.get("estimated_reach") or 350000),
                    base_likes_per_min=max(20.0, float(likes_delta)),
                    base_comments_per_min=max(4.0, float(comments_delta)),
                    base_shares_per_min=max(2.0, float(shares_delta)),
                    base_sentiment=float(estimated_sentiment),
                )
                self._creators[influencer_id] = rec

            if meta:
                rec.data_source = data_source
                rec.platform = norm_platform
                if meta.get("video_id"):
                    rec.video_id = str(meta["video_id"])
                if meta.get("video_title"):
                    rec.video_title = str(meta["video_title"])
                if meta.get("channel_title"):
                    rec.channel_title = str(meta["channel_title"])
                    rec.display_name = str(meta["channel_title"])
                if meta.get("niche"):
                    rec.niche = str(meta["niche"])
                if meta.get("estimated_reach"):
                    rec.followers = int(meta["estimated_reach"])
                if meta.get("views") is not None:
                    rec.real_views = int(meta["views"])
                if meta.get("likes") is not None:
                    rec.real_likes = int(meta["likes"])
                if meta.get("comments_count") is not None:
                    rec.real_comments = int(meta["comments_count"])
                if meta.get("real_delta_views") is not None:
                    rec.latest_delta_views = int(meta["real_delta_views"])
                if meta.get("real_delta_likes") is not None:
                    rec.latest_delta_likes = int(meta["real_delta_likes"])
                if meta.get("recent_comments"):
                    rec.recent_comments = list(meta["recent_comments"])

            rec.events.append(entry)
            rec.total_events += 1
            if is_bot_spike:
                rec.bot_flagged_events += 1
            self._global_ticker.appendleft(entry)

            # Prune events older than 1 hour (3600s)
            cutoff = now_ts - 3600.0
            while len(rec.events) > 12 and rec.events[0]["ts"] < cutoff:
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

    def get_live_features(self, influencer_id: str) -> dict[str, Any]:
        """Return <1ms rolling aggregates and recent chart points for a creator."""
        t0 = time.perf_counter()
        with self._lock:
            rec = self._creators.get(influencer_id)
            if rec is None:
                # Provide deterministic baseline for free-text custom handles
                return {
                    "influencer_id": influencer_id,
                    "display_name": influencer_id.lstrip("@").replace("_", " ").title() or "Custom Creator",
                    "platform": "YouTube",
                    "niche": "Skincare",
                    "followers": 310000,
                    "likes_per_min": 380.0,
                    "comments_per_min": 62.0,
                    "shares_per_min": 31.0,
                    "rolling_sentiment": 0.82,
                    "total_events": 1,
                    "bot_anomaly_ratio": 0.02,
                    "history": [],
                    "lookup_latency_ms": round((time.perf_counter() - t0) * 1000.0, 4),
                    "store_mode": self.backend_mode,
                }

            recent = list(rec.events)
            # Filter anomalous bot bursts when computing verified velocity averages
            clean_events = [e for e in recent if not e.get("is_bot_spike")] or recent
            n = len(clean_events)
            likes_pm = sum(e["likes_delta"] for e in clean_events) / max(1, n)
            comments_pm = sum(e["comments_delta"] for e in clean_events) / max(1, n)
            shares_pm = sum(e["shares_delta"] for e in clean_events) / max(1, n)
            sentiment = sum(e["estimated_sentiment"] for e in clean_events) / max(1, n)
            bot_ratio = rec.bot_flagged_events / max(1, rec.total_events)

            history = [
                {
                    "time": e["time_label"],
                    "likes_per_min": e["likes_delta"],
                    "shares_per_min": e["shares_delta"],
                    "comments_per_min": e["comments_delta"],
                    "views_delta": e.get("views_delta", 0),
                    "sentiment": e["estimated_sentiment"],
                    "live_roi_pct": e.get("live_roi_pct", round(120.0 + e["likes_delta"] * 1.4, 1)),
                    "source_tag": e.get("source_tag", rec.data_source),
                    "is_bot_spike": e["is_bot_spike"],
                }
                for e in recent[-30:]
            ]

            return {
                "influencer_id": rec.influencer_id,
                "display_name": rec.display_name,
                "platform": rec.platform,
                "niche": rec.niche,
                "followers": rec.followers,
                "likes_per_min": round(likes_pm, 1),
                "comments_per_min": round(comments_pm, 1),
                "shares_per_min": round(shares_pm, 1),
                "rolling_sentiment": round(sentiment, 3),
                "total_events": rec.total_events,
                "bot_anomaly_ratio": round(bot_ratio, 4),
                "history": history,
                "time_series": history,
                "lookup_latency_ms": round((time.perf_counter() - t0) * 1000.0, 4),
                "store_mode": self.backend_mode,
                "data_source": rec.data_source,
                "video_id": rec.video_id,
                "video_title": rec.video_title,
                "channel_title": rec.channel_title,
                "real_views": rec.real_views,
                "real_likes": rec.real_likes,
                "real_comments": rec.real_comments,
                "latest_delta_views": rec.latest_delta_views,
                "latest_delta_likes": rec.latest_delta_likes,
                "recent_comments": rec.recent_comments,
            }

    def set_watched_creator(self, influencer_id: str) -> None:
        """Remember the currently inspected creator so 1.5s pulse updates track it cleanly."""
        with self._lock:
            self._watched_creator_id = influencer_id

    def get_watched_snapshot_params(self) -> dict[str, Any] | None:
        """Return latest velocity + metadata for the watched creator (used by 1.5s pulse loop)."""
        with self._lock:
            cid = self._watched_creator_id
            if not cid or cid not in self._creators:
                # Default to first live YouTube creator if available
                cid = next(
                    (k for k, v in self._creators.items() if v.data_source == "youtube_api_v3"),
                    None,
                )
            if not cid:
                return None
            rec = self._creators[cid]
            last_ev = rec.events[-1] if rec.events else None
            return {
                "influencer_id": rec.influencer_id,
                "platform": rec.platform,
                "data_source": rec.data_source,
                "video_id": rec.video_id,
                "video_title": rec.video_title,
                "channel_title": rec.channel_title,
                "niche": rec.niche,
                "estimated_reach": rec.followers,
                "views": rec.real_views,
                "likes": rec.real_likes,
                "comments_count": rec.real_comments,
                "real_delta_views": rec.latest_delta_views,
                "real_delta_likes": rec.latest_delta_likes,
                "recent_comments": list(rec.recent_comments),
                "latest_comment": rec.recent_comments[0]["text"] if rec.recent_comments else "",
                "likes_base": last_ev["likes_delta"] if last_ev else rec.base_likes_per_min,
                "comments_base": last_ev["comments_delta"] if last_ev else rec.base_comments_per_min,
                "shares_base": last_ev["shares_delta"] if last_ev else rec.base_shares_per_min,
                "sentiment": last_ev["estimated_sentiment"] if last_ev else rec.base_sentiment,
            }

    def get_creator_telemetry(self, influencer_id: str) -> dict[str, Any]:
        """Return 30-point sliding time series, rolling metrics, and recent events for 1.5s polling."""
        self.set_watched_creator(influencer_id)
        feat = self.get_live_features(influencer_id)
        with self._lock:
            ticker = list(self._global_ticker)[:20]
        youtube_live_active = any(
            c.data_source == "youtube_api_v3" for c in self._creators.values()
        )
        return {
            "influencer_id": feat["influencer_id"],
            "platform": feat["platform"],
            "data_source": feat.get("data_source", "protobuf_replay"),
            "store_mode": self.backend_mode,
            "youtube_live_active": youtube_live_active,
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
        """Return all tracked creators with current rolling telemetry and recent ticker events."""
        with self._lock:
            ids = list(self._creators.keys())
            ticker = list(self._global_ticker)[:20]
        creators = [self.get_live_features(cid) for cid in ids]
        # Surface live YouTube & YouTube Shorts API v3 creators first, then Instagram/dataset profiles
        creators.sort(key=lambda c: 0 if c.get("data_source") == "youtube_api_v3" else 1)
        youtube_live = [c for c in creators if c.get("data_source") == "youtube_api_v3"]
        return {
            "store_mode": self.backend_mode,
            "ingestion_mode": os.getenv("INGESTION_MODE", "embedded_replay"),
            "youtube_live_active": bool(youtube_live),
            "youtube_videos_tracked": len(youtube_live),
            "creators": creators,
            "ticker": ticker,
        }


feature_store = VelocityFeatureStore()
