"""
VoltexAI - Auth service
Password hashing (bcrypt via passlib) + JWT issue/verify for access & refresh tokens.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext

from ..config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ---------- token helpers ----------
def _encode(payload: dict, expires_delta: timedelta) -> str:
    to_encode = payload.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: int, email: str, plan: str = "free") -> str:
    return _encode(
        {"sub": str(user_id), "email": email, "plan": plan, "type": "access"},
        timedelta(minutes=settings.ACCESS_TOKEN_TTL_MIN),
    )


def create_refresh_token(user_id: int) -> str:
    return _encode(
        {"sub": str(user_id), "type": "refresh"},
        timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS),
    )


def create_reset_token(user_id: int) -> str:
    return _encode(
        {"sub": str(user_id), "type": "reset"},
        timedelta(minutes=settings.PASSWORD_RESET_TTL_MIN),
    )


def create_verification_token(user_id: int) -> str:
    return _encode(
        {"sub": str(user_id), "type": "verify"},
        timedelta(days=3),
    )


def decode_token(token: str, expected_type: Optional[str] = None) -> dict:
    """Returns the payload dict. Raises JWTError on failure / wrong type."""
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    if expected_type and payload.get("type") != expected_type:
        raise JWTError(f"Wrong token type: expected {expected_type}, got {payload.get('type')}")
    return payload
