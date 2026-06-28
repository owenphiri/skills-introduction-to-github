"""
VoltexAI - Rate limiting
Simple in-process counters keyed by (user_id, date). For production replace with Redis
INCR + TTL. Logic is wrapped behind one function so swap is one-file.
"""
from collections import defaultdict
from datetime import date
from threading import Lock

from fastapi import HTTPException, status

from ..config import settings
from ..models import User, PlanTier


_COUNTERS: dict[tuple[int, str], int] = defaultdict(int)
_LOCK = Lock()


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
