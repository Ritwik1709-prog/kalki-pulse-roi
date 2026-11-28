"""FastAPI application entry point for KALKI Pulse Gateway (100% Live Data Mode)."""

from __future__ import annotations

import asyncio
import os
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
from data_pipeline.connectors.marketplace_connector import get_live_marketplace_feed
from data_pipeline.connectors.youtube_connector import poll_youtube_video_stats
from data_pipeline.consumer.redis_aggregator import ingest_protobuf_packet
from data_pipeline.simulator.prototype_stream_producer import build_live_youtube_protobuf_event


async def _poll_youtube_once(*, include_comments: bool = False) -> list[dict]:
    """Fetch real YouTube Data API v3 stats/comments and stream through Protobuf -> FeatureStore."""
    items = await poll_youtube_video_stats(include_comments=include_comments)
    for item in items:
        raw_proto = build_live_youtube_protobuf_event(item)
        ingest_protobuf_packet(raw_proto, feature_store, metadata=item)
    feature_store.set_live_status("live", None)
    return items


async def _youtube_live_poller_loop() -> None:
    """Poll real YouTube & YouTube Shorts stats every 20s and commentThreads every 100s."""
    cycle = 0
    while True:
        await asyncio.sleep(20.0)
        cycle += 1
        try:
            await _poll_youtube_once(include_comments=(cycle % 5 == 0))
        except Exception as exc:
            feature_store.set_live_status("live_feed_unavailable", f"YouTube poll error: {exc}")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Initialize PostgreSQL schema, warm up ONNX sessions, and start live API pollers."""
    init_db()
    inference_engine.load()

    has_yt_key = bool(os.getenv("YOUTUBE_API_KEY"))
    tasks: list[asyncio.Task[None]] = []

    if has_yt_key:
        try:
            await _poll_youtube_once(include_comments=True)
        except Exception as exc:
            feature_store.set_live_status("live_feed_unavailable", f"Initial YouTube sync failed: {exc}")
        try:
            await get_live_marketplace_feed()
        except Exception:
            pass
        tasks.append(asyncio.create_task(_youtube_live_poller_loop()))
    else:
        feature_store.set_live_status(
            "live_feed_unavailable",
            "YOUTUBE_API_KEY is not configured. Live YouTube & creator verification feeds require an API key.",
        )

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
    version="3.0.0",
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
def health() -> dict[str, str | None]:
    """Honest health-check endpoint reporting live YouTube & engine readiness."""
    has_yt_key = bool(os.getenv("YOUTUBE_API_KEY"))
    live_status = feature_store.live_feed_status if has_yt_key else "live_feed_unavailable"
    return {
        "status": "online" if live_status == "live" else "live_feed_unavailable",
        "engine": "KALKI Pulse Gateway",
        "onnx_loaded": str(inference_engine.loaded).lower(),
        "feature_store": feature_store.backend_mode,
        "ingestion_mode": "live",
        "youtube_live": str(has_yt_key and live_status == "live").lower(),
        "live_feed_status": live_status,
        "live_feed_error": feature_store.live_feed_error,
    }
