"""
VoltexAI Technologies — product ecosystem catalog.
The single source of truth for the Voltex product line, powering the ecosystem
hub, the mega-nav, and marketing surfaces. Each product maps to a route in the app.
"""
from __future__ import annotations

COMPANY = {
    "name": "VoltexAI Technologies",
    "legal": "Axion Labs Technologies",
    "powered_by": "Powered by Axion Labs Technologies",
    "tagline": "The operating system for the African trader.",
    "motto": "Trade Smart · Trade Safe · Trade Consistently",
    "ceo": "OP OWENS PHIRI",
    "hq": "Kasama, Zambia",
    "founded": 2017,
    "established": "EST. 2017",
    "copyright": "© 2026 VoltexAI Technologies. All rights reserved.",
}

# Official community channels. Handles/URLs are the single source of truth for
# every social surface (footer, dashboard, social rail).
SOCIALS = [
    {"id": "x", "label": "X", "handle": "@OWENPHI52786718",
     "url": "https://x.com/OWENPHI52786718"},
    {"id": "instagram", "label": "Instagram", "handle": "@OWENPHI52786718",
     "url": "https://instagram.com/OWENPHI52786718"},
    {"id": "telegram", "label": "Telegram", "handle": "@OWENPHI52786718",
     "url": "https://t.me/OWENPHI52786718"},
    {"id": "facebook", "label": "Facebook", "handle": "OWENPHI52786718",
     "url": "https://facebook.com/OWENPHI52786718"},
    {"id": "whatsapp", "label": "WhatsApp", "handle": "+260 972 446 895",
     "url": "https://wa.me/260972446895?text=Hi%20VoltexAI%2C%20I%27d%20like%20to%20know%20more%20about%20the%20plans"},
    {"id": "tiktok", "label": "TikTok", "handle": "@OWENPHI52786718",
     "url": "https://www.tiktok.com/@OWENPHI52786718"},
    {"id": "youtube", "label": "VoltexAI TV", "handle": "VoltexAI TV",
     "url": "https://www.youtube.com/@owenphiri316"},
]

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
    {"id": "patterns", "name": "Voltex Chart Patterns", "tag": "Pattern Recognition",
     "icon": "📐", "route": "/patterns", "accent": "#4dd0e1",
     "blurb": "Automatic chart-pattern detection on a live candlestick chart — with "
              "entry, stop, TP1–TP3 and break-even drawn for you to guide the trade."},
    {"id": "scanner", "name": "Voltex Scanner", "tag": "Market Scanner",
     "icon": "🛰️", "route": "/scanner", "accent": "#45e0a0",
     "blurb": "Continuously scans the entire market for high-confluence setups and "
              "surfaces the best opportunities right now."},
    {"id": "arbitrage", "name": "Voltex Arbitrage", "tag": "Spread Scanner",
     "icon": "🔀", "route": "/scanner?mode=arb", "accent": "#4dd0e1",
     "blurb": "Fee-aware cross-venue spread & basis scanner — subtracts real fees "
              "and slippage so only a genuine net edge shows. Paper-first, honest."},
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
    {"id": "real-estate", "name": "VoltexAI Real Estate", "tag": "Property Investment",
     "icon": "🏠", "route": "/real-estate", "accent": "#7cffb0",
     "blurb": "Turn trading gains into brick-and-mortar wealth — fractional property "
              "investment from $50 with rental yield paid to your wallet."},
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
    {"id": "sentiment", "name": "Voltex Sentiment", "tag": "Market Sentiment",
     "icon": "🌡️", "route": "/sentiment", "accent": "#ff5560",
     "blurb": "The market's mood in one glance — a live Fear & Greed gauge and "
              "bullish/bearish bias across every asset class."},
    {"id": "sessions", "name": "Voltex Live", "tag": "Live Trading Sessions",
     "icon": "🔴", "route": "/live", "accent": "#a06bff",
     "blurb": "Session clocks + live trading streams — London opens, NY killzones "
              "and weekly outlooks with the desk."},
    {"id": "resources", "name": "Voltex Resources", "tag": "Trader Toolkit",
     "icon": "📚", "route": "/resources", "accent": "#45e0a0",
     "blurb": "Guides, cheat sheets, calculators and a high-impact economic "
              "calendar — everything you need in one place."},
    {"id": "community", "name": "Voltex Community", "tag": "Global Trader Wall",
     "icon": "💬", "route": "/community", "accent": "#4d7cff",
     "blurb": "Connect with traders across the globe — share setups, wins and "
              "lessons on the worldwide community wall."},
    {"id": "travel", "name": "Voltex Travel", "tag": "Summits & Meetups",
     "icon": "✈️", "route": "/travel", "accent": "#ffb547",
     "blurb": "Meet the community IRL — summits, meetups and retreats from Lusaka "
              "to Dubai. Trade, learn, network, explore."},
]

PRODUCTS_BY_ID = {p["id"]: p for p in PRODUCTS}


def ecosystem() -> dict:
    return {"company": COMPANY, "products": PRODUCTS, "socials": SOCIALS}
