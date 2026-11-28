"""YouTube & YouTube Shorts Data API v3 Live Lookup, Niche Classification & Sponsorship Verification."""

from __future__ import annotations

import os
import re
import statistics
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

BEAUTY_NICHES: set[str] = {"Skincare", "Makeup", "Haircare", "Fragrance"}

_STATE_LOCK = threading.RLock()
_TRACKED_VIDEO_IDS: list[str] = list(DEFAULT_BEAUTY_VIDEO_IDS)
_SHORTS_HINT_IDS: set[str] = {"7IN5WNKhguQ", "sV0WFbf77m0", "bhHlrGpBPoM"}
_PREV_VIDEO_STATS: dict[str, dict[str, int]] = {}
_VIDEO_COMMENTS_CACHE: dict[str, list[dict[str, Any]]] = {}
_CHANNEL_META_CACHE: dict[str, dict[str, Any]] = {}

_POS_WORDS = {
    "love", "loved", "amazing", "best", "good", "great", "awesome", "nice", "glow",
    "glowing", "worth", "recommend", "recommended", "buy", "buying", "ordered",
    "link", "price", "fav", "favorite", "favourite", "helpful", "pretty", "gorgeous",
    "super", "perfect", "effective", "genuine", "honest", "holy", "grail", "wow",
    "shade", "review", "nykaa", "tira", "purplle", "wishlist", "cart",
}
_NEG_WORDS = {
    "bad", "worst", "fake", "waste", "scam", "allergy", "breakout", "acne", "dry",
    "oily", "sticky", "disappointed", "overpriced", "terrible", "useless", "refund",
    "irritating", "burn", "smell", "horrible", "cheat",
}
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_DURATION_RE = re.compile(r"^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$")

# Multi-category niche classification taxonomy
_NICHE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Skincare": (
        "skincare", "skin care", "serum", "sunscreen", "spf", "moisturizer", "moisturiser",
        "cleanser", "facewash", "face wash", "niacinamide", "retinol", "hyaluronic",
        "salicylic", "acne", "pigmentation", "glass skin", "toner", "sheet mask",
        "lip balm", "ceramide", "vitamin c", "dermatologist", "skin barrier", "exfoliant",
        "glycolic", "azelaic", "dark spots", "oily skin", "dry skin", "routine",
        "aqualogica", "minimalist", "cetaphil", "cerave", "dot & key", "foxtale", "derma co",
    ),
    "Makeup": (
        "makeup", "lipstick", "foundation", "concealer", "blush", "eyeliner", "mascara",
        "eyeshadow", "primer", "compact", "highlighter", "contour", "kajal", "lip gloss",
        "lip tint", "grwm", "glam", "cosmetics", "swatch", "swatches", "beauty haul",
        "pink friday", "pink love", "smokey eye", "bridal", "dewy", "matte",
        "nykaa", "tirabeauty", "tira beauty", "purplle", "lakme", "maybelline", "kay beauty",
    ),
    "Haircare": (
        "haircare", "hair care", "shampoo", "conditioner", "hair serum", "hair oil",
        "keratin", "hair fall", "hairfall", "dandruff", "scalp", "hair mask",
        "rosemary", "minoxidil", "frizz", "hair styling", "curls", "straightener",
        "hair growth", "leave-in", "wishcare",
    ),
    "Fragrance": (
        "perfume", "perfumes", "fragrance", "fragrances", "scent", "body mist",
        "eau de parfum", "cologne", "deodorant", "attar", "oud", "vanilla mist",
        "top notes", "long lasting perfume",
    ),
    "Gaming": (
        "gaming", "gamer", "gameplay", "gta", "gta 5", "gta v", "minecraft", "bgmi",
        "pubg", "valorant", "free fire", "fortnite", "playstation", "ps5", "xbox",
        "nintendo", "steam", "walkthrough", "speedrun", "esports", "streamer",
        "techno gamerz", "pc build", "rtx", "fps", "multiplayer", "simulator",
        "horrer game", "horror game", "cyberpunk", "red dead", "roblox", "cod",
    ),
    "Tech": (
        "tech", "technology", "unboxing", "smartphone", "iphone", "samsung", "android",
        "laptop", "macbook", "gadget", "gadgets", "processor", "snapdragon",
        "benchmark", "5g", "earbuds", "smartwatch", "gpu", "cpu", "ai tool",
        "review", "camera test", "battery test", "oneplus", "xiaomi", "pixel",
    ),
    "Entertainment": (
        "comedy", "roast", "prank", "sketch", "parody", "reaction", "trailer",
        "movie", "web series", "music video", "song", "standup", "stand-up", "meme",
        "challenge", "bollywood", "episode", "funny", "entertainment", "drama",
    ),
    "Finance": (
        "finance", "stock market", "nifty", "sensex", "mutual fund", "sip", "crypto",
        "bitcoin", "investing", "investment", "trading", "credit card", "income tax",
        "passive income", "personal finance", "wealth", "fintech", "ipo", "bank",
    ),
    "Education": (
        "tutorial", "course", "lecture", "exam", "upsc", "jee", "neet", "study",
        "explained", "documentary", "science", "history", "mathematics", "coding",
        "programming", "learn", "syllabus",
    ),
    "Fitness": (
        "workout", "gym", "fitness", "protein", "creatine", "weight loss", "fat loss",
        "cardio", "yoga", "calisthenics", "bodybuilding", "marathon", "strength",
    ),
    "Food": (
        "recipe", "cooking", "street food", "restaurant", "biryani", "chef",
        "kitchen", "baking", "food review", "mukbang", "taste test", "foodie",
    ),
    "Vlog": (
        "vlog", "daily vlog", "day in my life", "travel vlog", "mini vlog",
        "room tour", "travel", "trip", "vacation", "lifestyle vlog",
    ),
}

_TOPIC_CATEGORY_MAP: dict[str, str] = {
    "skin_care": "Skincare",
    "dermatology": "Skincare",
    "cosmetics": "Makeup",
    "make-up": "Makeup",
    "beauty": "Makeup",
    "fashion": "Makeup",
    "hair_care": "Haircare",
    "hairstyle": "Haircare",
    "perfume": "Fragrance",
    "video_game": "Gaming",
    "action-adventure_game": "Gaming",
    "action_game": "Gaming",
    "role-playing_video_game": "Gaming",
    "shooter_game": "Gaming",
    "simulation_video_game": "Gaming",
    "sports_game": "Gaming",
    "strategy_video_game": "Gaming",
    "gaming": "Gaming",
    "technology": "Tech",
    "consumer_electronics": "Tech",
    "mobile_phone": "Tech",
    "computer": "Tech",
    "software": "Tech",
    "entertainment": "Entertainment",
    "film": "Entertainment",
    "television_program": "Entertainment",
    "humour": "Entertainment",
    "comedy": "Entertainment",
    "music": "Entertainment",
    "pop_music": "Entertainment",
    "performing_arts": "Entertainment",
    "finance": "Finance",
    "business": "Finance",
    "economics": "Finance",
    "investing": "Finance",
    "knowledge": "Education",
    "education": "Education",
    "science": "Education",
    "physical_fitness": "Fitness",
    "health": "Fitness",
    "sport": "Fitness",
    "food": "Food",
    "cooking": "Food",
    "gastronomy": "Food",
    "lifestyle": "Vlog",
    "tourism": "Vlog",
    "travel": "Vlog",
}

# Commercial sponsorship / advertisement disclosure patterns
_AD_DISCLOSURE_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("#ad", re.compile(r"(?:^|[\s,(|])#ad\b", re.IGNORECASE)),
    ("#sponsored", re.compile(r"#sponsored\b", re.IGNORECASE)),
    ("#paidpartnership", re.compile(r"#?paid[\s_-]*(?:partnership|promotion)\b", re.IGNORECASE)),
    ("sponsored_by", re.compile(r"\b(?:sponsored\s+by|powered\s+by|in\s+(?:collaboration|partnership)\s+with|brand\s+partner)\b|#collab\b", re.IGNORECASE)),
    ("promo_code", re.compile(r"\b(?:use\s+(?:my\s+)?code|coupon\s+code|discount\s+code|promo\s+code|coupon)\b|\bcode\s*[:\-]\s*[A-Z0-9]{3,}", re.IGNORECASE)),
    ("shop_cta", re.compile(r"\b(?:shop\s+now|shop\s+here|buy\s+link|buy\s+here|link\s+in\s+(?:description|bio)|affiliate\s+link)\b", re.IGNORECASE)),
    ("tracking_link", re.compile(r"(?:utm_source=|utm_medium=|utm_campaign=|amzn\.to/|bit\.ly/|tinyurl\.com/|nykaa\.page\.link/|nyk0\.page\.link/|wishlink\.com/|hypd\.store/|tap\.bio/|linktr\.ee/|tira\.link/)", re.IGNORECASE)),
]

# Marketplace & beauty brand affinity patterns
_BRAND_MENTION_PATTERNS: list[tuple[str, re.Pattern[str], bool]] = [
    ("Nykaa", re.compile(r"(?:\bnykaa\b|\bnykaabeauty\b|nykaa\.com|nykaa\.page\.link|nyk0\.page\.link)", re.IGNORECASE), True),
    ("Tira", re.compile(r"(?:\btira\b|\btirabeauty\b|tira\s+beauty|tirabeauty\.com)", re.IGNORECASE), True),
    ("Purplle", re.compile(r"(?:\bpurplle\b|purplle\.com)", re.IGNORECASE), True),
    ("Minimalist", re.compile(r"\bminimalist\b", re.IGNORECASE), False),
    ("Dot & Key", re.compile(r"\b(?:dot\s*&\s*key|dotandkey)\b", re.IGNORECASE), False),
    ("Plum", re.compile(r"\bplum\s+(?:goodness|skincare|serum|body)\b", re.IGNORECASE), False),
    ("Mamaearth", re.compile(r"\bmamaearth\b", re.IGNORECASE), False),
    ("Maybelline", re.compile(r"\bmaybelline\b", re.IGNORECASE), False),
    ("L'Oreal", re.compile(r"\bl'?oreal\b", re.IGNORECASE), False),
    ("Lakme", re.compile(r"\blakme\b", re.IGNORECASE), False),
    ("Sugar Cosmetics", re.compile(r"\bsugar\s+cosmetics\b", re.IGNORECASE), False),
    ("Cetaphil", re.compile(r"\bcetaphil\b", re.IGNORECASE), False),
    ("CeraVe", re.compile(r"\bcerave\b", re.IGNORECASE), False),
    ("Neutrogena", re.compile(r"\bneutrogena\b", re.IGNORECASE), False),
    ("Garnier", re.compile(r"\bgarnier\b", re.IGNORECASE), False),
    ("Foxtale", re.compile(r"\bfoxtale\b", re.IGNORECASE), False),
    ("Aqualogica", re.compile(r"\baqualogica\b", re.IGNORECASE), False),
    ("The Derma Co", re.compile(r"\b(?:the\s+)?derma\s*co\b", re.IGNORECASE), False),
    ("Kay Beauty", re.compile(r"\bkay\s+beauty\b", re.IGNORECASE), False),
    ("COSRX", re.compile(r"\bcosrx\b", re.IGNORECASE), False),
    ("Laneige", re.compile(r"\blaneige\b", re.IGNORECASE), False),
    ("Sephora", re.compile(r"\bsephora\b", re.IGNORECASE), False),
    ("MAC Cosmetics", re.compile(r"\bmac\s+(?:cosmetics|lipstick|strobe)\b", re.IGNORECASE), False),
    ("Pilgrim", re.compile(r"\bpilgrim\b", re.IGNORECASE), False),
    ("WishCare", re.compile(r"\bwishcare\b", re.IGNORECASE), False),
]

_SPAM_COMMENT_RE = re.compile(
    r"(?:sub\s*4\s*sub|subscribe\s+to\s+my\s+channel|check\s+my\s+(?:channel|profile|bio)|"
    r"whatsapp\s*\+?\d|telegram\s*@|earn\s+\$?\d+|crypto\s+profit|dm\s+for\s+promo)",
    re.IGNORECASE,
)


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
    baseline = min(0.88, max(0.52, 0.60 + eng_ratio * 3.8))
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


def _score_text_niches(text: str, weight: float, scores: dict[str, float]) -> None:
    if not text:
        return
    low = text.lower()
    for niche, keywords in _NICHE_KEYWORDS.items():
        for kw in keywords:
            if " " in kw:
                if kw in low:
                    scores[niche] = scores.get(niche, 0.0) + weight
            else:
                if re.search(rf"\b{re.escape(kw)}\b", low):
                    scores[niche] = scores.get(niche, 0.0) + weight


def classify_creator_niche(
    *,
    topic_categories: list[str] | None = None,
    channel_title: str = "",
    channel_description: str = "",
    videos: list[dict[str, Any]] | None = None,
) -> tuple[str, bool, dict[str, float]]:
    """Multi-category creator niche classifier using topicDetails, channel bio, titles & tags."""
    scores: dict[str, float] = {niche: 0.0 for niche in _NICHE_KEYWORDS}

    for url in topic_categories or []:
        slug = url.rstrip("/").split("/")[-1].lower()
        for topic_key, niche in _TOPIC_CATEGORY_MAP.items():
            if topic_key in slug:
                scores[niche] = scores.get(niche, 0.0) + 4.5

    _score_text_niches(channel_title, 3.0, scores)
    _score_text_niches(channel_description, 2.0, scores)

    for v in videos or []:
        _score_text_niches(str(v.get("video_title") or v.get("title") or ""), 2.2, scores)
        tags_text = " ".join(str(t) for t in (v.get("tags") or []))
        _score_text_niches(tags_text, 1.4, scores)
        _score_text_niches(str(v.get("description") or "")[:600], 0.9, scores)

    beauty_scores = {k: v for k, v in scores.items() if k in BEAUTY_NICHES}
    non_beauty_scores = {k: v for k, v in scores.items() if k not in BEAUTY_NICHES}

    best_beauty_niche, best_beauty_val = max(beauty_scores.items(), key=lambda kv: kv[1])
    best_other_niche, best_other_val = max(non_beauty_scores.items(), key=lambda kv: kv[1])

    # Avoid false beauty assignment when Gaming/Tech/Entertainment/etc. dominates.
    # Allow beauty creators who also tag "Vlog" to keep their beauty niche if beauty signals are clear.
    if best_beauty_val > 0 and (
        best_beauty_val >= best_other_val
        or (best_other_niche == "Vlog" and best_beauty_val >= best_other_val * 0.65)
    ):
        detected = best_beauty_niche
    elif best_other_val > 0:
        detected = best_other_niche
    else:
        detected = "General"

    is_beauty = detected in BEAUTY_NICHES
    rounded_scores = {k: round(v, 2) for k, v in scores.items() if v > 0}
    return detected, is_beauty, rounded_scores


def _infer_niche(
    title: str,
    tags: list[str],
    *,
    description: str = "",
    channel_title: str = "",
    channel_description: str = "",
    topic_categories: list[str] | None = None,
) -> str:
    """Classify a single video/channel into its true niche without defaulting to Skincare."""
    detected, _, _ = classify_creator_niche(
        topic_categories=topic_categories,
        channel_title=channel_title,
        channel_description=channel_description,
        videos=[{"title": title, "description": description, "tags": tags}],
    )
    return detected


def scan_sponsorship_signals(
    *,
    videos: list[dict[str, Any]],
    channel_description: str = "",
    is_beauty_creator: bool = False,
    comments_by_video: dict[str, list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    """Scan recent videos (titles, descriptions, tags, comments) for real ad & brand proof."""
    comments_map = comments_by_video or {}
    sponsored_videos: list[dict[str, Any]] = []
    all_brand_mentions: list[str] = []
    seen_brands: set[str] = set()
    marketplace_mentions: set[str] = set()
    buyer_intent_comment_hits = 0
    total_comments_scanned = 0

    for mkt_or_brand, pattern, is_mkt in _BRAND_MENTION_PATTERNS:
        if pattern.search(channel_description or ""):
            if mkt_or_brand not in seen_brands:
                seen_brands.add(mkt_or_brand)
                all_brand_mentions.append(mkt_or_brand)
            if is_mkt:
                marketplace_mentions.add(mkt_or_brand)

    for v in videos:
        vid = str(v.get("video_id", ""))
        title = str(v.get("video_title") or v.get("title") or "")
        desc = str(v.get("description") or "")
        tags = " ".join(str(t) for t in (v.get("tags") or []))
        v_comments = comments_map.get(vid) or v.get("recent_comments") or []
        comments_text = " ".join(str(c.get("text", "")) for c in v_comments)

        for c in v_comments:
            total_comments_scanned += 1
            ct = str(c.get("text", "")).lower()
            if any(w in ct for w in ("link", "price", "buy", "ordered", "nykaa", "tira", "purplle", "shade", "code")):
                buyer_intent_comment_hits += 1

        corpus = f"{title}\n{desc}\n{tags}\n{comments_text}"

        matched_signals: list[str] = []
        for sig_name, pat in _AD_DISCLOSURE_PATTERNS:
            if pat.search(corpus):
                matched_signals.append(sig_name)

        video_brands: list[str] = []
        for brand_name, pat, is_mkt in _BRAND_MENTION_PATTERNS:
            if pat.search(corpus):
                video_brands.append(brand_name)
                if brand_name not in seen_brands:
                    seen_brands.add(brand_name)
                    all_brand_mentions.append(brand_name)
                if is_mkt:
                    marketplace_mentions.add(brand_name)

        if matched_signals:
            sponsored_videos.append(
                {
                    "video_id": vid,
                    "video_title": title,
                    "url": f"https://www.youtube.com/watch?v={vid}",
                    "platform": v.get("platform", "YouTube"),
                    "views": int(v.get("views", 0) or 0),
                    "matched_signals": matched_signals,
                    "brand_mentions": video_brands,
                }
            )

    scanned_count = max(1, len(videos))
    sponsored_count = len(sponsored_videos)
    sponsorship_rate_pct = round((sponsored_count / scanned_count) * 100.0, 1)

    # Ad readiness score (0..100): combines commercial disclosure experience + beauty/marketplace affinity + buyer comments
    commercial_pts = min(45.0, sponsorship_rate_pct * 1.15)
    if is_beauty_creator or marketplace_mentions:
        affinity_pts = min(35.0, len(marketplace_mentions) * 14.0 + max(0, len(all_brand_mentions) - len(marketplace_mentions)) * 6.0)
    else:
        affinity_pts = 0.0

    avg_eng_ratio = sum(
        (int(v.get("likes", 0) or 0) + int(v.get("comments_count", 0) or 0)) / max(1, int(v.get("views", 1) or 1))
        for v in videos
    ) / scanned_count
    intent_ratio = buyer_intent_comment_hits / max(1, total_comments_scanned)
    engagement_pts = min(20.0, avg_eng_ratio * 220.0 + intent_ratio * 15.0)
    if not is_beauty_creator and not marketplace_mentions:
        # Non-beauty creators with zero beauty brand mentions should not score high on beauty ad readiness
        ad_readiness_score = int(round(min(38.0, commercial_pts * 0.55 + engagement_pts * 0.45)))
    else:
        ad_readiness_score = int(round(min(100.0, commercial_pts + affinity_pts + engagement_pts)))

    return {
        "recent_videos_scanned": len(videos),
        "sponsored_video_count": sponsored_count,
        "sponsored_videos_detected": sponsored_count,
        "sponsorship_rate_pct": sponsorship_rate_pct,
        "ad_readiness_score": max(0, min(100, ad_readiness_score)),
        "detected_brand_mentions": all_brand_mentions,
        "marketplace_mentions": sorted(marketplace_mentions),
        "sample_sponsored_videos": sponsored_videos[:5],
        "sponsored_video_examples": sponsored_videos[:5],
    }


def compute_live_bot_audit(
    videos: list[dict[str, Any]],
    comments: list[dict[str, Any]],
) -> dict[str, Any]:
    """Compute real live bot/anomaly metrics from fetched YouTube video stats and comments."""
    if not videos:
        return {
            "bot_anomaly_ratio": 0.0,
            "duplicate_comment_ratio": 0.0,
            "engagement_to_view_pct": 0.0,
            "view_velocity_anomaly": False,
            "audit_summary": "No live video telemetry available to audit.",
            "audited_at": datetime.now(timezone.utc).isoformat(),
        }

    view_list = [max(0, int(v.get("views", 0) or 0)) for v in videos]
    med_views = max(1.0, float(statistics.median(view_list)))

    eng_ratios: list[float] = []
    velocity_anomalies = 0
    for v in videos:
        views = max(1, int(v.get("views", 0) or 0))
        likes = max(0, int(v.get("likes", 0) or 0))
        cmts = max(0, int(v.get("comments_count", 0) or 0))
        ratio = (likes + cmts) / views
        eng_ratios.append(ratio)
        # Abnormal engagement (>35% or <0.15% on huge outlier spike >8x median views)
        if ratio > 0.35 or (views > med_views * 8.0 and ratio < 0.002):
            velocity_anomalies += 1

    avg_eng_pct = round((sum(eng_ratios) / len(eng_ratios)) * 100.0, 2)

    dup_ratio = 0.0
    spam_hits = 0
    if comments:
        normalized = [re.sub(r"\W+", " ", str(c.get("text", "")).lower()).strip() for c in comments]
        non_empty = [t for t in normalized if t]
        if non_empty:
            unique_count = len(set(non_empty))
            dup_ratio = max(0.0, (len(non_empty) - unique_count) / len(non_empty))
            spam_hits = sum(1 for c in comments if _SPAM_COMMENT_RE.search(str(c.get("text", ""))))

    spam_ratio = spam_hits / max(1, len(comments))
    anomaly_score = min(0.65, round(dup_ratio * 0.45 + spam_ratio * 0.35 + (velocity_anomalies / max(1, len(videos))) * 0.30, 4))
    has_velocity_anomaly = velocity_anomalies > 0

    if anomaly_score >= 0.12:
        summary = f"Elevated anomaly signals ({round(anomaly_score * 100, 1)}%): duplicate/spam comments or outlier view-to-engagement ratio."
    else:
        summary = f"Healthy organic profile: {avg_eng_pct}% engagement-to-view rate, {round(dup_ratio * 100, 1)}% duplicate comments."

    return {
        "bot_anomaly_ratio": anomaly_score,
        "duplicate_comment_ratio": round(dup_ratio, 4),
        "spam_comment_count": spam_hits,
        "engagement_to_view_pct": avg_eng_pct,
        "view_velocity_anomaly": has_velocity_anomaly,
        "audit_summary": summary,
        "audited_at": datetime.now(timezone.utc).isoformat(),
    }


async def fetch_youtube_comments(video_id: str, max_results: int = 10) -> list[dict[str, Any]]:
    """Fetch real top audience comments via YouTube Data API v3 commentThreads (1 unit)."""
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        return []

    url = "https://www.googleapis.com/youtube/v3/commentThreads"
    params = {
        "part": "snippet",
        "videoId": video_id,
        "order": "relevance",
        "maxResults": max(1, min(15, max_results)),
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
                "text": clean_text[:220],
                "likes": int(top.get("likeCount", 0) or 0),
                "published_at": str(top.get("publishedAt", "")),
            }
        )

    with _STATE_LOCK:
        if parsed_comments:
            _VIDEO_COMMENTS_CACHE[video_id] = parsed_comments
    return parsed_comments


async def _fetch_channels_metadata(channel_ids: list[str]) -> dict[str, dict[str, Any]]:
    """Batch-fetch channel snippet, statistics, contentDetails & topicDetails (1 quota unit)."""
    api_key = os.getenv("YOUTUBE_API_KEY")
    unique_ids = [cid for cid in dict.fromkeys(channel_ids) if cid]
    if not api_key or not unique_ids:
        return {}

    missing = [cid for cid in unique_ids if cid not in _CHANNEL_META_CACHE]
    if missing:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    "https://www.googleapis.com/youtube/v3/channels",
                    params={
                        "part": "snippet,statistics,contentDetails,topicDetails",
                        "id": ",".join(missing[:50]),
                        "key": api_key,
                    },
                )
                if resp.status_code == 200:
                    for ch in resp.json().get("items", []):
                        cid = str(ch.get("id", ""))
                        if cid:
                            with _STATE_LOCK:
                                _CHANNEL_META_CACHE[cid] = ch
        except Exception:
            pass

    with _STATE_LOCK:
        return {cid: _CHANNEL_META_CACHE[cid] for cid in unique_ids if cid in _CHANNEL_META_CACHE}


async def poll_youtube_video_stats(
    video_ids: list[str] | None = None,
    *,
    include_comments: bool = False,
    shorts_url_ids: set[str] | None = None,
    comments_limit: int = 10,
    subscriber_override: int | None = None,
    handle_override: str | None = None,
    channel_meta_override: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Fetch live statistics, snippets, duration & channel topic metadata via YouTube Data API v3."""
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        raise RuntimeError("YOUTUBE_API_KEY is not configured in environment.")

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

    if not items:
        return []

    channel_ids = [str(it.get("snippet", {}).get("channelId", "")) for it in items]
    channels_meta = (
        {str(channel_meta_override.get("id", "")): channel_meta_override}
        if channel_meta_override
        else await _fetch_channels_metadata(channel_ids)
    )

    results: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    url_hint_set = shorts_url_ids or set()

    for idx, item in enumerate(items):
        vid = str(item.get("id", ""))
        snippet = item.get("snippet", {})
        stats = item.get("statistics", {})
        content = item.get("contentDetails", {})

        title = unescape(str(snippet.get("title", "YouTube Creator Video")))
        description = str(snippet.get("description", ""))
        channel_id = str(snippet.get("channelId", ""))
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
        norm_likes_pm = max(1, int(round(((likes / age_mins) * 14.0 * shorts_boost) + raw_like_delta * 3.0)))
        norm_comments_pm = max(0, int(round(((comments_count / age_mins) * 18.0) + raw_comment_delta * 4.0)))
        norm_shares_pm = max(0, int(round(norm_likes_pm * (0.11 if platform_key == "youtube_shorts" else 0.08) + raw_view_delta * 0.02)))

        sentiment = compute_comment_sentiment(
            cached_comments,
            like_count=likes,
            view_count=views,
        )

        ch_meta = channels_meta.get(channel_id, {})
        ch_snip = ch_meta.get("snippet", {})
        ch_stats = ch_meta.get("statistics", {})
        topic_cats = list(ch_meta.get("topicDetails", {}).get("topicCategories", []) or [])
        ch_desc = str(ch_snip.get("description", ""))
        real_subs = int(subscriber_override or ch_stats.get("subscriberCount", 0) or 0)
        estimated_reach = real_subs if real_subs > 0 else max(1000, views)

        detected_niche, is_beauty, _ = classify_creator_niche(
            topic_categories=topic_cats,
            channel_title=channel_title,
            channel_description=ch_desc,
            videos=[{"title": title, "description": description, "tags": tags, "recent_comments": cached_comments}],
        )

        ad_scan = scan_sponsorship_signals(
            videos=[
                {
                    "video_id": vid,
                    "video_title": title,
                    "description": description,
                    "tags": tags,
                    "platform": platform_label,
                    "views": views,
                    "likes": likes,
                    "comments_count": comments_count,
                    "recent_comments": cached_comments,
                }
            ],
            channel_description=ch_desc,
            is_beauty_creator=is_beauty,
            comments_by_video={vid: cached_comments},
        )
        bot_audit = compute_live_bot_audit(
            [{"views": views, "likes": likes, "comments_count": comments_count}],
            cached_comments,
        )

        influencer_handle = (
            f"@{handle_override.lstrip('@').lower()}"
            if handle_override and idx == 0
            else slugify_channel_handle(channel_title, vid, platform_key)
        )

        results.append(
            {
                "video_id": vid,
                "channel_id": channel_id,
                "influencer_id": influencer_handle,
                "platform": platform_label,
                "platform_key": platform_key,
                "duration_seconds": duration_sec,
                "channel_title": channel_title,
                "channel_description": ch_desc[:500],
                "topic_categories": topic_cats,
                "video_title": title,
                "description": description,
                "tags": tags,
                "niche": detected_niche,
                "detected_niche": detected_niche,
                "is_beauty_creator": is_beauty,
                "views": views,
                "likes": likes,
                "comments_count": comments_count,
                "median_recent_views": views,
                "real_delta_views": raw_view_delta,
                "real_delta_likes": raw_like_delta,
                "real_delta_comments": raw_comment_delta,
                "likes_per_min_signal": norm_likes_pm,
                "comments_per_min_signal": norm_comments_pm,
                "shares_per_min_signal": norm_shares_pm,
                "estimated_sentiment": sentiment,
                "estimated_reach": estimated_reach,
                "subscriber_count": real_subs,
                "recent_comments": cached_comments,
                "latest_comment": cached_comments[0]["text"] if cached_comments else "",
                "ad_readiness_score": ad_scan["ad_readiness_score"],
                "sponsored_video_count": ad_scan["sponsored_video_count"],
                "sponsored_videos_detected": ad_scan["sponsored_videos_detected"],
                "recent_videos_scanned": ad_scan["recent_videos_scanned"],
                "sponsorship_rate_pct": ad_scan["sponsorship_rate_pct"],
                "detected_brand_mentions": ad_scan["detected_brand_mentions"],
                "sample_sponsored_videos": ad_scan["sample_sponsored_videos"],
                "sponsored_video_examples": ad_scan["sponsored_video_examples"],
                "video_ids_analyzed": [vid],
                "bot_audit": bot_audit,
                "bot_anomaly_ratio": bot_audit["bot_anomaly_ratio"],
                "youtube_synced_at": now_iso,
                "data_source": "youtube_api_v3",
                "is_simulated": False,
            }
        )

    return results


async def lookup_youtube_handle(handle_raw: str, *, max_videos: int = 12) -> dict[str, Any]:
    """Live YouTube @handle lookup: channels (with topicDetails) -> latest 10-15 uploads -> videos -> comments."""
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        raise RuntimeError("YOUTUBE_API_KEY is not configured in environment.")

    handle = handle_raw.lstrip("@").strip()
    fetch_count = max(10, min(15, max_videos))

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Unit 1: channels?part=snippet,statistics,contentDetails,topicDetails&forHandle=
        ch_resp = await client.get(
            "https://www.googleapis.com/youtube/v3/channels",
            params={
                "part": "snippet,statistics,contentDetails,topicDetails",
                "forHandle": handle,
                "key": api_key,
            },
        )
        ch_resp.raise_for_status()
        ch_items = ch_resp.json().get("items", [])
        if not ch_items:
            raise LookupError(f"No public YouTube channel found for '@{handle}'.")

        ch = ch_items[0]
        ch_id = str(ch.get("id", ""))
        ch_snippet = ch.get("snippet", {})
        ch_stats = ch.get("statistics", {})
        ch_topic = ch.get("topicDetails", {})
        uploads_id = ch.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
        subscriber_count = int(ch_stats.get("subscriberCount", 0) or 0)
        channel_view_count = int(ch_stats.get("viewCount", 0) or 0)
        video_count = int(ch_stats.get("videoCount", 0) or 0)
        channel_title = unescape(str(ch_snippet.get("title", f"@{handle}")))
        channel_description = str(ch_snippet.get("description", ""))
        topic_categories = list(ch_topic.get("topicCategories", []) or [])

        if ch_id:
            with _STATE_LOCK:
                _CHANNEL_META_CACHE[ch_id] = ch

        if not uploads_id:
            raise LookupError(f"Channel '@{handle}' does not expose public uploads.")

        # Unit 2: playlistItems -> latest 10-15 uploaded video IDs
        pl_resp = await client.get(
            "https://www.googleapis.com/youtube/v3/playlistItems",
            params={
                "part": "contentDetails",
                "playlistId": uploads_id,
                "maxResults": fetch_count,
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

    # Unit 3 & Unit 4: batch videos stats (1 unit) + latest video commentThreads (1 unit)
    videos_data = await poll_youtube_video_stats(
        latest_ids[:fetch_count],
        include_comments=True,
        comments_limit=10,
        subscriber_override=subscriber_count,
        handle_override=handle,
        channel_meta_override=ch,
    )
    if not videos_data:
        raise LookupError(f"Unable to fetch video telemetry for '@{handle}'.")

    # Fetch comments on up to 2 additional recent videos so pinned/top comment sponsor proofs are captured
    quota_units = 4
    comments_by_video: dict[str, list[dict[str, Any]]] = {
        videos_data[0]["video_id"]: videos_data[0].get("recent_comments", [])
    }
    for extra_v in videos_data[1:3]:
        vid = extra_v["video_id"]
        extra_comments = await fetch_youtube_comments(vid, max_results=6)
        quota_units += 1
        if extra_comments:
            comments_by_video[vid] = extra_comments

    # Channel-wide multi-video niche classification & sponsorship audit across all 10-15 uploads
    detected_niche, is_beauty_creator, niche_scores = classify_creator_niche(
        topic_categories=topic_categories,
        channel_title=channel_title,
        channel_description=channel_description,
        videos=videos_data,
    )
    ad_scan = scan_sponsorship_signals(
        videos=videos_data,
        channel_description=channel_description,
        is_beauty_creator=is_beauty_creator,
        comments_by_video=comments_by_video,
    )
    bot_audit = compute_live_bot_audit(videos_data, comments_by_video.get(videos_data[0]["video_id"], []))

    view_counts = [max(0, int(v.get("views", 0) or 0)) for v in videos_data]
    median_recent_views = int(round(statistics.median(view_counts))) if view_counts else 0
    avg_likes_pm = round(sum(v["likes_per_min_signal"] for v in videos_data[:5]) / max(1, len(videos_data[:5])), 1)
    avg_shares_pm = round(sum(v["shares_per_min_signal"] for v in videos_data[:5]) / max(1, len(videos_data[:5])), 1)
    avg_comments_pm = round(sum(v["comments_per_min_signal"] for v in videos_data[:5]) / max(1, len(videos_data[:5])), 1)

    synced_at = datetime.now(timezone.utc).isoformat()
    video_ids_analyzed = [v["video_id"] for v in videos_data]

    # Enrich primary item with full 10-15 video channel-level intelligence
    primary = dict(videos_data[0])
    primary.update(
        {
            "niche": detected_niche,
            "detected_niche": detected_niche,
            "is_beauty_creator": is_beauty_creator,
            "niche_scores": niche_scores,
            "ad_readiness_score": ad_scan["ad_readiness_score"],
            "sponsored_video_count": ad_scan["sponsored_video_count"],
            "sponsored_videos_detected": ad_scan["sponsored_videos_detected"],
            "recent_videos_scanned": ad_scan["recent_videos_scanned"],
            "sponsorship_rate_pct": ad_scan["sponsorship_rate_pct"],
            "detected_brand_mentions": ad_scan["detected_brand_mentions"],
            "sample_sponsored_videos": ad_scan["sample_sponsored_videos"],
            "sponsored_video_examples": ad_scan["sponsored_video_examples"],
            "median_recent_views": median_recent_views,
            "video_ids_analyzed": video_ids_analyzed,
            "bot_audit": bot_audit,
            "bot_anomaly_ratio": bot_audit["bot_anomaly_ratio"],
            "likes_per_min_signal": int(round(avg_likes_pm)),
            "comments_per_min_signal": int(round(avg_comments_pm)),
            "shares_per_min_signal": int(round(avg_shares_pm)),
            "youtube_synced_at": synced_at,
            "data_source": "youtube_api_v3",
            "is_simulated": False,
        }
    )

    register_tracked_video_id(
        primary["video_id"],
        is_shorts_url=(primary.get("platform_key") == "youtube_shorts"),
    )

    return {
        "lookup_type": "channel_handle",
        "quota_units_used": quota_units,
        "handle": f"@{handle}",
        "channel_id": ch_id,
        "channel_title": channel_title,
        "subscriber_count": subscriber_count,
        "channel_view_count": channel_view_count,
        "video_count": video_count,
        "detected_niche": detected_niche,
        "is_beauty_creator": is_beauty_creator,
        "ad_readiness_score": ad_scan["ad_readiness_score"],
        "sponsored_video_count": ad_scan["sponsored_video_count"],
        "sponsored_videos_detected": ad_scan["sponsored_videos_detected"],
        "recent_videos_scanned": ad_scan["recent_videos_scanned"],
        "sponsorship_rate_pct": ad_scan["sponsorship_rate_pct"],
        "detected_brand_mentions": ad_scan["detected_brand_mentions"],
        "sample_sponsored_videos": ad_scan["sample_sponsored_videos"],
        "sponsored_video_examples": ad_scan["sponsored_video_examples"],
        "median_recent_views": median_recent_views,
        "video_ids_analyzed": video_ids_analyzed,
        "bot_audit": bot_audit,
        "youtube_synced_at": synced_at,
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


async def lookup_youtube_video_with_channel_context(video_id: str, *, is_shorts_url: bool = False) -> dict[str, Any]:
    """Fetch a single video AND enrich it with its channel's recent 12 uploads for accurate niche/ad audit."""
    items = await poll_youtube_video_stats(
        [video_id],
        include_comments=True,
        comments_limit=10,
        shorts_url_ids={video_id} if is_shorts_url else set(),
    )
    if not items:
        raise LookupError(f"No public YouTube video found for ID '{video_id}'.")

    primary = dict(items[0])
    channel_id = str(primary.get("channel_id", ""))
    ch_meta = _CHANNEL_META_CACHE.get(channel_id, {})
    uploads_id = ch_meta.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
    api_key = os.getenv("YOUTUBE_API_KEY")

    if uploads_id and api_key:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                pl_resp = await client.get(
                    "https://www.googleapis.com/youtube/v3/playlistItems",
                    params={
                        "part": "contentDetails",
                        "playlistId": uploads_id,
                        "maxResults": 12,
                        "key": api_key,
                    },
                )
                if pl_resp.status_code == 200:
                    extra_ids = [
                        str(it.get("contentDetails", {}).get("videoId", ""))
                        for it in pl_resp.json().get("items", [])
                        if it.get("contentDetails", {}).get("videoId")
                    ]
                    if video_id not in extra_ids:
                        extra_ids.insert(0, video_id)
                    all_videos = await poll_youtube_video_stats(
                        extra_ids[:12],
                        include_comments=False,
                        shorts_url_ids={video_id} if is_shorts_url else set(),
                        channel_meta_override=ch_meta,
                    )
                    if all_videos:
                        detected_niche, is_beauty, niche_scores = classify_creator_niche(
                            topic_categories=primary.get("topic_categories"),
                            channel_title=primary.get("channel_title", ""),
                            channel_description=primary.get("channel_description", ""),
                            videos=all_videos,
                        )
                        ad_scan = scan_sponsorship_signals(
                            videos=all_videos,
                            channel_description=primary.get("channel_description", ""),
                            is_beauty_creator=is_beauty,
                            comments_by_video={video_id: primary.get("recent_comments", [])},
                        )
                        bot_audit = compute_live_bot_audit(all_videos, primary.get("recent_comments", []))
                        view_counts = [max(0, int(v.get("views", 0) or 0)) for v in all_videos]
                        primary.update(
                            {
                                "niche": detected_niche,
                                "detected_niche": detected_niche,
                                "is_beauty_creator": is_beauty,
                                "niche_scores": niche_scores,
                                "ad_readiness_score": ad_scan["ad_readiness_score"],
                                "sponsored_video_count": ad_scan["sponsored_video_count"],
                                "sponsored_videos_detected": ad_scan["sponsored_videos_detected"],
                                "recent_videos_scanned": ad_scan["recent_videos_scanned"],
                                "sponsorship_rate_pct": ad_scan["sponsorship_rate_pct"],
                                "detected_brand_mentions": ad_scan["detected_brand_mentions"],
                                "sample_sponsored_videos": ad_scan["sample_sponsored_videos"],
                                "sponsored_video_examples": ad_scan["sponsored_video_examples"],
                                "median_recent_views": int(round(statistics.median(view_counts))) if view_counts else primary["views"],
                                "video_ids_analyzed": [v["video_id"] for v in all_videos],
                                "bot_audit": bot_audit,
                                "bot_anomaly_ratio": bot_audit["bot_anomaly_ratio"],
                            }
                        )
        except Exception:
            pass

    register_tracked_video_id(
        video_id,
        is_shorts_url=(is_shorts_url or primary.get("platform_key") == "youtube_shorts"),
    )
    return primary
