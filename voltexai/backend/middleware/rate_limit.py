"""
VoltexAI - Rate limiting
Simple in-process counters keyed by (user_id, date). For production replace with Redis
INCR + TTL. Logic is wrapped behind one function so swap is one-file.
"""
import time
from collections import defaultdict, deque
from datetime import date
from threading import Lock

from fastapi import HTTPException, Request, status

from ..config import settings
from ..models import User, PlanTier


_COUNTERS: dict[tuple[int, str], int] = defaultdict(int)
_LOCK = Lock()

# --- brute-force throttle for unauthenticated endpoints (per client IP) ---
_ATTEMPTS: dict[str, deque] = defaultdict(deque)
_ATTEMPT_LOCK = Lock()


def throttle(request: Request, action: str, limit: int = 10,
             window_s: int = 60) -> None:
    """Sliding-window per-IP limiter for auth endpoints. Raises 429 when exceeded.
    In-process only; swap for Redis in a multi-instance deployment."""
    if not settings.AUTH_THROTTLE_ENABLED:
        return
    ip = request.client.host if request.client else "unknown"
    key = f"{action}:{ip}"
    now = time.time()
    with _ATTEMPT_LOCK:
        q = _ATTEMPTS[key]
        while q and now - q[0] > window_s:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait a minute and try again.",
            )
        q.append(now)


def _limit_for(user: User) -> int:
    plan = user.subscription.plan if user.subscription else PlanTier.FREE
    return {
        PlanTier.FREE: settings.RATE_FREE,
        PlanTier.TRADER: settings.RATE_TRADER,
        PlanTier.ELITE: settings.RATE_ELITE,
    }[plan]


def check_and_increment(user: User) -> int:
    """Raises 429 if over the day's limit. Returns remaining calls."""
    today = date.today().isoformat()
    key = (user.id, today)
    limit = _limit_for(user)
    with _LOCK:
        used = _COUNTERS[key]
        if used >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Daily AI quota reached ({limit}). Upgrade your plan.",
            )
        _COUNTERS[key] = used + 1
        return limit - (used + 1)


def remaining_for(user: User) -> dict:
    today = date.today().isoformat()
    used = _COUNTERS.get((user.id, today), 0)
    limit = _limit_for(user)
    return {"used": used, "limit": limit, "remaining": max(0, limit - used)}
