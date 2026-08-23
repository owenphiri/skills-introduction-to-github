"""
Voltex Pay — payment-rail catalog. Powers the Voltex Pay marketing page and shows
which methods are wired. Card/USD via Stripe; mobile money & more via Flutterwave.
"""
from __future__ import annotations

METHODS = [
    {"id": "mpesa", "name": "M-Pesa", "icon": "📱", "region": "Kenya · Tanzania",
     "rail": "Flutterwave", "kind": "mobile_money", "live": True},
    {"id": "mtn", "name": "MTN MoMo", "icon": "📲", "region": "Zambia · Uganda · Ghana",
     "rail": "Flutterwave", "kind": "mobile_money", "live": True},
    {"id": "airtel", "name": "Airtel Money", "icon": "📶", "region": "Zambia · Kenya · Uganda",
     "rail": "Flutterwave", "kind": "mobile_money", "live": True},
    {"id": "mastercard", "name": "Mastercard", "icon": "💳", "region": "Global",
     "rail": "Stripe", "kind": "card", "live": True},
    {"id": "visa", "name": "Visa", "icon": "💳", "region": "Global",
     "rail": "Stripe", "kind": "card", "live": True},
    {"id": "paypal", "name": "PayPal", "icon": "🅿️", "region": "Global",
     "rail": "PayPal", "kind": "wallet", "live": False},
    {"id": "crypto", "name": "Crypto (USDT/BTC)", "icon": "₿", "region": "Global",
     "rail": "On-chain", "kind": "crypto", "live": False},
    {"id": "bank", "name": "Local Bank Transfer", "icon": "🏦", "region": "Africa",
     "rail": "Flutterwave", "kind": "bank", "live": True},
]


def pay_overview() -> dict:
    live = [m for m in METHODS if m["live"]]
    return {
        "methods": METHODS,
        "live_count": len(live),
        "currencies": ["USD", "ZMW", "NGN", "KES", "UGX", "GHS"],
        "note": "Card & USD via Stripe; mobile money, bank & more via Flutterwave. "
                "PayPal and crypto are on the roadmap.",
    }
