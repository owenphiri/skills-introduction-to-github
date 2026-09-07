"""
VoltexAI - High-impact news events (News Trading).

A rule-based schedule of the market-moving economic events traders build live
sessions around — NFP, CPI, FOMC and the other big prints — with, for each, the
affected instruments, a live "news window", and a professional trade playbook.

Schedules are computed from clean recurrence rules (e.g. NFP = 1st Friday 12:30
UTC) so occurrences are deterministic. They are REPRESENTATIVE: exact release
dates/times shift and must be confirmed on an official economic calendar before
trading. Times are UTC; CAT (Zambia, UTC+2) is added for the local audience.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta, date

CAT = timezone(timedelta(hours=2))

# High-impact instruments most reactive to USD macro (used as sensible defaults)
_USD_HOT = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "US30", "NAS100", "SPX500", "BTCUSD"]

EVENTS = [
    {
        "code": "NFP", "name": "Non-Farm Payrolls", "currency": "USD", "impact": "high",
        "schedule": {"type": "nth_weekday", "n": 1, "weekday": 4, "time": "12:30"},
        "instruments": _USD_HOT, "pre_min": 15, "post_min": 60,
        "why": "The month's biggest US jobs print — the single most volatile scheduled release for the dollar, gold and indices.",
        "playbook": [
            "Be flat or hedged into the release unless you specifically trade news.",
            "Expect a violent two-way spike; spreads widen — never chase the first candle.",
            "Let the first 5–15m candle close to define direction, then trade the retest/continuation.",
            "Use wider stops (ATR ×2+) and reduced size; let the auto-trader's news guard pause entries.",
        ],
    },
    {
        "code": "CPI", "name": "US CPI (Inflation)", "currency": "USD", "impact": "high",
        "schedule": {"type": "monthly_day", "day": 13, "time": "12:30"},
        "instruments": _USD_HOT, "pre_min": 15, "post_min": 45,
        "why": "Inflation surprises reprice Fed rate expectations instantly — huge for gold, USD pairs and indices.",
        "playbook": [
            "Know the forecast vs prior; the surprise vs consensus is what moves price.",
            "Fade the initial spike only with confirmation — first move is often a liquidity grab.",
            "Trade the 15m structure break after the dust settles.",
            "Reduce size; volatility can be 2–3× a normal session.",
        ],
    },
    {
        "code": "FOMC", "name": "FOMC Rate Decision", "currency": "USD", "impact": "high",
        "schedule": {"type": "nth_weekday", "n": 3, "weekday": 2, "time": "18:00"},
        "instruments": _USD_HOT, "pre_min": 20, "post_min": 90,
        "why": "The Fed's rate decision + statement, then the press conference — trend-defining for weeks.",
        "playbook": [
            "Two waves: the 18:00 statement, then the 18:30 press conference — both move markets.",
            "Avoid holding naked positions into it; the whipsaw is brutal.",
            "Wait for the presser to finish before committing to a directional swing.",
            "Respect the daily bias set after the close — it often persists.",
        ],
    },
    {
        "code": "ECB", "name": "ECB Rate Decision", "currency": "EUR", "impact": "high",
        "schedule": {"type": "nth_weekday", "n": 2, "weekday": 3, "time": "12:15"},
        "instruments": ["EURUSD", "EURGBP", "EURJPY", "GER40", "XAUUSD"], "pre_min": 15, "post_min": 75,
        "why": "Decision at 12:15 UTC then Lagarde's presser at 12:45 — the euro complex's main event.",
        "playbook": [
            "Statement then presser — trade the presser reaction, not the headline.",
            "EURUSD, EURGBP and DAX are the cleanest expressions.",
            "Wider stops; expect stop-hunts around the release.",
        ],
    },
    {
        "code": "BOE", "name": "BoE Rate Decision", "currency": "GBP", "impact": "high",
        "schedule": {"type": "nth_weekday", "n": 1, "weekday": 3, "time": "11:00"},
        "instruments": ["GBPUSD", "EURGBP", "GBPJPY", "UK100"], "pre_min": 15, "post_min": 60,
        "why": "The Bank of England vote split & statement — cable's biggest scheduled mover.",
        "playbook": [
            "Watch the vote split — a surprise dissent moves GBP hard.",
            "GBPUSD and GBPJPY offer the most range; mind the wider spreads.",
        ],
    },
    {
        "code": "CLAIMS", "name": "US Jobless Claims", "currency": "USD", "impact": "medium",
        "schedule": {"type": "weekly", "weekday": 3, "time": "12:30"},
        "instruments": ["XAUUSD", "EURUSD", "US30", "NAS100"], "pre_min": 5, "post_min": 20,
        "why": "Weekly labour-market pulse — a quick, tradable burst of volatility every Thursday.",
        "playbook": [
            "A fast scalp event — in and out around the 5–15m reaction.",
            "Only trade with the higher-timeframe bias; skip if choppy.",
        ],
    },
    {
        "code": "RETAIL", "name": "US Retail Sales", "currency": "USD", "impact": "medium",
        "schedule": {"type": "monthly_day", "day": 15, "time": "12:30"},
        "instruments": ["XAUUSD", "EURUSD", "US30", "NAS100"], "pre_min": 10, "post_min": 30,
        "why": "Consumer-spending health — a solid secondary USD driver.",
        "playbook": [
            "Confirm with CPI/NFP context that week.",
            "Trade the retest of the release candle, not the spike.",
        ],
    },
    {
        "code": "PMI", "name": "Global PMIs (Flash)", "currency": "Multi", "impact": "medium",
        "schedule": {"type": "monthly_day", "day": 24, "time": "09:00"},
        "instruments": ["EURUSD", "GBPUSD", "GER40", "UK100"], "pre_min": 5, "post_min": 20,
        "why": "Forward-looking growth gauges across the EU/UK — moves the majors and indices.",
        "playbook": [
            "Manufacturing + services prints cluster together — net surprise matters.",
            "Best on EUR/GBP crosses and European indices in the London session.",
        ],
    },
]

EVENTS_BY_CODE = {e["code"]: e for e in EVENTS}


# ----------------------------- occurrence engine -----------------------------
def _at(d: date, hhmm: str) -> datetime:
    h, m = (int(x) for x in hhmm.split(":"))
    return datetime(d.year, d.month, d.day, h, m, tzinfo=timezone.utc)


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    first = date(year, month, 1)
    offset = (weekday - first.weekday()) % 7
    return date(year, month, 1 + offset + (n - 1) * 7)


def _shift_to_weekday(d: date) -> date:
    if d.weekday() == 5:      # Saturday -> Friday
        return d - timedelta(days=1)
    if d.weekday() == 6:      # Sunday -> Monday
        return d + timedelta(days=1)
    return d


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    idx = (year * 12 + (month - 1)) + delta
    return idx // 12, idx % 12 + 1


def _monthly_day_occ(y: int, m: int, day: int, t: str) -> datetime:
    try:
        d = date(y, m, day)
    except ValueError:
        d = date(y, m, 28)
    return _at(_shift_to_weekday(d), t)


def _candidates(event: dict, now: datetime) -> list[datetime]:
    """Occurrence datetimes bracketing `now` (previous, current, next), so we can
    tell whether we're inside a release window rather than only looking ahead."""
    s = event["schedule"]
    t = s["time"]
    if s["type"] == "weekly":
        wd = s["weekday"]
        base = now.date() + timedelta(days=(wd - now.weekday()) % 7)
        return [_at(base + timedelta(days=off), t) for off in (-14, -7, 0, 7)]
    if s["type"] == "nth_weekday":
        out = []
        for delta in (-1, 0, 1):
            y, m = _shift_month(now.year, now.month, delta)
            out.append(_at(_nth_weekday(y, m, s["weekday"], s["n"]), t))
        return out
    if s["type"] == "monthly_day":
        out = []
        for delta in (-1, 0, 1):
            y, m = _shift_month(now.year, now.month, delta)
            out.append(_monthly_day_occ(y, m, s["day"], t))
        return out
    raise ValueError(f"unknown schedule type {s['type']}")


def next_occurrence(event: dict, now: datetime) -> datetime:
    """The next scheduled release strictly after `now`."""
    future = [c for c in _candidates(event, now) if c > now]
    return min(future) if future else min(_candidates(event, now))


def _relevant(event: dict, now: datetime) -> tuple[datetime, bool, str | None]:
    """Pick the occurrence whose window is active now (previous still inside its
    post-window, or next already inside its pre-window); else the next release."""
    pre = timedelta(minutes=event["pre_min"])
    post = timedelta(minutes=event["post_min"])
    cands = sorted(_candidates(event, now))
    prev = max((c for c in cands if c <= now), default=None)
    nxt = min((c for c in cands if c > now), default=None)
    if prev is not None and now <= prev + post:
        return prev, True, "post-release (high volatility)"
    if nxt is not None and now >= nxt - pre:
        return nxt, True, "pre-release"
    return (nxt or prev), False, None


def _fmt_countdown(delta: timedelta) -> str:
    secs = int(delta.total_seconds())
    if secs < 0:
        return "now"
    d, rem = divmod(secs, 86400)
    h, rem = divmod(rem, 3600)
    mnt = rem // 60
    if d:
        return f"{d}d {h}h"
    if h:
        return f"{h}h {mnt}m"
    return f"{mnt}m"


def _project(event: dict, now: datetime) -> dict:
    rel, live, phase = _relevant(event, now)
    pre = timedelta(minutes=event["pre_min"])
    post = timedelta(minutes=event["post_min"])
    return {
        "code": event["code"], "name": event["name"], "currency": event["currency"],
        "impact": event["impact"], "instruments": event["instruments"],
        "why": event["why"], "playbook": event["playbook"],
        "release_utc": rel.strftime("%a %d %b %H:%M"),
        "release_cat": rel.astimezone(CAT).strftime("%a %d %b %H:%M"),
        "release_iso": rel.isoformat(),
        "minutes_to": round((rel - now).total_seconds() / 60),
        "countdown": _fmt_countdown(rel - now),
        "live": live, "phase": phase,
        "window": {"opens_iso": (rel - pre).isoformat(), "closes_iso": (rel + post).isoformat()},
    }


def news_status(now: datetime | None = None, horizon_days: int = 10) -> dict:
    """Live/imminent/upcoming high-impact events with countdowns and playbooks."""
    now = now or datetime.now(timezone.utc)
    projected = sorted((_project(e, now) for e in EVENTS), key=lambda p: p["minutes_to"])
    live = [p for p in projected if p["live"]]
    upcoming = [p for p in projected if not p["live"]
                and p["minutes_to"] <= horizon_days * 24 * 60]
    imminent = [p for p in upcoming if 0 < p["minutes_to"] <= 60]
    return {
        "now_utc": now.strftime("%H:%M"),
        "now_cat": now.astimezone(CAT).strftime("%H:%M"),
        "live": live,
        "imminent": imminent,
        "next": upcoming[0] if upcoming else None,
        "upcoming": upcoming,
        "general_playbook": [
            "News trading = trade the reaction, not the prediction.",
            "Reduce size and widen stops; spreads and slippage spike.",
            "Wait for the first candle to close before committing.",
            "Let VoltexAI's news guard pause auto-entries through the window.",
        ],
        "disclaimer": "Representative schedule — confirm exact dates/times on an official economic calendar. Not financial advice.",
    }


def _row(event: dict, occ: datetime, now: datetime) -> dict:
    pre = timedelta(minutes=event["pre_min"])
    post = timedelta(minutes=event["post_min"])
    live = (occ - pre) <= now <= (occ + post)
    return {
        "code": event["code"], "event": event["name"], "currency": event["currency"],
        "impact": event["impact"], "instruments": event["instruments"],
        "date": occ.strftime("%a %d %b"),
        "time_utc": occ.strftime("%H:%M"),
        "time_cat": occ.astimezone(CAT).strftime("%H:%M"),
        "release_iso": occ.isoformat(),
        "minutes_to": round((occ - now).total_seconds() / 60),
        "countdown": _fmt_countdown(occ - now),
        "live": live,
    }


def calendar(days: int = 7, now: datetime | None = None) -> list[dict]:
    """Every occurrence of every tracked event within the next `days` days —
    the single source powering both the News Trading panel and the Economic
    Calendar, so both share the same schedule and live countdowns."""
    now = now or datetime.now(timezone.utc)
    until = now + timedelta(days=days)
    rows: list[dict] = []
    for e in EVENTS:
        occ = _relevant(e, now)[0]                     # current-or-next
        post = timedelta(minutes=e["post_min"])
        guard = 0
        while occ <= until and guard < 60:
            if occ + post >= now:                      # not fully in the past
                rows.append(_row(e, occ, now))
            occ = next_occurrence(e, occ)              # advance to the following one
            guard += 1
    rows.sort(key=lambda r: r["release_iso"])
    return rows


def is_high_impact_live(now: datetime | None = None) -> bool:
    """True if any HIGH-impact event is currently in its news window (for the
    auto-trader news guard)."""
    now = now or datetime.now(timezone.utc)
    return any(_project(e, now)["live"] for e in EVENTS if e["impact"] == "high")
