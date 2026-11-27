"""Aiven PostgreSQL persistence and demo user seeding for KALKI Pulse auth."""

from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator
from urllib.parse import parse_qsl, urlsplit, urlunsplit

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from pwdlib import PasswordHash

ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")
load_dotenv()

password_hash = PasswordHash.recommended()

_pool: ConnectionPool | None = None


def _get_database_url() -> str:
    """Read DATABASE_URL from env and ensure sslmode=require is present."""
    raw_url = os.getenv("DATABASE_URL", "").strip()
    if not raw_url:
        raise RuntimeError(
            "DATABASE_URL environment variable is missing. "
            "Provide your Aiven PostgreSQL connection URI."
        )

    parsed = urlsplit(raw_url)
    query_params = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if "sslmode" not in query_params:
        updated_query = f"{parsed.query}&sslmode=require" if parsed.query else "sslmode=require"
        raw_url = urlunsplit(
            (parsed.scheme, parsed.netloc, parsed.path, updated_query, parsed.fragment)
        )
    return raw_url


def _get_pool() -> ConnectionPool:
    """Return a singleton psycopg ConnectionPool sized for Aiven free-tier limits."""
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=_get_database_url(),
            min_size=1,
            max_size=5,
            kwargs={"row_factory": dict_row},
        )
    return _pool


@contextmanager
def get_db() -> Iterator[psycopg.Connection]:
    """Yield a pooled PostgreSQL connection with commit on success and rollback on error."""
    pool = _get_pool()
    with pool.connection() as conn:
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def init_db() -> None:
    """Create core tables if they do not yet exist and seed the demo account."""
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                full_name TEXT NOT NULL,
                brand_name TEXT NOT NULL,
                role TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                hashed_password TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS prediction_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                influencer_id TEXT NOT NULL,
                social_platform TEXT NOT NULL,
                target_channel TEXT NOT NULL,
                product_category TEXT NOT NULL,
                campaign_budget DOUBLE PRECISION NOT NULL,
                product_price DOUBLE PRECISION NOT NULL,
                estimated_reach INTEGER NOT NULL,
                predicted_ctr_pct DOUBLE PRECISION NOT NULL,
                store_visits INTEGER NOT NULL,
                predicted_conversions INTEGER NOT NULL,
                expected_gross_revenue DOUBLE PRECISION NOT NULL,
                cpc DOUBLE PRECISION NOT NULL,
                net_roi_percent DOUBLE PRECISION NOT NULL,
                inference_latency_ms DOUBLE PRECISION NOT NULL,
                decision_tier TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
    seed_demo_user()


def seed_demo_user() -> None:
    """Ensure the ready-to-use faculty/reviewer demo account exists."""
    demo_email = "demo@kalkisaas.com"
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE lower(email) = lower(%s)",
            (demo_email,),
        ).fetchone()
        if existing:
            return

        hashed = password_hash.hash("KalkiPulse2026!")
        created_at = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT INTO users (full_name, brand_name, role, email, hashed_password, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                "KALKI SaaS Demo",
                "KALKI SaaS Demo Brand",
                "Brand Marketer",
                demo_email,
                hashed,
                created_at,
            ),
        )
