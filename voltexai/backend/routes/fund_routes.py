"""
VoltexAI - AUM / managed-program + investor pitch routes
GET /api/fund/summary       - AUM overview, stats, tiers, allocation, disclaimer
GET /api/fund/performance   - monthly returns + cumulative equity curve
GET /api/fund/pitch         - investor pitch-deck slides
POST /api/fund/enquire      - capture an investor enquiry (lead)

These are public marketing/investor surfaces. The enquiry endpoint just logs the
lead; wire it to email/CRM in production.
"""
import logging

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr, Field

from ..data.fund import fund_summary, MONTHLY_RETURNS, PITCH_DECK, DISCLAIMER

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/fund", tags=["fund"])


class EnquiryIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    amount_usd: float = Field(ge=0)
    tier: str = "starter"
    country: str | None = None
    message: str | None = Field(default=None, max_length=2000)


@router.get("/summary")
def summary():
    return fund_summary()


@router.get("/performance")
def performance():
    equity = []
    nav = 100.0
    for m in MONTHLY_RETURNS:
        nav *= (1 + m["return_pct"] / 100)
        equity.append({"month": m["month"], "nav": round(nav, 2),
                       "return_pct": m["return_pct"]})
    return {"start_nav": 100.0, "equity_curve": equity,
            "disclaimer": DISCLAIMER}


@router.get("/pitch")
def pitch():
    return {"slides": PITCH_DECK, "disclaimer": DISCLAIMER}


@router.post("/enquire")
def enquire(data: EnquiryIn):
    # In production: persist + notify desk / push to CRM.
    logger.info("Investor enquiry: %s <%s> tier=%s amount=%s country=%s",
                data.name, data.email, data.tier, data.amount_usd, data.country)
    return {"received": True,
            "message": "Thanks — our desk will reach out within 1 business day."}
