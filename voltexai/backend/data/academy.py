"""
Voltex Academy — trading curriculum.
Structured tracks → courses → lessons. Content is editorial reference used to power
the Academy UI and to prime the AI tutor (Academy mode). Not investment advice.
"""
from __future__ import annotations

TRACKS = [
    {"id": "foundations", "name": "Foundations", "icon": "🌱",
     "summary": "Start here — how markets work, what you're trading, and the language of price."},
    {"id": "technical", "name": "Technical Analysis", "icon": "📈",
     "summary": "Candlesticks, chart patterns, indicators and how to read raw price."},
    {"id": "smc", "name": "Market Structure & SMC", "icon": "🧩",
     "summary": "ICT / Smart-Money Concepts — structure, liquidity, order blocks, FVGs."},
    {"id": "markets", "name": "Markets & Instruments", "icon": "🌍",
     "summary": "Forex majors & exotics, indices, and crypto futures — how each behaves."},
    {"id": "sessions", "name": "Sessions & Timing", "icon": "🕐",
     "summary": "London, New York and Asia — when to trade and why timing matters."},
    {"id": "risk", "name": "Risk Management", "icon": "🛡️",
     "summary": "Position sizing, R-multiples, drawdown and surviving the long game."},
    {"id": "psychology", "name": "Trading Psychology", "icon": "🧠",
     "summary": "Discipline, emotional control, journaling and the trader's mindset."},
    {"id": "prop", "name": "Prop-Firm Mastery", "icon": "🏦",
     "summary": "Pass evaluations and manage funded accounts within the rules."},
]

# course = {track, title, level, lessons[]}
COURSES = [
    {"id": "how-markets-work", "track": "foundations", "level": "Beginner",
     "title": "How Markets Work", "duration_min": 45,
     "lessons": ["What is a market & who moves price", "Bid, ask & the spread",
                 "Pips, points, lots & leverage", "Long vs short explained",
                 "Reading a broker order ticket"]},
    {"id": "candlesticks", "track": "technical", "level": "Beginner",
     "title": "Candlesticks Decoded", "duration_min": 60,
     "lessons": ["Anatomy of a candle", "Dojis, pins & engulfings",
                 "Single vs multi-candle signals", "Wicks as liquidity & rejection",
                 "Building a candle-based bias"]},
    {"id": "chart-patterns", "track": "technical", "level": "Intermediate",
     "title": "Chart Patterns That Work", "duration_min": 75,
     "lessons": ["Support, resistance & flips", "Trends, channels & wedges",
                 "Head & shoulders, double tops/bottoms", "Flags, pennants & triangles",
                 "Trading breakouts vs fakeouts"]},
    {"id": "indicators", "track": "technical", "level": "Intermediate",
     "title": "Indicators Without the Noise", "duration_min": 50,
     "lessons": ["Moving averages & the EMA stack", "RSI & momentum",
                 "MACD crossovers", "Bollinger Bands & volatility", "ATR for stops & sizing"]},
    {"id": "market-structure", "track": "smc", "level": "Intermediate",
     "title": "Market Structure Mastery", "duration_min": 80,
     "lessons": ["Highs, lows & the trend skeleton", "Break of structure (BOS)",
                 "Change of character (CHoCH)", "Premium vs discount arrays",
                 "Multi-timeframe alignment"]},
    {"id": "smc-liquidity", "track": "smc", "level": "Advanced",
     "title": "Liquidity, Order Blocks & FVGs", "duration_min": 90,
     "lessons": ["Where liquidity pools sit", "Liquidity sweeps & stop hunts",
                 "Order blocks & mitigation", "Fair value gaps (FVG)",
                 "The OTE entry model"]},
    {"id": "forex", "track": "markets", "level": "Beginner",
     "title": "Forex: Majors & Exotics", "duration_min": 55,
     "lessons": ["The 7 majors & why they lead", "Crosses & correlations",
                 "Exotics: opportunity vs cost", "DXY & the dollar's gravity",
                 "Carry, swaps & rollover"]},
    {"id": "indices", "track": "markets", "level": "Intermediate",
     "title": "Indices: US30, NAS100 & Friends", "duration_min": 45,
     "lessons": ["What an index actually is", "Cash vs futures indices",
                 "Volatility & session behaviour", "News that moves indices",
                 "Index-specific risk"]},
    {"id": "crypto-futures", "track": "markets", "level": "Advanced",
     "title": "Crypto Futures & Perps", "duration_min": 65,
     "lessons": ["Spot vs futures vs perpetuals", "Funding rates explained",
                 "Leverage & liquidation math", "24/7 markets & weekend risk",
                 "On-chain & sentiment context"]},
    {"id": "sessions", "track": "sessions", "level": "Beginner",
     "title": "Market Sessions & Killzones", "duration_min": 40,
     "lessons": ["Asia, London & New York", "The London/NY overlap",
                 "Killzones & the daily cycle", "AMD: accumulation-manipulation-distribution",
                 "Best pairs per session"]},
    {"id": "risk", "track": "risk", "level": "Beginner",
     "title": "Risk Management That Keeps You Alive", "duration_min": 60,
     "lessons": ["The 1% rule & why it wins", "Position sizing by stop distance",
                 "R-multiples & expectancy", "Drawdown & recovery math",
                 "Correlation & portfolio risk"]},
    {"id": "psychology", "track": "psychology", "level": "Intermediate",
     "title": "The Trader's Mind", "duration_min": 55,
     "lessons": ["Fear, greed & FOMO", "Discipline & process over outcome",
                 "Journaling & review loops", "Handling losing streaks",
                 "Building an unshakeable routine"]},
    {"id": "prop-mastery", "track": "prop", "level": "Advanced",
     "title": "Passing & Keeping Funded Accounts", "duration_min": 70,
     "lessons": ["Reading the rulebook", "Daily & max drawdown discipline",
                 "Consistency rules & lot caps", "Payout cycles & scaling",
                 "Treating a funded account like a business"]},
]

COURSES_BY_ID = {c["id"]: c for c in COURSES}


def academy_overview() -> dict:
    counts = {}
    total_lessons = 0
    for c in COURSES:
        counts[c["track"]] = counts.get(c["track"], 0) + 1
        total_lessons += len(c["lessons"])
    tracks = [{**t, "course_count": counts.get(t["id"], 0)} for t in TRACKS]
    return {"tracks": tracks, "total_courses": len(COURSES),
            "total_lessons": total_lessons}


def list_courses(track: str | None = None) -> list[dict]:
    if not track or track == "all":
        return COURSES
    return [c for c in COURSES if c["track"] == track]


def get_course(course_id: str) -> dict | None:
    return COURSES_BY_ID.get(course_id)
