"""
VoltexAI — pricing helpers (single source of truth for all billing periods).

Four billing periods, each with its own discount off the monthly rate:

    month       1 month   — 0%  (base rate)
    quarter     3 months  — 5%  off
    semiannual  6 months  — 10% off
    year        12 months — the "months free" discount (PLAN_ANNUAL_MONTHS_FREE),
                            e.g. 2 months free ≈ 17% off

Everything (catalog prices, Stripe/Flutterwave amounts, savings copy, the period
the subscription is granted for) derives from here, so there is exactly one place
to change a price or a discount.
"""
from ..config import settings

# interval -> months in the billing cycle
PERIOD_MONTHS = {"month": 1, "quarter": 3, "semiannual": 6, "year": 12}
# interval -> human label
PERIOD_LABEL = {"month": "Monthly", "quarter": "3 months",
                "semiannual": "6 months", "year": "Annual"}
# interval -> % off the monthly rate (year is derived from months-free below)
_PERIOD_DISCOUNT = {"month": 0, "quarter": 5, "semiannual": 10}
VALID_INTERVALS = ("month", "quarter", "semiannual", "year")


def monthly_usd(plan: str) -> float:
    return {
        "free": 0.0,
        "starter": settings.PLAN_STARTER_USD,
        "trader": settings.PLAN_TRADER_USD,
        "pro": settings.PLAN_PRO_USD,
        "elite": settings.PLAN_ELITE_USD,
    }[plan]


def period_months(interval: str) -> int:
    return PERIOD_MONTHS.get(interval, 1)


def period_discount_pct(interval: str) -> int:
    """Headline % off for choosing this period vs paying monthly."""
    if interval == "year":
        return round(settings.PLAN_ANNUAL_MONTHS_FREE / 12 * 100)
    return _PERIOD_DISCOUNT.get(interval, 0)


def period_price_usd(plan: str, interval: str = "month") -> float:
    """Total charged for one full billing cycle of `interval`."""
    m = monthly_usd(plan)
    if interval == "year":
        months_billed = max(1, 12 - settings.PLAN_ANNUAL_MONTHS_FREE)
        return round(m * months_billed, 2)
    months = period_months(interval)
    disc = _PERIOD_DISCOUNT.get(interval, 0) / 100.0
    return round(m * months * (1 - disc), 2)


def period_monthly_equiv(plan: str, interval: str) -> float:
    """Effective per-month cost on this period (for '$X/mo billed every N months')."""
    months = period_months(interval)
    total = period_price_usd(plan, interval)
    return round(total / months, 2) if months else 0.0


def period_savings_usd(plan: str, interval: str) -> float:
    """What this period saves vs paying the monthly rate for the same months."""
    return round(monthly_usd(plan) * period_months(interval)
                 - period_price_usd(plan, interval), 2)


def period_days(interval: str) -> int:
    return {"month": 30, "quarter": 91, "semiannual": 182, "year": 365}.get(interval, 30)


def price_usd(plan: str, interval: str = "month") -> float:
    return period_price_usd(plan, interval)


def zmw(usd: float) -> float:
    return round(usd * settings.USD_TO_ZMW_RATE, 2)


def periods_catalog(plan: str | None = None) -> list[dict]:
    """The period options for the pricing UI. With a plan, each option also
    carries that plan's total, per-month equivalent and savings."""
    out = []
    for interval in VALID_INTERVALS:
        opt = {
            "interval": interval,
            "months": period_months(interval),
            "label": PERIOD_LABEL[interval],
            "discount_pct": period_discount_pct(interval),
        }
        if plan is not None:
            total = period_price_usd(plan, interval)
            opt.update({
                "usd_total": total, "zmw_total": zmw(total),
                "usd_monthly_equiv": period_monthly_equiv(plan, interval),
                "savings_usd": period_savings_usd(plan, interval),
            })
        out.append(opt)
    return out


# ----------------------------- back-compat (annual helpers) -----------------------------
def annual_usd(plan: str) -> float:
    return period_price_usd(plan, "year")


def discount_pct() -> int:
    """Headline % off for choosing annual (kept for existing callers)."""
    return period_discount_pct("year")


def annual_savings_usd(plan: str) -> float:
    return period_savings_usd(plan, "year")


def billing_summary() -> dict:
    """Catalog-level billing metadata for the pricing UI."""
    return {
        "months_free": settings.PLAN_ANNUAL_MONTHS_FREE,
        "discount_pct": discount_pct(),
        "label": f"{settings.PLAN_ANNUAL_MONTHS_FREE} months free",
        "periods": periods_catalog(),
    }
