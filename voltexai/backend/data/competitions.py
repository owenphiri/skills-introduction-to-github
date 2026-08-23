"""
Voltex Competition — trading contests on simulated accounts with verified brokers.
Contest definitions are editorial; entries + leaderboard live in the DB and are
scored off each entrant's paper-trading account (realized P&L since they joined).
"""
from __future__ import annotations

CONTESTS = [
    {"id": "weekly-sprint", "name": "Weekly Sprint", "cadence": "weekly",
     "prize_usd": 500, "entry": "Free", "starting_balance": 100000,
     "broker": "Verified paper broker", "rules": "Max 5% daily drawdown · no gambling",
     "status": "open",
     "desc": "A fast 5-day dash — highest return by Friday close takes the pot."},
    {"id": "monthly-masters", "name": "Monthly Masters", "cadence": "monthly",
     "prize_usd": 2500, "entry": "Trader+ plan", "starting_balance": 200000,
     "broker": "Verified paper broker", "rules": "Max 10% drawdown · min 10 trading days",
     "status": "open",
     "desc": "The marquee event — consistency over a full month wins the crown."},
    {"id": "crypto-cup", "name": "Crypto Futures Cup", "cadence": "weekly",
     "prize_usd": 750, "entry": "Free", "starting_balance": 50000,
     "broker": "Verified paper broker", "rules": "Crypto only · max 8% drawdown",
     "status": "open",
     "desc": "Perps and futures degens welcome — biggest crypto run wins."},
]

CONTESTS_BY_ID = {c["id"]: c for c in CONTESTS}


def get_contest(contest_id: str) -> dict | None:
    return CONTESTS_BY_ID.get(contest_id)
