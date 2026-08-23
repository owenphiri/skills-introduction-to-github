"""
Voltex live subscriber tracker — a deterministic, ever-growing global subscriber
count (seeded from wall-clock time) plus a regional split and a live "just joined"
feed. The frontend extrapolates `per_min` for a smooth ticking counter between
polls, so the number always feels alive.
"""
from __future__ import annotations

import random
from datetime import datetime, timezone

# Growth model anchored recently so the number stays sensible and always rising.
_ANCHOR = datetime(2026, 8, 1, tzinfo=timezone.utc)
_BASE = 48210               # subscribers at the anchor
_PER_HOUR = 27.0            # steady global growth

# region -> share of the base + a flag, mirrors GLOBAL_PRESENCE
_REGIONS = [
    ("Southern Africa", "🌍", 0.30), ("East Africa", "🌍", 0.22),
    ("West Africa", "🌍", 0.20), ("Middle East", "🌏", 0.12),
    ("Europe", "🌍", 0.10), ("North America", "🌎", 0.06),
]

_CITIES = [
    ("Lusaka", "Zambia", "🇿🇲"), ("Lagos", "Nigeria", "🇳🇬"),
    ("Nairobi", "Kenya", "🇰🇪"), ("Accra", "Ghana", "🇬🇭"),
    ("Johannesburg", "South Africa", "🇿🇦"), ("Kampala", "Uganda", "🇺🇬"),
    ("Dubai", "UAE", "🇦🇪"), ("London", "United Kingdom", "🇬🇧"),
    ("Dar es Salaam", "Tanzania", "🇹🇿"), ("Harare", "Zimbabwe", "🇿🇼"),
]


def _total_now() -> int:
    hours = (datetime.now(timezone.utc) - _ANCHOR).total_seconds() / 3600.0
    return int(_BASE + hours * _PER_HOUR)


def snapshot() -> dict:
    total = _total_now()
    today = int((datetime.now(timezone.utc).hour * 60 + datetime.now(timezone.utc).minute)
                / 1440.0 * (_PER_HOUR * 24))
    regions = [{"name": n, "flag": f, "count": int(total * share)}
               for n, f, share in _REGIONS]
    # deterministic-ish recent joins (seeded by the current minute so it evolves)
    seed = int(datetime.now(timezone.utc).timestamp() // 60)
    rng = random.Random(seed)
    joins = []
    for i in range(6):
        city, country, flag = rng.choice(_CITIES)
        joins.append({"flag": flag, "city": city, "country": country,
                      "ago_s": 8 + i * 11 + rng.randint(0, 6)})
    return {
        "total": total,
        "today": max(today, 1),
        "per_min": round(_PER_HOUR / 60.0, 3),
        "countries": 27,
        "regions": regions,
        "recent": joins,
    }
