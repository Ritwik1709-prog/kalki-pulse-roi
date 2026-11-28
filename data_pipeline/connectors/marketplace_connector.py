"""Live Nykaa, Tira, Purplle & D2C Marketplace Campaign Feed and Real-Time CPC Calibration."""

from __future__ import annotations

import asyncio
import json
import os
import re
import statistics
import threading
import time
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

CLEANING_REPORT_PATH = ROOT_DIR / "data_science" / "data" / "processed" / "cleaning_report.json"

CACHE_TTL_SECONDS = 300.0  # 5-minute TTL cache to keep external API/rate limits safe

_CACHE_LOCK = threading.RLock()
_FEED_CACHE: dict[str, Any] | None = None
_FEED_CACHE_TS: float = 0.0

_CHANNEL_CONFIGS: list[dict[str, Any]] = [
    {
        "channel": "Nykaa",
        "key": "nykaa",
        "color": "#FC2779",
        "storefront_url": "https://www.nykaa.com/",
        "youtube_handles": ["Nykaa", "NykaaArmy"],
        "base_cpc_inr": 24.5,
        "base_cpm_inr": 215.0,
        "base_cvr_pct": 4.4,
        "base_ctr_pct": 3.1,
        "category_aov_inr": {
            "Skincare": 1180,
            "Makeup": 890,
            "Haircare": 760,
            "Fragrance": 2250,
        },
    },
    {
        "channel": "Tira",
        "key": "tira",
        "color": "#ED1C24",
        "storefront_url": "https://www.tirabeauty.com/",
        "youtube_handles": ["tirabeauty", "TiraBeauty"],
        "base_cpc_inr": 28.0,
        "base_cpm_inr": 245.0,
        "base_cvr_pct": 3.9,
        "base_ctr_pct": 2.8,
        "category_aov_inr": {
            "Skincare": 1490,
            "Makeup": 1240,
            "Haircare": 980,
            "Fragrance": 3100,
        },
    },
    {
        "channel": "Purplle",
        "key": "purplle",
        "color": "#C084FC",
        "storefront_url": "https://www.purplle.com/",
        "youtube_handles": ["Purplle", "purplle"],
        "base_cpc_inr": 17.5,
        "base_cpm_inr": 155.0,
        "base_cvr_pct": 3.6,
        "base_ctr_pct": 2.9,
        "category_aov_inr": {
            "Skincare": 699,
            "Makeup": 549,
            "Haircare": 499,
            "Fragrance": 1199,
        },
    },
    {
        "channel": "D2C Web",
        "key": "marketing_campaign",
        "color": "#00F0FF",
        "storefront_url": "",
        "youtube_handles": [],
        "base_cpc_inr": 31.0,
        "base_cpm_inr": 265.0,
        "base_cvr_pct": 2.7,
        "base_ctr_pct": 2.4,
        "category_aov_inr": {
            "Skincare": 1350,
            "Makeup": 999,
            "Haircare": 850,
            "Fragrance": 2400,
        },
    },
]

_INR_PRICE_RE = re.compile(r"(?:₹|Rs\.?\s*)([0-9][0-9,]{2,4})")
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_SALE_CUE_RE = re.compile(
    r"(?:pink\s+friday|hot\s+pink|pink\s+love|i\s+heart\s+beauty|sale|upto\s+\d+%|up\s+to\s+\d+%\s+off|flat\s+\d+%|flash\s+deal|festive|offer|mega\s+deal)",
    re.IGNORECASE,
)


def _load_dataset_channel_baselines() -> dict[str, dict[str, float]]:
    """Read verified median CTR, CVR, ROI & AOV from cleaning_report.json."""
    if not CLEANING_REPORT_PATH.exists():
        return {}
    try:
        with open(CLEANING_REPORT_PATH, "r", encoding="utf-8") as f:
            report = json.load(f)
        out: dict[str, dict[str, float]] = {}
        for item in report.get("channel_comparison", []):
            key = str(item.get("key", "")).lower()
            if key:
                out[key] = {
                    "median_ctr_pct": float(item.get("median_ctr_pct", 0.0)),
                    "median_conversion_rate_pct": float(item.get("median_conversion_rate_pct", 0.0)),
                    "median_roi_pct": float(item.get("median_roi_pct", 0.0)),
                    "median_aov_inr": float(item.get("median_aov_inr", 0.0)),
                    "campaigns": int(item.get("campaigns", 0)),
                }
        return out
    except Exception:
        return {}


async def _probe_public_storefront(url: str) -> dict[str, Any]:
    """Fetch public storefront homepage signals honestly (no anti-bot bypass)."""
    if not url:
        return {
            "storefront_status": "not_applicable",
            "page_title": "Direct-to-Consumer Brand Storefront",
            "active_promos": [],
            "live_prices_inr": [],
            "observed_median_price_inr": None,
        }

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
    }
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(connect=3.0, read=5.0, write=3.0, pool=3.0),
            follow_redirects=True,
        ) as client:
            resp = await asyncio.wait_for(client.get(url, headers=headers), timeout=6.0)
            if resp.status_code != 200:
                return {
                    "storefront_status": f"http_{resp.status_code}",
                    "page_title": "",
                    "active_promos": [],
                    "live_prices_inr": [],
                    "observed_median_price_inr": None,
                }
            html = resp.text[:160000]
    except Exception as exc:
        return {
            "storefront_status": f"error:{type(exc).__name__}",
            "page_title": "",
            "active_promos": [],
            "live_prices_inr": [],
            "observed_median_price_inr": None,
        }

    title_match = _TITLE_RE.search(html)
    page_title = unescape(re.sub(r"\s+", " ", title_match.group(1)).strip())[:140] if title_match else ""
    promos = list(dict.fromkeys(m.group(0).strip() for m in _SALE_CUE_RE.finditer(html)))[:4]

    prices: list[int] = []
    for m in _INR_PRICE_RE.finditer(html):
        try:
            val = int(m.group(1).replace(",", ""))
            if 149 <= val <= 15000:
                prices.append(val)
        except ValueError:
            continue
    med_price = int(round(statistics.median(prices))) if len(prices) >= 3 else None

    return {
        "storefront_status": "live_http_200",
        "page_title": page_title,
        "active_promos": promos,
        "live_prices_inr": prices[:12],
        "observed_median_price_inr": med_price,
    }


async def _fetch_youtube_brand_campaign_pulse(handles: list[str]) -> dict[str, Any]:
    """Fetch live YouTube Data API v3 brand channel & latest 5 campaign uploads."""
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key or not handles:
        return {
            "yt_status": "no_api_key" if not api_key else "no_brand_handle",
            "handle": None,
            "subscribers": 0,
            "recent_campaign_videos": [],
            "median_campaign_views": 0,
            "avg_engagement_rate_pct": 0.0,
            "active_campaign_title": "",
        }

    async with httpx.AsyncClient(timeout=8.0) as client:
        channel_obj: dict[str, Any] | None = None
        resolved_handle = ""
        for h in handles:
            try:
                ch_resp = await client.get(
                    "https://www.googleapis.com/youtube/v3/channels",
                    params={
                        "part": "snippet,statistics,contentDetails",
                        "forHandle": h,
                        "key": api_key,
                    },
                )
                if ch_resp.status_code == 200:
                    items = ch_resp.json().get("items", [])
                    if items:
                        channel_obj = items[0]
                        resolved_handle = f"@{h}"
                        break
            except Exception:
                continue

        if not channel_obj:
            return {
                "yt_status": "channel_not_found",
                "handle": None,
                "subscribers": 0,
                "recent_campaign_videos": [],
                "median_campaign_views": 0,
                "avg_engagement_rate_pct": 0.0,
                "active_campaign_title": "",
            }

        uploads_id = channel_obj.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
        subs = int(channel_obj.get("statistics", {}).get("subscriberCount", 0) or 0)
        if not uploads_id:
            return {
                "yt_status": "no_uploads",
                "handle": resolved_handle,
                "subscribers": subs,
                "recent_campaign_videos": [],
                "median_campaign_views": 0,
                "avg_engagement_rate_pct": 0.0,
                "active_campaign_title": "",
            }

        try:
            pl_resp = await client.get(
                "https://www.googleapis.com/youtube/v3/playlistItems",
                params={
                    "part": "contentDetails",
                    "playlistId": uploads_id,
                    "maxResults": 5,
                    "key": api_key,
                },
            )
            pl_resp.raise_for_status()
            vids = [
                str(it.get("contentDetails", {}).get("videoId", ""))
                for it in pl_resp.json().get("items", [])
                if it.get("contentDetails", {}).get("videoId")
            ]
            if not vids:
                raise LookupError("Empty playlist")

            v_resp = await client.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={
                    "part": "snippet,statistics",
                    "id": ",".join(vids),
                    "key": api_key,
                },
            )
            v_resp.raise_for_status()
            v_items = v_resp.json().get("items", [])
        except Exception as exc:
            return {
                "yt_status": f"error:{type(exc).__name__}",
                "handle": resolved_handle,
                "subscribers": subs,
                "recent_campaign_videos": [],
                "median_campaign_views": 0,
                "avg_engagement_rate_pct": 0.0,
                "active_campaign_title": "",
            }

    campaigns: list[dict[str, Any]] = []
    view_vals: list[int] = []
    eng_rates: list[float] = []
    for it in v_items:
        snip = it.get("snippet", {})
        st = it.get("statistics", {})
        views = int(st.get("viewCount", 0) or 0)
        likes = int(st.get("likeCount", 0) or 0)
        cmts = int(st.get("commentCount", 0) or 0)
        eng_pct = round(((likes + cmts) / max(1, views)) * 100.0, 2)
        view_vals.append(views)
        eng_rates.append(eng_pct)
        campaigns.append(
            {
                "video_id": str(it.get("id", "")),
                "title": unescape(str(snip.get("title", "")))[:110],
                "published_at": str(snip.get("publishedAt", "")),
                "views": views,
                "likes": likes,
                "engagement_rate_pct": eng_pct,
            }
        )

    med_views = int(round(statistics.median(view_vals))) if view_vals else 0
    avg_eng = round(sum(eng_rates) / max(1, len(eng_rates)), 2) if eng_rates else 0.0
    return {
        "yt_status": "live",
        "handle": resolved_handle,
        "subscribers": subs,
        "recent_campaign_videos": campaigns,
        "median_campaign_views": med_views,
        "avg_engagement_rate_pct": avg_eng,
        "active_campaign_title": campaigns[0]["title"] if campaigns else "",
    }


def _calibrate_channel_metrics(
    cfg: dict[str, Any],
    *,
    storefront: dict[str, Any],
    yt_pulse: dict[str, Any],
    ds_baseline: dict[str, float],
) -> dict[str, Any]:
    """Compute real-time calibrated CPC, CPM, CVR & active campaign pulse from live telemetry."""
    base_cpc = float(cfg["base_cpc_inr"])
    base_cpm = float(cfg["base_cpm_inr"])
    base_cvr = float(cfg["base_cvr_pct"])
    base_ctr = float(cfg["base_ctr_pct"])

    # Modulate CPC & CVR dynamically using live YouTube brand campaign engagement & storefront sale activity
    eng_rate = float(yt_pulse.get("avg_engagement_rate_pct") or 0.0)
    has_sale = bool(storefront.get("active_promos")) or bool(
        _SALE_CUE_RE.search(yt_pulse.get("active_campaign_title", ""))
    )

    # Higher organic brand engagement lowers effective paid CPC and lifts conversion readiness;
    # active seasonal sales increase auction competition (+8% CPC) while lifting CVR (+14%).
    eng_discount = min(0.14, max(-0.08, (eng_rate - 2.2) * 0.025))
    sale_cpc_factor = 1.08 if has_sale else 1.0
    sale_cvr_factor = 1.14 if has_sale else 1.0

    # Blend dataset median CVR/CTR directionally without letting raw synthetic dataset values dominate
    ds_cvr = float(ds_baseline.get("median_conversion_rate_pct") or 0.0)
    ds_factor = 1.0 + max(-0.06, min(0.06, (ds_cvr - 20.5) * 0.04)) if ds_cvr > 0 else 1.0

    live_cpc_inr = round(max(9.0, base_cpc * (1.0 - eng_discount) * sale_cpc_factor), 2)
    cpc_min = round(live_cpc_inr * 0.80, 2)
    cpc_max = round(live_cpc_inr * 1.28, 2)

    live_cvr_pct = round(max(1.5, min(7.5, base_cvr * sale_cvr_factor * ds_factor * (1.0 + eng_discount * 0.6))), 2)
    live_ctr_pct = round(max(1.4, min(6.5, base_ctr * (1.0 + eng_discount * 0.5))), 2)
    active_cpm_inr = round(base_cpm * (1.05 if has_sale else 1.0) * (1.0 - eng_discount * 0.4), 2)

    # Calibrated multiplier relative to base market average (Nykaa highest intent -> Purplle value -> D2C)
    channel_multiplier = round(
        {"nykaa": 1.16, "tira": 1.06, "purplle": 0.96, "marketing_campaign": 0.88}.get(cfg["key"], 1.0)
        * (1.04 if has_sale else 1.0),
        3,
    )

    cat_aov = dict(cfg["category_aov_inr"])
    obs_med = storefront.get("observed_median_price_inr")
    if obs_med:
        cat_aov["Skincare"] = int(round((cat_aov["Skincare"] * 0.6) + (obs_med * 0.4)))

    data_sources: list[str] = []
    if yt_pulse.get("yt_status") == "live" and yt_pulse.get("handle"):
        data_sources.append(f"youtube_api_v3:{yt_pulse['handle']}")
    if storefront.get("storefront_status") == "live_http_200":
        data_sources.append(cfg["storefront_url"].replace("https://www.", "").rstrip("/"))
    if ds_baseline:
        data_sources.append("cleaning_report.json")

    if storefront.get("active_promos"):
        campaign_status = f"Active Sale: {storefront['active_promos'][0]}"
    elif yt_pulse.get("active_campaign_title"):
        campaign_status = f"Live Campaign: {yt_pulse['active_campaign_title'][:65]}"
    else:
        campaign_status = "Always-On Category Benchmark"

    return {
        "channel": cfg["channel"],
        "key": cfg["key"],
        "color": cfg["color"],
        "live_cpc_inr": live_cpc_inr,
        "cpc_range_inr": [cpc_min, cpc_max],
        "active_cpm_inr": active_cpm_inr,
        "live_cvr_baseline_pct": live_cvr_pct,
        "live_ctr_baseline_pct": live_ctr_pct,
        "channel_multiplier": channel_multiplier,
        "category_aov_inr": cat_aov,
        "active_campaign_status": campaign_status,
        "sale_active": has_sale,
        "storefront_status": storefront.get("storefront_status"),
        "storefront_title": storefront.get("page_title", ""),
        "youtube_brand_handle": yt_pulse.get("handle"),
        "youtube_brand_status": yt_pulse.get("yt_status"),
        "youtube_subscribers": yt_pulse.get("subscribers", 0),
        "median_campaign_views": yt_pulse.get("median_campaign_views", 0),
        "engagement_rate_pct": eng_rate,
        "recent_campaign_videos": yt_pulse.get("recent_campaign_videos", [])[:3],
        "dataset_campaigns_count": int(ds_baseline.get("campaigns", 0)),
        "data_sources": data_sources,
    }


async def get_live_marketplace_feed(*, force_refresh: bool = False) -> dict[str, Any]:
    """Return live calibrated telemetry for Nykaa, Tira, Purplle & D2C Web with 5m TTL cache."""
    global _FEED_CACHE, _FEED_CACHE_TS

    now_mono = time.monotonic()
    with _CACHE_LOCK:
        if not force_refresh and _FEED_CACHE is not None and (now_mono - _FEED_CACHE_TS) < CACHE_TTL_SECONDS:
            return _FEED_CACHE

    ds_baselines = _load_dataset_channel_baselines()

    async def _collect_one(cfg: dict[str, Any]) -> dict[str, Any]:
        try:
            storefront_res, yt_res = await asyncio.wait_for(
                asyncio.gather(
                    _probe_public_storefront(cfg["storefront_url"]),
                    _fetch_youtube_brand_campaign_pulse(cfg["youtube_handles"]),
                ),
                timeout=8.0,
            )
        except Exception as exc:
            storefront_res = {
                "storefront_status": f"error:{type(exc).__name__}",
                "page_title": "",
                "active_promos": [],
                "live_prices_inr": [],
                "observed_median_price_inr": None,
            }
            yt_res = {
                "yt_status": f"error:{type(exc).__name__}",
                "handle": None,
                "subscribers": 0,
                "recent_campaign_videos": [],
                "median_campaign_views": 0,
                "avg_engagement_rate_pct": 0.0,
                "active_campaign_title": "",
            }
        return _calibrate_channel_metrics(
            cfg,
            storefront=storefront_res,
            yt_pulse=yt_res,
            ds_baseline=ds_baselines.get(cfg["key"], {}),
        )

    channels_list = await asyncio.gather(*(_collect_one(cfg) for cfg in _CHANNEL_CONFIGS))
    fetched_at = datetime.now(timezone.utc).isoformat()

    live_yt_count = sum(1 for c in channels_list if c.get("youtube_brand_status") == "live")
    live_sf_count = sum(1 for c in channels_list if c.get("storefront_status") == "live_http_200")
    has_yt_key = bool(os.getenv("YOUTUBE_API_KEY"))

    if live_yt_count > 0 or live_sf_count > 0:
        feed_status = "live" if (live_yt_count >= 2 or live_sf_count >= 1) else "partial_live"
    elif not has_yt_key:
        feed_status = "live_feed_unavailable"
    else:
        feed_status = "degraded"

    payload = {
        "status": feed_status,
        "youtube_api_configured": has_yt_key,
        "fetched_at": fetched_at,
        "cache_ttl_seconds": int(CACHE_TTL_SECONDS),
        "channels": channels_list,
        "by_channel": {c["channel"]: c for c in channels_list},
    }

    with _CACHE_LOCK:
        _FEED_CACHE = payload
        _FEED_CACHE_TS = time.monotonic()

    return payload


def get_cached_channel_benchmark(channel_name: str, product_category: str = "Skincare") -> dict[str, Any]:
    """Synchronous lookup of the latest cached marketplace benchmark (or config baseline if uncached)."""
    with _CACHE_LOCK:
        cached = _FEED_CACHE
    if cached and channel_name in cached.get("by_channel", {}):
        ch = cached["by_channel"][channel_name]
        return {
            **ch,
            "fetched_at": cached.get("fetched_at"),
            "aov_inr": ch.get("category_aov_inr", {}).get(product_category, 1200),
        }

    cfg = next((c for c in _CHANNEL_CONFIGS if c["channel"] == channel_name), _CHANNEL_CONFIGS[0])
    return {
        "channel": cfg["channel"],
        "key": cfg["key"],
        "color": cfg["color"],
        "live_cpc_inr": cfg["base_cpc_inr"],
        "cpc_range_inr": [round(cfg["base_cpc_inr"] * 0.8, 2), round(cfg["base_cpc_inr"] * 1.28, 2)],
        "active_cpm_inr": cfg["base_cpm_inr"],
        "live_cvr_baseline_pct": cfg["base_cvr_pct"],
        "live_ctr_baseline_pct": cfg["base_ctr_pct"],
        "channel_multiplier": {"nykaa": 1.16, "tira": 1.06, "purplle": 0.96, "marketing_campaign": 0.88}.get(cfg["key"], 1.0),
        "category_aov_inr": cfg["category_aov_inr"],
        "aov_inr": cfg["category_aov_inr"].get(product_category, 1200),
        "active_campaign_status": "Baseline Calibration (Live Feed Pending)",
        "fetched_at": None,
        "data_sources": ["baseline_config"],
    }
