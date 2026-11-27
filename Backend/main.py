"""FastAPI application entry point for KALKI Pulse Gateway."""

from __future__ import annotations

import asyncio
import os
import random
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from auth import router as auth_router
from data_science_routes import router as ds_router
from database import init_db
from feature_store import feature_store
from inference import inference_engine
from prediction_routes import router as prediction_router
from data_pipeline.connectors.youtube_connector import poll_youtube_video_stats
from data_pipeline.consumer.redis_aggregator import ingest_protobuf_packet
from data_pipeline.simulator.prototype_stream_producer import (
    build_live_youtube_protobuf_event,
    build_protobuf_event,
)


async def _embedded_replay_loop(allowed_platforms: tuple[str, ...] | None = None) -> None:
    """Continuously replay binary Protobuf EngagementEvent packets."""
    interval = 2.0 if allowed_platforms else 1.5
    while True:
        try:
            raw_proto = build_protobuf_event(allowed_platforms=allowed_platforms)
            ingest_protobuf_packet(raw_proto, feature_store)
        except Exception:
            pass
        await asyncio.sleep(interval)


async def _poll_youtube_once(*, include_comments: bool = False) -> list[dict]:
    """Fetch real YouTube Data API v3 stats/comments and stream through Protobuf -> FeatureStore."""
    items = await poll_youtube_video_stats(include_comments=include_comments)
    for item in items:
        raw_proto = build_live_youtube_protobuf_event(item)
        ingest_protobuf_packet(raw_proto, feature_store, metadata=item)
    return items


async def _youtube_live_poller_loop() -> None:
    """Poll real YouTube & YouTube Shorts stats every 12s and commentThreads every 60s."""
    cycle = 0
    while True:
        await asyncio.sleep(12.0)
        cycle += 1
        try:
            await _poll_youtube_once(include_comments=(cycle % 5 == 0))
        except Exception:
            pass


async def _watched_oscilloscope_loop() -> None:
    """Publish a 1.5s timestamped Protobuf snapshot for the active creator so Recharts streams smoothly."""
    while True:
        await asyncio.sleep(1.5)
        try:
            snap = feature_store.get_watched_snapshot_params()
            if not snap:
                continue
            jitter = random.uniform(0.93, 1.09)
            if snap.get("data_source") == "youtube_api_v3" and snap.get("video_id"):
                plat_key = "youtube_shorts" if snap.get("platform") == "YouTube Shorts" else "youtube"
                item = {
                    "video_id": snap["video_id"],
                    "influencer_id": snap["influencer_id"],
                    "platform": snap["platform"],
                    "platform_key": plat_key,
                    "channel_title": snap["channel_title"],
                    "video_title": snap["video_title"],
                    "niche": snap["niche"],
                    "estimated_reach": snap["estimated_reach"],
                    "views": snap["views"],
                    "likes": snap["likes"],
                    "comments_count": snap["comments_count"],
                    "real_delta_views": snap["real_delta_views"],
                    "real_delta_likes": snap["real_delta_likes"],
                    "recent_comments": snap["recent_comments"],
                    "latest_comment": snap["latest_comment"],
                    "likes_per_min_signal": max(15, int(round(snap["likes_base"] * jitter))),
                    "comments_per_min_signal": max(2, int(round(snap["comments_base"] * jitter))),
                    "shares_per_min_signal": max(3, int(round(snap["shares_base"] * jitter))),
                    "estimated_sentiment": round(
                        max(-0.95, min(0.98, snap["sentiment"] + random.uniform(-0.02, 0.02))),
                        3,
                    ),
                    "data_source": "youtube_api_v3",
                }
                raw_proto = build_live_youtube_protobuf_event(item)
                ingest_protobuf_packet(raw_proto, feature_store, metadata=item)
            else:
                raw_proto = build_protobuf_event(
                    snap["influencer_id"],
                    platform_override=snap["platform"],
                )
                ingest_protobuf_packet(raw_proto, feature_store)
        except Exception:
            pass


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Initialize SQLite schema, warm up ONNX sessions, and start live/replay streams."""
    init_db()
    inference_engine.load()

    mode = os.getenv("INGESTION_MODE", "embedded_replay")
    has_yt_key = bool(os.getenv("YOUTUBE_API_KEY"))
    tasks: list[asyncio.Task[None]] = []

    if mode == "live" and has_yt_key:
        try:
            await _poll_youtube_once(include_comments=True)
        except Exception:
            pass
        tasks.append(asyncio.create_task(_youtube_live_poller_loop()))
        tasks.append(asyncio.create_task(_watched_oscilloscope_loop()))
    elif mode in {"embedded_replay", "live"}:
        tasks.append(asyncio.create_task(_embedded_replay_loop(("YouTube", "YouTube Shorts"))))
        tasks.append(asyncio.create_task(_watched_oscilloscope_loop()))

    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title="KALKI Pulse Gateway",
    version="2.0.0",
    lifespan=lifespan,
)

raw_frontend_origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173")
frontend_origins = [
    origin.strip() for origin in raw_frontend_origins.split(",") if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(ds_router)
app.include_router(prediction_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    """Health-check endpoint for gateway readiness monitoring."""
    return {
        "status": "online",
        "engine": "KALKI Pulse Gateway",
        "onnx_loaded": str(inference_engine.loaded).lower(),
        "feature_store": feature_store.backend_mode,
        "ingestion_mode": os.getenv("INGESTION_MODE", "embedded_replay"),
        "youtube_live": str(bool(os.getenv("YOUTUBE_API_KEY"))).lower(),
    }
