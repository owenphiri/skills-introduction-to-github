"""
VoltexAI — pricing helpers (single source of truth for monthly/annual math).

Annual billing gives `PLAN_ANNUAL_MONTHS_FREE` months free: you pay for
(12 - months_free) months and get a full year. Everything (catalog prices,
Stripe/Flutterwave amounts, savings copy) derives from here so there is exactly
one place to change the discount.
"""
from ..config import settings

VALID_INTERVALS = ("month", "year")


def monthly_usd(plan: str) -> float:
    return {
        "free": 0.0,
        "starter": settings.PLAN_STARTER_USD,
        "trader": settings.PLAN_TRADER_USD,
        "pro": settings.PLAN_PRO_USD,
        "elite": settings.PLAN_ELITE_USD,
    }[plan]


def annual_usd(plan: str) -> float:
    """Yearly price = monthly × billed months (12 minus the free months)."""
    months_billed = max(1, 12 - settings.PLAN_ANNUAL_MONTHS_FREE)
    return round(monthly_usd(plan) * months_billed, 2)


def price_usd(plan: str, interval: str = "month") -> float:
    return annual_usd(plan) if interval == "year" else monthly_usd(plan)


def zmw(usd: float) -> float:
    return round(usd * settings.USD_TO_ZMW_RATE, 2)


def period_days(interval: str) -> int:
    return 365 if interval == "year" else 30


def discount_pct() -> int:
    """Headline % off for choosing annual, e.g. 2/12 → 17%."""
    return round(settings.PLAN_ANNUAL_MONTHS_FREE / 12 * 100)


def annual_savings_usd(plan: str) -> float:
    """What a year of annual saves vs 12× monthly."""
    return round(monthly_usd(plan) * 12 - annual_usd(plan), 2)


def billing_summary() -> dict:
    """Catalog-level annual-billing metadata for the pricing UI."""
    return {
        "months_free": settings.PLAN_ANNUAL_MONTHS_FREE,
        "discount_pct": discount_pct(),
        "label": f"{settings.PLAN_ANNUAL_MONTHS_FREE} months free",
    }
