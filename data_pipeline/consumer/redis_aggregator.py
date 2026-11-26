"""Binary Protobuf EngagementEvent Consumer -> VelocityFeatureStore Aggregator."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[2]
SCHEMA_DIR = ROOT_DIR / "data_pipeline" / "schemas"
BACKEND_DIR = ROOT_DIR / "Backend"

for p in (SCHEMA_DIR, BACKEND_DIR):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

import engagement_event_pb2  # type: ignore

try:
    from confluent_kafka import Consumer  # type: ignore
except ImportError:
    Consumer = None  # type: ignore


def ingest_protobuf_packet(
    raw_bytes: bytes,
    store: Any,
    *,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Decode binary EngagementEvent Protobuf packet and commit to VelocityFeatureStore."""
    evt = engagement_event_pb2.EngagementEvent()
    evt.ParseFromString(raw_bytes)
    return store.record_event(
        event_id=evt.event_id,
        influencer_id=evt.influencer_id,
        platform=evt.platform,
        timestamp=evt.timestamp,
        likes_delta=evt.likes_delta,
        comments_delta=evt.comments_delta,
        shares_delta=evt.shares_delta,
        estimated_sentiment=evt.estimated_sentiment,
        metadata=metadata,
    )


def run_kafka_consumer_loop(store: Any) -> None:
    """Standalone Kafka consumer loop activated when INGESTION_MODE=kafka."""
    if Consumer is None:
        raise RuntimeError("confluent-kafka is not installed.")
    bootstrap = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    topic = os.getenv("KAFKA_TOPIC", "influencer.engagement.events")
    consumer = Consumer(
        {
            "bootstrap.servers": bootstrap,
            "group.id": "kalki-pulse-aggregator",
            "auto.offset.reset": "latest",
        }
    )
    consumer.subscribe([topic])
    try:
        while True:
            msg = consumer.poll(1.0)
            if msg is None or msg.error():
                continue
            raw = msg.value()
            if raw:
                ingest_protobuf_packet(raw, store)
    finally:
        consumer.close()
