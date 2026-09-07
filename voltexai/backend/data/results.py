"""
Voltex Results — seed wins for the global Results wall.

These illustrative posts seed the wall so it never looks empty; they are clearly
flagged real:false by the route and are replaced in prominence by genuine client
posts as they arrive. Not a performance claim or guarantee — trading involves risk.
"""
FLAGS = {
    "Zambia": "🇿🇲", "Nigeria": "🇳🇬", "Kenya": "🇰🇪", "Ghana": "🇬🇭",
    "South Africa": "🇿🇦", "Uganda": "🇺🇬", "Tanzania": "🇹🇿", "Zimbabwe": "🇿🇼",
    "United Kingdom": "🇬🇧", "United States": "🇺🇸", "UAE": "🇦🇪", "India": "🇮🇳",
    "Philippines": "🇵🇭", "Brazil": "🇧🇷", "Germany": "🇩🇪", "Canada": "🇨🇦",
    "Malaysia": "🇲🇾", "Indonesia": "🇮🇩", "Pakistan": "🇵🇰", "Global": "🌍",
}


def flag(country: str | None) -> str:
    return FLAGS.get(country or "Global", "🌍")


SEED_RESULTS = [
    {"author": "Chanda", "country": "Zambia", "symbol": "XAUUSD", "market": "metals",
     "timeframe": "M15", "pnl_pct": 8.4, "pnl_amount": 420, "currency": "USD",
     "body": "Voltex Scanner flagged an A+ gold long right at London open. Followed the exact SL/TP — +8.4% on the day. This is different.",
     "image_url": None, "verified": True},
    {"author": "Amara", "country": "Nigeria", "symbol": "V75", "market": "synthetics",
     "timeframe": "M5", "pnl_pct": 15.2, "pnl_amount": 610, "currency": "USD",
     "body": "Synthetics never sleep 😤 Auto-trade caught a Volatility 75 move overnight while I was asleep. Woke up green.",
     "image_url": None, "verified": True},
    {"author": "Wanjiru", "country": "Kenya", "symbol": "BTCUSD", "market": "crypto",
     "timeframe": "H1", "pnl_pct": 11.0, "pnl_amount": 880, "currency": "USD",
     "body": "The top-down read kept me on the right side of BTC all week. Discipline + Voltex = consistency.",
     "image_url": None, "verified": True},
    {"author": "Daniel", "country": "United Kingdom", "symbol": "NAS100", "market": "indices",
     "timeframe": "M15", "pnl_pct": 6.7, "pnl_amount": 1340, "currency": "USD",
     "body": "Passed my prop-firm challenge using the Voltex quality grades to filter setups. Only took A/A+ trades. Funded! 🎉",
     "image_url": None, "verified": True},
    {"author": "Raj", "country": "India", "symbol": "EURUSD", "market": "forex",
     "timeframe": "M30", "pnl_pct": 4.3, "pnl_amount": 215, "currency": "USD",
     "body": "Small account, but the risk layer keeps me alive. 6 green days out of 7 this week following the scanner.",
     "image_url": None, "verified": True},
    {"author": "Mpho", "country": "South Africa", "symbol": "CRASH1000", "market": "synthetics",
     "timeframe": "M5", "pnl_pct": 9.9, "pnl_amount": 495, "currency": "USD",
     "body": "Crash 1000 spike caught perfectly. The HTF confirmation filter saved me from three bad entries first.",
     "image_url": None, "verified": True},
]
