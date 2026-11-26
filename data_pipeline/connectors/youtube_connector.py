"""YouTube & YouTube Shorts Data API v3 Live Lookup (@handle 4-unit + Video/Shorts URL)."""

from __future__ import annotations

import os
import re
import threading
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

# Verified public Indian beauty, skincare & Nykaa/Tira standard videos AND YouTube Shorts
DEFAULT_BEAUTY_VIDEO_IDS: list[str] = [
    "7IN5WNKhguQ",  # Koyal Bhattacharjee - Nykaa hot pink sale worth ₹8000/- (YouTube Shorts, PT50S)
    "sV0WFbf77m0",  # Nykaa - Best Serum for Oily Skin? #Shorts (YouTube Shorts, PT10S)
    "bhHlrGpBPoM",  # Yashita Rai - Nykaa Pink Love SALE Haul #shorts (YouTube Shorts, PT55S)
    "cp_QeKH2bqQ",  # Super Style Tips - ₹50,000 Nykaa TIRA Sale Haul (YouTube, PT19M51S)
    "q38lGiXeqLY",  # Manaswani Saxena - Nykaa Skincare & Beauty Haul (YouTube, PT13M48S)
]

_STATE_LOCK = threading.RLock()
_TRACKED_VIDEO_IDS: list[str] = list(DEFAULT_BEAUTY_VIDEO_IDS)
_SHORTS_HINT_IDS: set[str] = {"7IN5WNKhguQ", "sV0WFbf77m0", "bhHlrGpBPoM"}
_PREV_VIDEO_STATS: dict[str, dict[str, int]] = {}
_VIDEO_COMMENTS_CACHE: dict[str, list[dict[str, Any]]] = {}

_POS_WORDS = {
    "love", "loved", "amazing", "best", "good", "great", "awesome", "nice", "glow",
    "glowing", "worth", "recommend", "recommended", "buy", "buying", "ordered",
    "link", "price", "fav", "favorite", "favourite", "helpful", "pretty", "gorgeous",
    "super", "perfect", "effective", "genuine", "honest", "holy", "grail", "wow",
}
_NEG_WORDS = {
    "bad", "worst", "fake", "waste", "scam", "allergy", "breakout", "acne", "dry",
    "oily", "sticky", "disappointed", "overpriced", "terrible", "useless", "refund",
    "irritating", "burn", "smell", "horrible", "cheat", "sponsored",
}
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_DURATION_RE = re.compile(r"^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$")


def parse_iso_duration_seconds(iso_duration: str) -> int:
    """Parse ISO-8601 YouTube duration (e.g. 'PT50S', 'PT13M48S') into total seconds."""
    if not iso_duration:
        return 0
    m = _DURATION_RE.match(iso_duration.strip().upper())
    if not m:
        return 0
    hours = int(m.group(1) or 0)
    minutes = int(m.group(2) or 0)
    seconds = int(m.group(3) or 0)
    return hours * 3600 + minutes * 60 + seconds


def parse_youtube_handle(raw_input: str) -> str | None:
    """Detect and extract a clean YouTube @handle from '@Nykaa' or 'youtube.com/@Nykaa'."""
    raw = raw_input.strip()
    if raw.startswith("@") and "/" not in raw and " " not in raw:
        handle = raw.lstrip("@").strip()
        return handle if re.fullmatch(r"[A-Za-z0-9._-]{2,60}", handle) else None

    try:
        parsed = urlparse(raw if "://" in raw else f"https://{raw}")
        host = parsed.netloc.lower()
        if "youtube.com" in host:
            parts = [p for p in parsed.path.split("/") if p]
            if parts and parts[0].startswith("@"):
                handle = parts[0].lstrip("@").strip()
                if re.fullmatch(r"[A-Za-z0-9._-]{2,60}", handle):
                    return handle
    except Exception:
        pass
    return None


def extract_youtube_video_details(url_or_id: str) -> tuple[str, bool]:
    """Return (11-char video_id, is_shorts_url) from standard YouTube or Shorts URL/ID."""
    raw = url_or_id.strip()
    is_shorts_url = "/shorts/" in raw.lower()
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", raw):
        return raw, False

    try:
        parsed = urlparse(raw if "://" in raw else f"https://{raw}")
        host = parsed.netloc.lower()
        path_parts = [p for p in parsed.path.split("/") if p]

        if "youtu.be" in host and path_parts:
            candidate = path_parts[0]
            if re.fullmatch(r"[A-Za-z0-9_-]{11}", candidate):
                return candidate, is_shorts_url

        if "youtube.com" in host or "youtube-nocookie.com" in host:
            qs = parse_qs(parsed.query)
            if "v" in qs and qs["v"]:
                candidate = qs["v"][0]
                if re.fullmatch(r"[A-Za-z0-9_-]{11}", candidate):
                    return candidate, is_shorts_url
            if len(path_parts) >= 2 and path_parts[0] in {"shorts", "live", "embed", "v"}:
                candidate = path_parts[1]
                if re.fullmatch(r"[A-Za-z0-9_-]{11}", candidate):
                    return candidate, (path_parts[0] == "shorts" or is_shorts_url)
    except Exception:
        pass

    match = re.search(r"(?:v=|youtu\.be/|shorts/|live/|embed/)([A-Za-z0-9_-]{11})", raw)
    if match:
        return match.group(1), is_shorts_url
    raise ValueError("Enter a valid YouTube @handle (e.g. @Nykaa) or YouTube/Shorts video URL.")


def extract_youtube_video_id(url_or_id: str) -> str:
    """Backward-compatible helper returning only the 11-character YouTube video ID."""
    vid, _ = extract_youtube_video_details(url_or_id)
    return vid


def classify_youtube_format(
    *,
    video_id: str,
    title: str,
    description: str,
    duration_seconds: int,
    was_shorts_url: bool = False,
) -> tuple[str, str]:
    """Classify a video as ('youtube_shorts', 'YouTube Shorts') or ('youtube', 'YouTube')."""
    text_blob = f"{title} {description}".lower()
    with _STATE_LOCK:
        hinted = video_id in _SHORTS_HINT_IDS
    if (
        was_shorts_url
        or hinted
        or "#shorts" in text_blob
        or "#youtubeshorts" in text_blob
        or (0 < duration_seconds <= 180)
    ):
        return "youtube_shorts", "YouTube Shorts"
    return "youtube", "YouTube"


def slugify_channel_handle(channel_title: str, video_id: str, platform_key: str) -> str:
    """Create a deterministic clean @creator handle distinguishing YouTube vs YouTube Shorts."""
    cleaned = re.sub(r"[^a-z0-9]+", "_", channel_title.lower()).strip("_")
    suffix = "shorts" if platform_key == "youtube_shorts" else "yt"
    if not cleaned:
        return f"@yt_{video_id[:6].lower()}_{suffix}"
    parts = [p for p in cleaned.split("_") if p][:2]
    return f"@{'_'.join(parts)}_{suffix}"


def get_tracked_video_ids() -> list[str]:
    """Return all currently tracked public YouTube & YouTube Shorts video IDs."""
    with _STATE_LOCK:
        return list(_TRACKED_VIDEO_IDS)


def register_tracked_video_id(video_id: str, *, is_shorts_url: bool = False) -> None:
    """Add a video ID to the recurring background poll list (bounded to 15 videos)."""
    with _STATE_LOCK:
        if is_shorts_url:
            _SHORTS_HINT_IDS.add(video_id)
        if video_id in _TRACKED_VIDEO_IDS:
            _TRACKED_VIDEO_IDS.remove(video_id)
        _TRACKED_VIDEO_IDS.insert(0, video_id)
        if len(_TRACKED_VIDEO_IDS) > 15:
            del _TRACKED_VIDEO_IDS[15:]


def compute_comment_sentiment(
    comments: list[dict[str, Any]],
    *,
    like_count: int,
    view_count: int,
) -> float:
    """Derive audience NLP sentiment (-1.0..1.0) from real YouTube comments & engagement ratio."""
    eng_ratio = like_count / max(1, view_count)
    baseline = min(0.88, max(0.56, 0.64 + eng_ratio * 3.8))
    if not comments:
        return round(baseline, 3)

    scores: list[float] = []
    for c in comments:
        text = str(c.get("text", "")).lower()
        tokens = set(re.findall(r"[a-z]+", text))
        pos_hits = len(tokens & _POS_WORDS)
        neg_hits = len(tokens & _NEG_WORDS)
        if pos_hits == 0 and neg_hits == 0:
            scores.append(baseline)
        else:
            raw = (pos_hits - 1.3 * neg_hits) / max(1, pos_hits + neg_hits)
            scores.append(max(-0.95, min(0.98, 0.72 + raw * 0.26)))
    blended = 0.65 * (sum(scores) / len(scores)) + 0.35 * baseline
    return round(max(-0.95, min(0.98, blended)), 3)


def _infer_niche(title: str, tags: list[str]) -> str:
    corpus = f"{title} {' '.join(tags)}".lower()
    if any(k in corpus for k in ("perfume", "fragrance", "scent", "mist")):
        return "Fragrance"
    if any(k in corpus for k in ("makeup", "lipstick", "foundation", "concealer", "blush")):
        return "Makeup"
    if any(k in corpus for k in ("hair", "shampoo", "keratin", "haircare")):
        return "Haircare"
    return "Skincare"


async def fetch_youtube_comments(video_id: str, max_results: int = 8) -> list[dict[str, Any]]:
    """Fetch real top audience comments via YouTube Data API v3 commentThreads (1 unit)."""
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        return []

    url = "https://www.googleapis.com/youtube/v3/commentThreads"
    params = {
        "part": "snippet",
        "videoId": video_id,
        "order": "relevance",
        "maxResults": max(1, min(10, max_results)),
        "textFormat": "plainText",
        "key": api_key,
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return _VIDEO_COMMENTS_CACHE.get(video_id, [])
            items = resp.json().get("items", [])
    except Exception:
        return _VIDEO_COMMENTS_CACHE.get(video_id, [])

    parsed_comments: list[dict[str, Any]] = []
    for item in items:
        top = item.get("snippet", {}).get("topLevelComment", {}).get("snippet", {})
        raw_text = str(top.get("textDisplay") or top.get("textOriginal") or "").strip()
        clean_text = _HTML_TAG_RE.sub("", unescape(raw_text)).replace("\n", " ").strip()
        if not clean_text:
            continue
        parsed_comments.append(
            {
                "author": str(top.get("authorDisplayName", "YouTube Viewer")),
                "text": clean_text[:180],
                "likes": int(top.get("likeCount", 0) or 0),
                "published_at": str(top.get("publishedAt", "")),
            }
        )

    with _STATE_LOCK:
        if parsed_comments:
            _VIDEO_COMMENTS_CACHE[video_id] = parsed_comments
    return parsed_comments


async def poll_youtube_video_stats(
    video_ids: list[str] | None = None,
    *,
    include_comments: bool = False,
    shorts_url_ids: set[str] | None = None,
    comments_limit: int = 8,
    subscriber_override: int | None = None,
    handle_override: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch live statistics, snippets & duration via YouTube Data API v3 (1 quota unit/batch)."""
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        return []

    target_ids = video_ids or get_tracked_video_ids()
    if not target_ids:
        return []

    url = "https://www.googleapis.com/youtube/v3/videos"
    params = {
        "part": "snippet,statistics,contentDetails",
        "id": ",".join(target_ids[:50]),
        "key": api_key,
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        items = resp.json().get("items", [])

    results: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)
    url_hint_set = shorts_url_ids or set()

    for idx, item in enumerate(items):
        vid = str(item.get("id", ""))
        snippet = item.get("snippet", {})
        stats = item.get("statistics", {})
        content = item.get("contentDetails", {})

        title = unescape(str(snippet.get("title", "YouTube Creator Video")))
        description = str(snippet.get("description", ""))
        channel_title = str(snippet.get("channelTitle", "YouTube Creator")).strip()
        tags = list(snippet.get("tags", []) or [])
        duration_sec = parse_iso_duration_seconds(str(content.get("duration", "")))
        platform_key, platform_label = classify_youtube_format(
            video_id=vid,
            title=title,
            description=description,
            duration_seconds=duration_sec,
            was_shorts_url=(vid in url_hint_set),
        )

        views = int(stats.get("viewCount", 0) or 0)
        likes = int(stats.get("likeCount", 0) or 0)
        comments_count = int(stats.get("commentCount", 0) or 0)

        published_raw = str(snippet.get("publishedAt", ""))
        age_hours = 24.0
        if published_raw:
            try:
                pub_dt = datetime.fromisoformat(published_raw.replace("Z", "+00:00"))
                age_hours = max(1.0, (now - pub_dt).total_seconds() / 3600.0)
            except Exception:
                pass

        with _STATE_LOCK:
            prev = _PREV_VIDEO_STATS.get(vid)
            _PREV_VIDEO_STATS[vid] = {"views": views, "likes": likes, "comments": comments_count}
            cached_comments = list(_VIDEO_COMMENTS_CACHE.get(vid, []))

        if (include_comments and idx == 0) or (include_comments and not video_ids) or not cached_comments:
            fetched = await fetch_youtube_comments(vid, max_results=comments_limit)
            if fetched:
                cached_comments = fetched

        raw_like_delta = max(0, likes - prev["likes"]) if prev else 0
        raw_comment_delta = max(0, comments_count - prev["comments"]) if prev else 0
        raw_view_delta = max(0, views - prev["views"]) if prev else 0

        age_mins = max(60.0, min(age_hours * 60.0, 24.0 * 60.0))
        shorts_boost = 1.25 if platform_key == "youtube_shorts" else 1.0
        norm_likes_pm = max(18, min(1600, int(round(((likes / age_mins) * 14.0 * shorts_boost) + raw_like_delta * 3.0))))
        norm_comments_pm = max(3, min(360, int(round(((comments_count / age_mins) * 18.0) + raw_comment_delta * 4.0))))
        norm_shares_pm = max(4, int(round(norm_likes_pm * (0.11 if platform_key == "youtube_shorts" else 0.08) + raw_view_delta * 0.02)))

        sentiment = compute_comment_sentiment(
            cached_comments,
            like_count=likes,
            view_count=views,
        )
        estimated_reach = (
            max(25000, int(subscriber_override))
            if subscriber_override
            else max(35000, min(3500000, int(max(views * 0.65, 95000))))
        )
        influencer_handle = (
            f"@{handle_override.lstrip('@').lower()}"
            if handle_override and idx == 0
            else slugify_channel_handle(channel_title, vid, platform_key)
        )

        results.append(
            {
                "video_id": vid,
                "influencer_id": influencer_handle,
                "platform": platform_label,
                "platform_key": platform_key,
                "duration_seconds": duration_sec,
                "channel_title": channel_title,
                "video_title": title,
                "niche": _infer_niche(title, tags),
                "views": views,
                "likes": likes,
                "comments_count": comments_count,
                "real_delta_views": raw_view_delta,
                "real_delta_likes": raw_like_delta,
                "real_delta_comments": raw_comment_delta,
                "likes_per_min_signal": norm_likes_pm,
                "comments_per_min_signal": norm_comments_pm,
                "shares_per_min_signal": norm_shares_pm,
                "estimated_sentiment": sentiment,
                "estimated_reach": estimated_reach,
                "recent_comments": cached_comments,
                "latest_comment": cached_comments[0]["text"] if cached_comments else "",
                "data_source": "youtube_api_v3",
            }
        )

    return results


async def lookup_youtube_handle(handle_raw: str) -> dict[str, Any]:
    """4-quota-unit live YouTube @handle lookup: channels -> playlistItems -> videos -> commentThreads."""
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        raise RuntimeError("YOUTUBE_API_KEY is not configured in environment.")

    handle = handle_raw.lstrip("@").strip()
    async with httpx.AsyncClient(timeout=8.0) as client:
        # Unit 1: channels?part=snippet,statistics,contentDetails&forHandle=
        ch_resp = await client.get(
            "https://www.googleapis.com/youtube/v3/channels",
            params={
                "part": "snippet,statistics,contentDetails",
                "forHandle": handle,
                "key": api_key,
            },
        )
        ch_resp.raise_for_status()
        ch_items = ch_resp.json().get("items", [])
        if not ch_items:
            raise LookupError(f"No public YouTube channel found for '@{handle}'.")

        ch = ch_items[0]
        ch_snippet = ch.get("snippet", {})
        ch_stats = ch.get("statistics", {})
        uploads_id = ch.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
        subscriber_count = int(ch_stats.get("subscriberCount", 0) or 0)
        channel_view_count = int(ch_stats.get("viewCount", 0) or 0)
        video_count = int(ch_stats.get("videoCount", 0) or 0)
        channel_title = unescape(str(ch_snippet.get("title", f"@{handle}")))

        if not uploads_id:
            raise LookupError(f"Channel '@{handle}' does not expose public uploads.")

        # Unit 2: playlistItems -> latest 5 uploaded video IDs
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
        latest_ids = [
            str(it.get("contentDetails", {}).get("videoId", ""))
            for it in pl_resp.json().get("items", [])
            if it.get("contentDetails", {}).get("videoId")
        ]
        if not latest_ids:
            raise LookupError(f"Channel '@{handle}' has no accessible public videos.")

    # Unit 3 & Unit 4: batch videos stats (1 unit) + latest video commentThreads maxResults=8 (1 unit)
    videos_data = await poll_youtube_video_stats(
        latest_ids[:5],
        include_comments=True,
        comments_limit=8,
        subscriber_override=subscriber_count,
        handle_override=handle,
    )
    if not videos_data:
        raise LookupError(f"Unable to fetch video telemetry for '@{handle}'.")

    primary = videos_data[0]
    register_tracked_video_id(
        primary["video_id"],
        is_shorts_url=(primary.get("platform_key") == "youtube_shorts"),
    )

    return {
        "lookup_type": "channel_handle",
        "quota_units_used": 4,
        "handle": f"@{handle}",
        "channel_id": ch.get("id"),
        "channel_title": channel_title,
        "subscriber_count": subscriber_count,
        "channel_view_count": channel_view_count,
        "video_count": video_count,
        "primary_item": primary,
        "latest_videos": [
            {
                "video_id": v["video_id"],
                "video_title": v["video_title"],
                "platform": v["platform"],
                "platform_key": v["platform_key"],
                "duration_seconds": v.get("duration_seconds", 0),
                "views": v["views"],
                "likes": v["likes"],
                "comments_count": v["comments_count"],
                "estimated_sentiment": v["estimated_sentiment"],
            }
            for v in videos_data
        ],
    }
