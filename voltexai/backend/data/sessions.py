"""
Voltex Live Sessions — market session clocks + the live trading-session schedule.
Session status is computed from the current UTC time; the streamed sessions are a
representative weekly schedule (times in UTC).
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

# name, open UTC hour, close UTC hour, emoji
MARKET_SESSIONS = [
    ("Sydney", 21, 6, "🇦🇺"),
    ("Tokyo", 0, 9, "🇯🇵"),
    ("London", 7, 16, "🇬🇧"),
    ("New York", 12, 21, "🇺🇸"),
]

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
                    "open_utc": f"{o:02d}:00", "close_utc": f"{c:02d}:00"})
    open_now = [s["name"] for s in out if s["open"]]
    overlap = "London" in open_now and "New York" in open_now
    return {"utc_time": now.strftime("%H:%M UTC"), "sessions": out,
            "open_now": open_now, "london_ny_overlap": overlap}


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
                                 "is_live": live})
    upcoming.sort(key=lambda x: x["starts_at"])
    return upcoming[:limit]
