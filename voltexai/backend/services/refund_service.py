"""
VoltexAI — self-serve refunds under the annual money-back guarantee.

Eligibility (all must hold):
  * the user has a SUCCESS payment that hasn't already been refunded,
  * that payment was ANNUAL (the guarantee is annual-only),
  * it was made within PLAN_ANNUAL_MONEYBACK_DAYS,
  * the guarantee is enabled (days > 0).

The actual money movement is delegated to the provider service (Stripe or
Flutterwave). Like the rest of the platform, provider calls are gated on the
provider key: with no key configured the refund is recorded as processed
(simulated) so the flow is exercisable offline and in tests; with a key it hits
the real refund API.
"""
from __future__ import annotations
import json
import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from ..config import settings
from ..models import Payment, PaymentStatus, User
from . import pricing_service, stripe_service, flutterwave_service, subscription_service

logger = logging.getLogger(__name__)

_PROVIDERS = {"stripe", "flutterwave"}


def _interval_of(payment: Payment) -> str:
    """Best-effort month|year for a past payment: prefer the interval stamped in
    the stored webhook metadata, else infer from the amount (annual ≈ 10× monthly)."""
    try:
        obj = json.loads(payment.raw_payload or "{}")
        meta = obj.get("metadata") or obj.get("meta") or {}
        iv = meta.get("interval")
        if iv in ("month", "year"):
            return iv
    except (ValueError, TypeError):
        pass

    cur = (payment.currency or "USD").upper()
    monthly = pricing_service.monthly_usd(payment.plan)
    annual = pricing_service.annual_usd(payment.plan)
    if cur == "ZMW":
        monthly, annual = pricing_service.zmw(monthly), pricing_service.zmw(annual)
    elif cur != "USD":
        # unknown FX (NGN/KES/…): split at the midpoint of the USD figures
        return "year" if payment.amount >= (monthly + annual) / 2 else "month"
    return "year" if abs(payment.amount - annual) <= abs(payment.amount - monthly) else "month"


def _latest_paid(db: Session, user: User) -> Payment | None:
    return (db.query(Payment)
              .filter(Payment.user_id == user.id,
                      Payment.status == PaymentStatus.SUCCESS,
                      Payment.provider.in_(_PROVIDERS))
              .order_by(Payment.created_at.desc())
              .first())


def eligibility(db: Session, user: User) -> dict:
    """Describe whether the user can self-refund right now (no side effects)."""
    days = settings.PLAN_ANNUAL_MONEYBACK_DAYS
    base = {"eligible": False, "moneyback_days": days}
    if days <= 0:
        return {**base, "reason": "The money-back guarantee is not currently offered."}

    pay = _latest_paid(db, user)
    if not pay:
        return {**base, "reason": "No refundable payment on file."}
    if _interval_of(pay) != "year":
        return {**base, "reason": "The money-back guarantee covers annual plans only."}

    deadline = pay.created_at + timedelta(days=days)
    if datetime.utcnow() > deadline:
        return {**base, "reason": f"The {days}-day guarantee window has passed."}

    days_left = max(0, (deadline - datetime.utcnow()).days)
    return {"eligible": True, "moneyback_days": days, "reason": None,
            "payment_id": pay.id, "provider": pay.provider,
            "amount": pay.amount, "currency": pay.currency,
            "plan": pay.plan, "days_left": days_left,
            "purchased_at": pay.created_at.isoformat()}


def _refund_with_provider(payment: Payment) -> dict:
    if payment.provider == "stripe":
        return stripe_service.refund_payment(payment)
    if payment.provider == "flutterwave":
        return flutterwave_service.refund_transaction(payment)
    raise ValueError(f"Unrefundable provider: {payment.provider}")


def process(db: Session, user: User) -> dict:
    """Run the refund if eligible. Returns a result dict; raises ValueError with a
    human message when the request is not eligible."""
    elig = eligibility(db, user)
    if not elig["eligible"]:
        raise ValueError(elig["reason"])

    payment = db.query(Payment).filter(Payment.id == elig["payment_id"]).first()

    provider_result = _refund_with_provider(payment)

    payment.status = PaymentStatus.REFUNDED
    db.commit()

    # Stop any future billing, then drop the plan to free.
    sub = user.subscription
    if sub and sub.provider and sub.provider.value == "stripe" and sub.external_id:
        try:
            stripe_service.cancel_subscription(sub.external_id)
        except Exception as e:  # best-effort; refund already issued
            logger.warning("Post-refund Stripe cancel failed for user %s: %s", user.id, e)
    subscription_service.downgrade_to_free(db, user.id, reason="refunded")

    return {"refunded": True, "amount": payment.amount, "currency": payment.currency,
            "provider": payment.provider, "plan": payment.plan,
            "simulated": bool(provider_result.get("simulated")),
            "provider_result": provider_result}
