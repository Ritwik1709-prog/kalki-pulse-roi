"""Binary Protobuf EngagementEvent Producer (Embedded Replay & Apache Kafka modes)."""

from __future__ import annotations

import os
import random
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[2]
SCHEMA_DIR = ROOT_DIR / "data_pipeline" / "schemas"
if str(SCHEMA_DIR) not in sys.path:
    sys.path.insert(0, str(SCHEMA_DIR))

import engagement_event_pb2  # type: ignore

try:
    from confluent_kafka import Producer  # type: ignore
except ImportError:
    Producer = None  # type: ignore

INGESTION_MODE = os.getenv("INGESTION_MODE", "embedded_replay")
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
KAFKA_TOPIC = os.getenv("KAFKA_TOPIC", "influencer.engagement.events")

CREATOR_BASELINES = [
    {"id": "@diya_skincare", "platform": "YouTube", "likes": 410, "comments": 88, "shares": 39, "sent": 0.88},
    {"id": "@rohan_grooming", "platform": "YouTube", "likes": 295, "comments": 52, "shares": 24, "sent": 0.79},
    {"id": "@meera_glam", "platform": "YouTube Shorts", "likes": 640, "comments": 82, "shares": 74, "sent": 0.86},
]


def build_protobuf_event(
    influencer_id: str | None = None,
    *,
    burst_multiplier: float = 1.0,
    simulate_bot_spike: bool = False,
    platform_override: str | None = None,
    allowed_platforms: tuple[str, ...] | None = None,
) -> bytes:
    """Serialize a binary EngagementEvent Protobuf packet."""
    pool = (
        [c for c in CREATOR_BASELINES if c["platform"] in allowed_platforms]
        if allowed_platforms
        else CREATOR_BASELINES
    ) or CREATOR_BASELINES
    base = next(
        (c for c in CREATOR_BASELINES if c["id"] == influencer_id),
        random.choice(pool),
    )
    target_id = influencer_id or base["id"]
    platform = platform_override or base["platform"]

    jitter = random.uniform(0.84, 1.22)
    if simulate_bot_spike:
        likes = int(base["likes"] * random.uniform(7.5, 11.0))
        comments = int(base["comments"] * 0.4)
        shares = max(1, int(base["shares"] * 0.25))
        sentiment = round(random.uniform(-0.35, 0.15), 3)
    else:
        likes = max(12, int(base["likes"] * jitter * burst_multiplier))
        comments = max(2, int(base["comments"] * jitter * burst_multiplier))
        shares = max(1, int(base["shares"] * jitter * burst_multiplier))
        sentiment = round(max(-1.0, min(1.0, base["sent"] + random.uniform(-0.08, 0.08))), 3)

    evt = engagement_event_pb2.EngagementEvent(
        event_id=f"evt_{uuid.uuid4().hex[:10]}",
        influencer_id=target_id,
        platform=platform,
        timestamp=datetime.now(timezone.utc).isoformat(),
        likes_delta=likes,
        comments_delta=comments,
        shares_delta=shares,
        estimated_sentiment=sentiment,
    )
    return evt.SerializeToString()


def build_live_youtube_protobuf_event(yt_item: dict[str, Any]) -> bytes:
    """Serialize live YouTube / YouTube Shorts Data API v3 stats into binary Protobuf."""
    evt = engagement_event_pb2.EngagementEvent(
        event_id=f"yt_{yt_item['video_id']}_{uuid.uuid4().hex[:6]}",
        influencer_id=str(yt_item["influencer_id"]),
        platform=str(yt_item.get("platform", "YouTube")),
        timestamp=datetime.now(timezone.utc).isoformat(),
        likes_delta=int(yt_item.get("likes_per_min_signal", 120)),
        comments_delta=int(yt_item.get("comments_per_min_signal", 18)),
        shares_delta=int(yt_item.get("shares_per_min_signal", 10)),
        estimated_sentiment=float(yt_item.get("estimated_sentiment", 0.82)),
    )
    return evt.SerializeToString()


def publish_to_kafka(payload_bytes: bytes, key: str = "") -> bool:
    """Publish serialized Protobuf bytes to Kafka when INGESTION_MODE=kafka."""
    if Producer is None:
        return False
    conf: dict[str, Any] = {"bootstrap.servers": KAFKA_BOOTSTRAP_SERVERS, "socket.timeout.ms": 1500}
    producer = Producer(conf)
    producer.produce(KAFKA_TOPIC, key=key.encode("utf-8"), value=payload_bytes)
    producer.flush(2.0)
    return True
