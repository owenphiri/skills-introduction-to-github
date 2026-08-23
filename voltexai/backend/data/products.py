"""
VoltexAI Technologies — product ecosystem catalog.
The single source of truth for the Voltex product line, powering the ecosystem
hub, the mega-nav, and marketing surfaces. Each product maps to a route in the app.
"""
from __future__ import annotations

COMPANY = {
    "name": "VoltexAI Technologies",
    "legal": "PrimeAxis ICT Trade & Solutions Ltd",
    "tagline": "The operating system for the African trader.",
    "motto": "Trade Smart · Trade Safe · Trade Consistently",
    "ceo": "OP Owens",
    "hq": "Kasama, Zambia",
    "founded": 2024,
    "copyright": "© 2026 VoltexAI Technologies. All rights reserved.",
}

PRODUCTS = [
    {"id": "markets", "name": "Voltex Markets", "tag": "Live Market Data",
     "icon": "📊", "route": "/markets", "accent": "#4d7cff",
     "blurb": "Real-time prices across forex, metals, indices, crypto & stocks — "
              "streaming quotes, candles and movers."},
    {"id": "signals", "name": "Voltex Signals", "tag": "AI Trading Signals",
     "icon": "⚡", "route": "/signals", "accent": "#c2f53d",
     "blurb": "Claude-grade AI plus a quant engine producing ranked, risk-bracketed "
              "trade ideas with entry, stop and targets."},
    {"id": "vision", "name": "Voltex Vision", "tag": "Chart & Image Analysis",
     "icon": "👁️", "route": "/vision", "accent": "#a06bff",
     "blurb": "Upload any chart screenshot — Vision reads structure, liquidity and "
              "order blocks, then writes the full trade plan."},
    {"id": "scanner", "name": "Voltex Scanner", "tag": "Market Scanner",
     "icon": "🛰️", "route": "/scanner", "accent": "#45e0a0",
     "blurb": "Continuously scans the entire market for high-confluence setups and "
              "surfaces the best opportunities right now."},
    {"id": "academy", "name": "Voltex Academy", "tag": "Trading Education",
     "icon": "🎓", "route": "/academy", "accent": "#ffb547",
     "blurb": "From candlesticks to market structure, psychology & risk — a full "
              "curriculum for forex, indices and crypto futures."},
    {"id": "prop-intel", "name": "Voltex Prop Intel", "tag": "Prop-Firm Intelligence",
     "icon": "🏦", "route": "/prop-firms", "accent": "#4d7cff",
     "blurb": "Compare funded-account firms — models, splits, rules and payouts — "
              "and get matched to the right challenge."},
    {"id": "broker-intel", "name": "Voltex Broker Intel", "tag": "Broker Comparisons",
     "icon": "🏛️", "route": "/brokers", "accent": "#45e0a0",
     "blurb": "Regulated brokers ranked by spreads, leverage and Africa-friendly "
              "funding (M-Pesa, local bank, cards)."},
    {"id": "alpha", "name": "Voltex Alpha", "tag": "Managed Alpha (AUM)",
     "icon": "💼", "route": "/aum", "accent": "#c2f53d",
     "blurb": "Hands-off? Allocate to the VoltexAI managed programme — segregated "
              "accounts with a real-time investor dashboard."},
    {"id": "pay", "name": "Voltex Pay", "tag": "Payment Infrastructure",
     "icon": "💳", "route": "/pay", "accent": "#ff5560",
     "blurb": "Fund your journey your way — Mastercard, PayPal, crypto, and mobile "
              "money (M-Pesa, MTN, Airtel) across Africa."},
    {"id": "competition", "name": "Voltex Competition", "tag": "Trading Contests",
     "icon": "🏆", "route": "/competition", "accent": "#ffb547",
     "blurb": "Weekly & monthly contests on simulated accounts with verified brokers "
              "— climb the leaderboard, win prizes."},
    {"id": "store", "name": "Voltex Store", "tag": "Store",
     "icon": "🛍️", "route": "/store", "accent": "#a06bff",
     "blurb": "Plans, education bundles, EAs, indicators, prop-firm discounts and "
              "VoltexAI merch — all in one place."},
    {"id": "terminal", "name": "Voltex Terminal", "tag": "AI Trading Terminal",
     "icon": "🧠", "route": "/terminal", "accent": "#4d7cff",
     "blurb": "The AI command centre — chat, analysis, signals and the Academy "
              "tutor, all in one conversational terminal."},
]

PRODUCTS_BY_ID = {p["id"]: p for p in PRODUCTS}


def ecosystem() -> dict:
    return {"company": COMPANY, "products": PRODUCTS}
