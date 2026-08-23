"""
Voltex Resources — the trader's toolkit: guides, cheat sheets, tools and a
representative high-impact economic calendar (relative to today).
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

CATEGORIES = ["guides", "cheatsheets", "tools", "calculators"]

RESOURCES = [
    {"id": "smc-guide", "category": "guides", "title": "The SMC Playbook (PDF)",
     "icon": "📘", "desc": "Order blocks, FVGs, liquidity & the OTE entry model.", "kind": "pdf"},
    {"id": "risk-guide", "category": "guides", "title": "Risk Management Handbook",
     "icon": "🛡️", "desc": "Position sizing, R-multiples, drawdown survival.", "kind": "pdf"},
    {"id": "session-cheat", "category": "cheatsheets", "title": "Session Killzones Cheat Sheet",
     "icon": "🕐", "desc": "Best pairs & times for London/NY/Asia.", "kind": "image"},
    {"id": "candle-cheat", "category": "cheatsheets", "title": "Candlestick Patterns Cheat Sheet",
     "icon": "🕯️", "desc": "Every reversal & continuation candle at a glance.", "kind": "image"},
    {"id": "pip-calc", "category": "calculators", "title": "Position Size Calculator",
     "icon": "🧮", "desc": "Lot size from account risk & stop distance.", "kind": "tool"},
    {"id": "rr-calc", "category": "calculators", "title": "Risk/Reward Calculator",
     "icon": "⚖️", "desc": "Entry, stop, targets → R-multiple.", "kind": "tool"},
    {"id": "econ-cal", "category": "tools", "title": "Economic Calendar",
     "icon": "📅", "desc": "High-impact news that moves markets.", "kind": "tool"},
    {"id": "tv-charts", "category": "tools", "title": "TradingView Charts",
     "icon": "📈", "desc": "Pro charting to pair with Voltex signals.", "kind": "link",
     "url": "https://www.tradingview.com"},
]

# representative recurring high-impact events (weekday, UTC time, name, currency, impact)
_RECURRING = [
    (4, "12:30", "Non-Farm Payrolls", "USD", "high"),
    (2, "12:30", "CPI (Inflation)", "USD", "high"),
    (2, "18:00", "FOMC Rate Decision", "USD", "high"),
    (3, "12:15", "ECB Rate Decision", "EUR", "high"),
    (3, "11:00", "BoE Rate Decision", "GBP", "high"),
    (1, "08:30", "UK GDP", "GBP", "medium"),
    (0, "01:30", "China PMI", "CNY", "medium"),
]


def list_resources(category: str | None = None) -> list[dict]:
    if not category or category == "all":
        return RESOURCES
    return [r for r in RESOURCES if r["category"] == category]


def economic_calendar(days: int = 7) -> list[dict]:
    """Representative upcoming high-impact events for the next `days` days."""
    now = datetime.now(timezone.utc)
    out = []
    for offset in range(days):
        day = now + timedelta(days=offset)
        for wd, t, name, ccy, impact in _RECURRING:
            if day.weekday() == wd:
                out.append({"date": day.strftime("%a %d %b"), "time_utc": t,
                            "event": name, "currency": ccy, "impact": impact})
    return out
