"""
VoltexAI — global reach & currency layer.

Powers localized pricing for a worldwide audience: a table of supported
currencies with indicative USD conversion rates, the payment rail that fits
each region (mobile-money-first in Africa via Flutterwave, cards elsewhere via
Stripe), and a country→currency map for auto-detecting a visitor's local price.

FX rates are INDICATIVE for display only — the actual charge currency and rate
are handled by the payment provider at checkout. Rates are intentionally static
(no external dependency); refresh them periodically.
"""
from __future__ import annotations

# currency -> (symbol, name, indicative units per 1 USD, default rail, region)
CURRENCIES: dict[str, dict] = {
    "USD": {"symbol": "$",   "name": "US Dollar",         "per_usd": 1.0,     "rail": "stripe",      "region": "Global"},
    "EUR": {"symbol": "€",   "name": "Euro",              "per_usd": 0.92,    "rail": "stripe",      "region": "Europe"},
    "GBP": {"symbol": "£",   "name": "British Pound",     "per_usd": 0.79,    "rail": "stripe",      "region": "Europe"},
    "CAD": {"symbol": "C$",  "name": "Canadian Dollar",   "per_usd": 1.37,    "rail": "stripe",      "region": "Americas"},
    "AUD": {"symbol": "A$",  "name": "Australian Dollar", "per_usd": 1.52,    "rail": "stripe",      "region": "Oceania"},
    "AED": {"symbol": "د.إ", "name": "UAE Dirham",        "per_usd": 3.67,    "rail": "stripe",      "region": "Middle East"},
    "INR": {"symbol": "₹",   "name": "Indian Rupee",      "per_usd": 83.3,    "rail": "stripe",      "region": "Asia"},
    "SGD": {"symbol": "S$",  "name": "Singapore Dollar",  "per_usd": 1.35,    "rail": "stripe",      "region": "Asia"},
    "BRL": {"symbol": "R$",  "name": "Brazilian Real",    "per_usd": 5.1,     "rail": "stripe",      "region": "Americas"},
    "MXN": {"symbol": "MX$", "name": "Mexican Peso",      "per_usd": 17.1,    "rail": "stripe",      "region": "Americas"},
    "PHP": {"symbol": "₱",   "name": "Philippine Peso",   "per_usd": 58.0,    "rail": "stripe",      "region": "Asia"},
    "ZAR": {"symbol": "R",   "name": "South African Rand","per_usd": 18.4,    "rail": "flutterwave", "region": "Africa"},
    "NGN": {"symbol": "₦",   "name": "Nigerian Naira",    "per_usd": 1550.0,  "rail": "flutterwave", "region": "Africa"},
    "KES": {"symbol": "KSh", "name": "Kenyan Shilling",   "per_usd": 129.0,   "rail": "flutterwave", "region": "Africa"},
    "GHS": {"symbol": "₵",   "name": "Ghanaian Cedi",     "per_usd": 15.2,    "rail": "flutterwave", "region": "Africa"},
    "UGX": {"symbol": "USh", "name": "Ugandan Shilling",  "per_usd": 3750.0,  "rail": "flutterwave", "region": "Africa"},
    "TZS": {"symbol": "TSh", "name": "Tanzanian Shilling","per_usd": 2600.0,  "rail": "flutterwave", "region": "Africa"},
    "ZMW": {"symbol": "K",   "name": "Zambian Kwacha",    "per_usd": 26.5,    "rail": "flutterwave", "region": "Africa"},
    "RWF": {"symbol": "FRw", "name": "Rwandan Franc",     "per_usd": 1300.0,  "rail": "flutterwave", "region": "Africa"},
    "XOF": {"symbol": "CFA", "name": "West African CFA",  "per_usd": 605.0,   "rail": "flutterwave", "region": "Africa"},
    "EGP": {"symbol": "E£",  "name": "Egyptian Pound",    "per_usd": 48.0,    "rail": "flutterwave", "region": "Africa"},
}

# country -> currency (auto-detect a local price). Unlisted -> USD.
COUNTRY_CURRENCY: dict[str, str] = {
    "Zambia": "ZMW", "Nigeria": "NGN", "Kenya": "KES", "Ghana": "GHS",
    "Uganda": "UGX", "Tanzania": "TZS", "Rwanda": "RWF", "South Africa": "ZAR",
    "Egypt": "EGP", "Ivory Coast": "XOF", "Senegal": "XOF",
    "United States": "USD", "United Kingdom": "GBP", "Canada": "CAD",
    "Australia": "AUD", "India": "INR", "Singapore": "SGD", "Brazil": "BRL",
    "Mexico": "MXN", "Philippines": "PHP", "United Arab Emirates": "AED",
    "Germany": "EUR", "France": "EUR", "Spain": "EUR", "Italy": "EUR",
    "Netherlands": "EUR", "Ireland": "EUR", "Portugal": "EUR",
}

# Marketing reach — kept honest and roughly accurate to capability.
GLOBAL_REACH = {
    "countries": "190+",
    "languages": 8,
    "currencies": len(CURRENCIES),
    "rails": ["Visa", "Mastercard", "Amex", "MTN MoMo", "Airtel Money",
              "M-Pesa", "Bank transfer", "Crypto"],
    "regions": ["Africa", "Europe", "Americas", "Asia", "Middle East", "Oceania"],
}


def _round_local(amount: float, currency: str) -> float:
    """Round to a tidy figure: whole units for big-denomination currencies."""
    if amount == 0:
        return 0.0
    return round(amount) if amount >= 100 else round(amount, 2)


def convert(usd: float, currency: str) -> float:
    c = CURRENCIES.get(currency.upper())
    if not c:
        return round(float(usd), 2)
    return _round_local(float(usd) * c["per_usd"], currency)


def currency_for_country(country: str | None) -> str:
    return COUNTRY_CURRENCY.get((country or "").strip(), "USD")


def geo_config(country: str | None = None) -> dict:
    detected = currency_for_country(country)
    return {
        "detected_currency": detected,
        "detected_rail": CURRENCIES[detected]["rail"],
        "currencies": [{"code": k, **v} for k, v in CURRENCIES.items()],
        "reach": GLOBAL_REACH,
        "note": ("Prices shown in local currency are indicative; the exact charge "
                 "currency and rate are set by your payment provider at checkout."),
    }
