"""Argon2 + PyJWT authentication routes and verification dependencies."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Literal

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from database import get_db, password_hash

load_dotenv()

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
_DEV_FALLBACK_SECRET = "kalki-pulse-dev-secret-key-min-32-bytes-long-2026!"

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", _DEV_FALLBACK_SECRET)
if len(JWT_SECRET_KEY.encode("utf-8")) < 32:
    raise RuntimeError("JWT_SECRET_KEY must be at least 32 bytes long for HS256.")

# Pre-computed dummy hash to equalize timing when a login email does not exist
_DUMMY_HASH = password_hash.hash("dummy-timing-equalizer-password")

bearer_scheme = HTTPBearer(auto_error=False)
router = APIRouter(prefix="/api/auth", tags=["Authentication"])

RoleType = Literal["Brand Marketer", "Data Scientist", "Agency Lead"]


class SignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    brand_name: str = Field(..., min_length=2, max_length=120)
    role: RoleType = "Brand Marketer"
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserPublic(BaseModel):
    id: int
    full_name: str
    brand_name: str
    role: str
    email: EmailStr
    created_at: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


def _row_to_public_user(row: object) -> UserPublic:
    return UserPublic(
        id=row["id"],
        full_name=row["full_name"],
        brand_name=row["brand_name"],
        role=row["role"],
        email=row["email"],
        created_at=row["created_at"],
    )


def create_access_token(user: UserPublic) -> str:
    """Issue a signed HS256 JWT expiring in ACCESS_TOKEN_EXPIRE_MINUTES."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "brand_name": user.brand_name,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UserPublic:
    """Decode Bearer JWT and return the active user record without password hash."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
        user_id = int(payload["sub"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    with get_db() as conn:
        row = conn.execute(
            """
            SELECT id, full_name, brand_name, role, email, created_at
            FROM users
            WHERE id = %s
            """,
            (user_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user record no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _row_to_public_user(row)


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest) -> AuthResponse:
    """Register a new brand workspace user and return a signed JWT."""
    normalized_email = payload.email.strip().lower()
    full_name = payload.full_name.strip()
    brand_name = payload.brand_name.strip()

    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE lower(email) = %s",
            (normalized_email,),
        ).fetchone()
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this work email already exists.",
            )

        hashed = password_hash.hash(payload.password)
        created_at = datetime.now(timezone.utc).isoformat()
        cursor = conn.execute(
            """
            INSERT INTO users (full_name, brand_name, role, email, hashed_password, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (full_name, brand_name, payload.role, normalized_email, hashed, created_at),
        )
        user_id = cursor.fetchone()["id"]
        row = conn.execute(
            """
            SELECT id, full_name, brand_name, role, email, created_at
            FROM users
            WHERE id = %s
            """,
            (user_id,),
        ).fetchone()

    user = _row_to_public_user(row)
    token = create_access_token(user)
    return AuthResponse(access_token=token, user=user)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest) -> AuthResponse:
    """Verify email + Argon2 password hash and issue an HS256 JWT."""
    normalized_email = payload.email.strip().lower()

    with get_db() as conn:
        row = conn.execute(
            """
            SELECT id, full_name, brand_name, role, email, hashed_password, created_at
            FROM users
            WHERE lower(email) = %s
            """,
            (normalized_email,),
        ).fetchone()

    if row is None:
        password_hash.verify(payload.password, _DUMMY_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not password_hash.verify(payload.password, row["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user = _row_to_public_user(row)
    token = create_access_token(user)
    return AuthResponse(access_token=token, user=user)


@router.get("/me", response_model=UserPublic)
def me(current_user: UserPublic = Depends(get_current_user)) -> UserPublic:
    """Return the authenticated user's public profile."""
    return current_user
