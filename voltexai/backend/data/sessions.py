"""
Voltex Live Sessions — market session clocks + the live trading-session schedule.
Session status is computed from the current UTC time; times are also rendered in
Central Africa Time (CAT / Zambia, UTC+2, no DST) and any other zone offset, so a
Zambian trader sees the market clock in local terms. The streamed sessions are a
representative weekly schedule (times in UTC).
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

# Zambia / Central Africa Time — fixed UTC+2, no daylight saving.
CAT_OFFSET_HOURS = 2
CAT = timezone(timedelta(hours=CAT_OFFSET_HOURS))

# Global city clocks we surface alongside CAT (label, UTC offset hours).
# Fixed offsets kept intentionally simple; DST is not modelled.
WORLD_CLOCKS = [
    ("Lusaka (CAT)", 2), ("London", 0), ("New York", -5),
    ("Dubai", 4), ("Tokyo", 9), ("Sydney", 10),
]

# name, open UTC hour, close UTC hour, emoji
MARKET_SESSIONS = [
    ("Sydney", 21, 6, "🇦🇺"),
    ("Tokyo", 0, 9, "🇯🇵"),
    ("London", 7, 16, "🇬🇧"),
    ("New York", 12, 21, "🇺🇸"),
]


def _cat(utc_hour: int) -> str:
    """Format a UTC hour as HH:00 in Central Africa Time (Zambia)."""
    return f"{(utc_hour + CAT_OFFSET_HOURS) % 24:02d}:00"

# Weekly live trading streams (weekday 0=Mon..4=Fri), UTC start hour, duration mins
LIVE_STREAMS = [
    {"title": "London Open Live", "host": "Owens Forex Academy", "days": [0, 1, 2, 3, 4],
     "utc_hour": 7, "duration_min": 90, "focus": "FX majors · Gold", "level": "All"},
    {"title": "NY Killzone Live", "host": "VoltexAI Desk", "days": [0, 1, 2, 3, 4],
     "utc_hour": 13, "duration_min": 90, "focus": "Indices · NAS100 · US30", "level": "Intermediate"},
    {"title": "Asia Session Prep", "host": "VoltexAI Desk", "days": [0, 1, 2, 3, 4],
     "utc_hour": 23, "duration_min": 60, "focus": "JPY pairs · setups", "level": "All"},
    {"title": "Weekly Market Outlook", "host": "OP OWENS PHIRI", "days": [6],
     "utc_hour": 16, "duration_min": 75, "focus": "The week ahead · macro", "level": "All"},
    {"title": "Crypto Futures Live", "host": "VoltexAI Desk", "days": [2, 4],
     "utc_hour": 18, "duration_min": 60, "focus": "BTC · ETH perps", "level": "Advanced"},
]


def _is_open(now_h: float, o: int, c: int) -> bool:
    if o < c:
        return o <= now_h < c
    return now_h >= o or now_h < c   # wraps midnight


def session_quality(now: datetime | None = None) -> dict:
    """Liquidity/quality tier of the current moment for signal generation.

    The London↔New York overlap is the deepest-liquidity window of the day and
    the sweet spot for a Zambian trader (mid-afternoon CAT). A single major
    session is good; the Asia-only and post-NY hours are thin.
    """
    now = now or datetime.now(timezone.utc)
    now_h = now.hour + now.minute / 60.0
    london = _is_open(now_h, 7, 16)
    ny = _is_open(now_h, 12, 21)
    tokyo = _is_open(now_h, 0, 9)
    weekday = now.weekday()  # 0=Mon..6=Sun
    if weekday >= 5:
        return {"tier": "closed", "score": 0, "multiplier": 0.0,
                "label": "Weekend — FX closed", "advice": "Markets are closed. Plan, don't trade."}
    if london and ny:
        return {"tier": "prime", "score": 100, "multiplier": 1.0,
                "label": "London ↔ New York overlap",
                "advice": "Prime window — deepest liquidity. Best time for a Zambian trader (mid-afternoon CAT)."}
    if london or ny:
        who = "London" if london else "New York"
        return {"tier": "high", "score": 80, "multiplier": 0.9,
                "label": f"{who} session",
                "advice": "Strong session — quality setups on majors and gold."}
    if tokyo:
        return {"tier": "medium", "score": 55, "multiplier": 0.7,
                "label": "Asia (Tokyo) session",
                "advice": "Thinner liquidity — favour JPY pairs, keep size modest."}
    return {"tier": "low", "score": 30, "multiplier": 0.5,
            "label": "Off-session (thin liquidity)",
            "advice": "Low liquidity — patience pays. Wait for London (09:00 CAT)."}


def _zambia_guidance(now: datetime) -> dict:
    """When a Zambian (CAT) trader should be at the screen, in local time."""
    q = session_quality(now)
    return {
        "timezone": "CAT (UTC+2) · Zambia",
        "now_cat": now.astimezone(CAT).strftime("%H:%M"),
        "current": q,
        "windows": [
            {"name": "London Open", "cat": "09:00–11:00",
             "note": "First surge of volatility — momentum on FX & gold."},
            {"name": "Prime — London/NY overlap", "cat": "14:00–18:00",
             "note": "Deepest liquidity of the day. The best window to trade from Zambia."},
            {"name": "New York", "cat": "14:00–23:00",
             "note": "Indices (NAS100/US30), gold, USD news."},
            {"name": "Asia (Tokyo)", "cat": "02:00–11:00",
             "note": "Quieter — JPY pairs; usually before the working day."},
        ],
        "best_window_cat": "14:00–18:00",
    }


def sessions_status() -> dict:
    now = datetime.now(timezone.utc)
    now_h = now.hour + now.minute / 60.0
    out = []
    for name, o, c, flag in MARKET_SESSIONS:
        is_open = _is_open(now_h, o, c)
        # hours until next open/close
        target = c if is_open else o
        delta = (target - now_h) % 24
        out.append({"name": name, "flag": flag, "open": is_open,
                    "hours_to_change": round(delta, 1),
                    "state": "closes in" if is_open else "opens in",
                    "open_utc": f"{o:02d}:00", "close_utc": f"{c:02d}:00",
                    "open_cat": _cat(o), "close_cat": _cat(c)})
    open_now = [s["name"] for s in out if s["open"]]
    overlap = "London" in open_now and "New York" in open_now
    world = [{"label": lbl, "time": now.astimezone(timezone(timedelta(hours=off))).strftime("%H:%M"),
              "offset": off} for lbl, off in WORLD_CLOCKS]
    return {
        "utc_time": now.strftime("%H:%M UTC"),
        "cat_time": now.astimezone(CAT).strftime("%H:%M"),
        "sessions": out,
        "open_now": open_now,
        "london_ny_overlap": overlap,
        "world_clocks": world,
        "quality": session_quality(now),
        "zambia": _zambia_guidance(now),
    }


def next_streams(limit: int = 6) -> list[dict]:
    now = datetime.now(timezone.utc)
    upcoming = []
    for offset in range(0, 8):
        day = now + timedelta(days=offset)
        for s in LIVE_STREAMS:
            if day.weekday() in s["days"]:
                start = day.replace(hour=s["utc_hour"], minute=0, second=0, microsecond=0)
                if start < now:
                    continue
                live = start <= now < start + timedelta(minutes=s["duration_min"])
                upcoming.append({**{k: s[k] for k in ("title", "host", "focus", "level", "duration_min")},
                                 "starts_at": start.isoformat(),
                                 "starts_utc": start.strftime("%a %H:%M UTC"),
                                 "starts_cat": start.astimezone(CAT).strftime("%a %H:%M"),
                                 "is_live": live})
    upcoming.sort(key=lambda x: x["starts_at"])
    return upcoming[:limit]
