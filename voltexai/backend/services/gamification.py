"""
Voltex gamification — XP, levels, ranks, badges, streaks.
Derives a real, data-driven profile from what the user has actually done (trades,
AI usage, verification, plan) so progression feels earned. No extra tables needed.
"""
from __future__ import annotations

import math
from datetime import datetime

from sqlalchemy.orm import Session

from ..models import User, Conversation, Order, BrokerAccount, KycRecord, KycStatus

RANKS = [
    (0, "Novice"), (5, "Apprentice"), (10, "Trader"), (18, "Strategist"),
    (28, "Sniper"), (40, "Elite"), (55, "Master"), (75, "Legend"),
]


def _level_from_xp(xp: int) -> int:
    # smooth curve: each level costs a bit more than the last
    return int((math.sqrt(max(xp, 0) / 50.0)))


def _xp_for_level(level: int) -> int:
    return int((level ** 2) * 50)


def _rank_for_level(level: int) -> str:
    title = RANKS[0][1]
    for lvl, name in RANKS:
        if level >= lvl:
            title = name
    return title


def profile(db: Session, user: User) -> dict:
    trades = (db.query(Order).join(BrokerAccount)
                .filter(BrokerAccount.user_id == user.id).count())
    convos = db.query(Conversation).filter(Conversation.user_id == user.id).count()
    acc = db.query(BrokerAccount).filter(BrokerAccount.user_id == user.id).first()
    realized = acc.realized_pnl if acc else 0.0
    kyc = db.query(KycRecord).filter(KycRecord.user_id == user.id).first()
    verified = bool(kyc and kyc.status == KycStatus.APPROVED)
    plan = user.subscription.plan.value if user.subscription else "free"
    days = max(1, (datetime.utcnow() - user.created_at).days)

    xp = (trades * 25 + convos * 10
          + (250 if verified else 0)
          + {"free": 0, "trader": 300, "elite": 800}.get(plan, 0)
          + int(max(0.0, realized) / 10))
    level = _level_from_xp(xp)
    cur_floor = _xp_for_level(level)
    next_floor = _xp_for_level(level + 1)

    badges = _badges(trades, convos, realized, verified, plan, days)
    return {
        "xp": xp,
        "level": level,
        "rank": _rank_for_level(level),
        "xp_into_level": xp - cur_floor,
        "xp_for_next": next_floor - cur_floor,
        "progress_pct": round((xp - cur_floor) / max(1, next_floor - cur_floor) * 100, 1),
        "stats": {"trades": trades, "ai_sessions": convos,
                  "realized_pnl": round(realized, 2), "verified": verified,
                  "plan": plan, "day_streak": min(days, 999)},
        "badges": badges,
    }


def _badges(trades, convos, realized, verified, plan, days) -> list[dict]:
    defs = [
        ("first_trade", "First Blood", "🎯", "Placed your first trade", trades >= 1),
        ("ten_trades", "Getting Serious", "🔥", "10 trades placed", trades >= 10),
        ("century", "Century Club", "💯", "100 trades placed", trades >= 100),
        ("profitable", "In The Green", "📈", "Positive realized P&L", realized > 0),
        ("ai_adept", "AI Adept", "🧠", "10+ AI terminal sessions", convos >= 10),
        ("verified", "Verified", "✅", "Identity verified (KYC)", verified),
        ("elite", "Elite Member", "👑", "On the Elite plan", plan == "elite"),
        ("veteran", "Veteran", "🎖️", "30+ days on VoltexAI", days >= 30),
    ]
    return [{"id": i, "name": n, "icon": ic, "desc": d, "earned": bool(e)}
            for (i, n, ic, d, e) in defs]
