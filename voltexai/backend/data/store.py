"""
Voltex Store — catalog of purchasable items (plans, education, tools, merch).
Editorial catalog; checkout is handled by Voltex Pay (Stripe / Flutterwave).
"""
from __future__ import annotations

CATEGORIES = ["plans", "education", "tools", "merch"]

PRODUCTS = [
    # --- plans ---
    {"id": "plan-trader", "category": "plans", "name": "Trader Plan",
     "price_usd": 29, "period": "month", "icon": "⚡", "badge": "Popular",
     "desc": "250 AI calls/day, chart vision, signal generation, history.",
     "features": ["250 AI calls/day", "Voltex Vision", "Signal generation", "Email support"]},
    {"id": "plan-elite", "category": "plans", "name": "Elite Plan",
     "price_usd": 99, "period": "month", "icon": "👑", "badge": "Best value",
     "desc": "Everything, maxed — priority AI, live trading, 1:1 desk call.",
     "features": ["2000 AI calls/day", "Priority Claude", "Live trading venues",
                  "Monthly 1:1 (OFA)", "API access"]},
    # --- education ---
    {"id": "edu-smc", "category": "education", "name": "SMC Masterclass Bundle",
     "price_usd": 149, "period": "once", "icon": "🧩", "badge": None,
     "desc": "Advanced Smart-Money Concepts: liquidity, order blocks, FVGs, OTE.",
     "features": ["6 hrs video", "Trade-along replays", "Lifetime access"]},
    {"id": "edu-mindset", "category": "education", "name": "Trader Mindset Program",
     "price_usd": 79, "period": "once", "icon": "🧠", "badge": None,
     "desc": "8-week psychology & discipline program with journaling templates.",
     "features": ["8 weekly modules", "Journal templates", "Community access"]},
    # --- tools ---
    {"id": "tool-ea", "category": "tools", "name": "Voltex Risk Guard EA",
     "price_usd": 59, "period": "once", "icon": "🤖", "badge": "New",
     "desc": "MT4/MT5 expert advisor that enforces your risk & prop-firm limits.",
     "features": ["Auto lot sizing", "Daily-loss lockout", "MT4 & MT5"]},
    {"id": "tool-indicator", "category": "tools", "name": "Voltex Structure Indicator",
     "price_usd": 39, "period": "once", "icon": "📐", "badge": None,
     "desc": "BOS/CHoCH, order blocks and FVGs plotted live on your chart.",
     "features": ["MT4/MT5 & TradingView", "Alerts", "Multi-timeframe"]},
    # --- merch ---
    {"id": "merch-tee", "category": "merch", "name": "VoltexAI Tee",
     "price_usd": 25, "period": "once", "icon": "👕", "badge": None,
     "desc": "Electric-lime logo tee. Trade Smart, Trade Safe, Trade Consistently.",
     "features": ["Premium cotton", "Ships across Africa"]},
    {"id": "merch-cap", "category": "merch", "name": "Voltex Snapback",
     "price_usd": 20, "period": "once", "icon": "🧢", "badge": None,
     "desc": "Embroidered ⚡ snapback for the desk and the streets.",
     "features": ["One size", "Ships across Africa"]},
]

PRODUCTS_BY_ID = {p["id"]: p for p in PRODUCTS}


def list_products(category: str | None = None) -> list[dict]:
    if not category or category == "all":
        return PRODUCTS
    return [p for p in PRODUCTS if p["category"] == category]
