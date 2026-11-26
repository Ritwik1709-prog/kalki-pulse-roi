"""SQLite persistence and demo user seeding for KALKI Pulse auth."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from pwdlib import PasswordHash

DB_PATH = Path(__file__).resolve().parent / "kalki_pulse.db"

password_hash = PasswordHash.recommended()


@contextmanager
def get_db() -> Iterator[sqlite3.Connection]:
    """Yield a SQLite connection configured with row factory and automatic close."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create core tables if they do not yet exist and seed the demo account."""
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                influencer_id TEXT NOT NULL,
                social_platform TEXT NOT NULL,
                target_channel TEXT NOT NULL,
                product_category TEXT NOT NULL,
                campaign_budget REAL NOT NULL,
                product_price REAL NOT NULL,
                estimated_reach INTEGER NOT NULL,
                predicted_ctr_pct REAL NOT NULL,
                store_visits INTEGER NOT NULL,
                predicted_conversions INTEGER NOT NULL,
                expected_gross_revenue REAL NOT NULL,
                cpc REAL NOT NULL,
                net_roi_percent REAL NOT NULL,
                inference_latency_ms REAL NOT NULL,
                decision_tier TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
            """
        )
    seed_demo_user()


def seed_demo_user() -> None:
    """Ensure the ready-to-use faculty/reviewer demo account exists."""
    demo_email = "demo@kalkisaas.com"
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE lower(email) = lower(?)",
            (demo_email,),
        ).fetchone()
        if existing:
            return

        hashed = password_hash.hash("KalkiPulse2026!")
        created_at = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT INTO users (full_name, brand_name, role, email, hashed_password, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
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
