"""
VoltexAI - Payment routes
POST /api/payments/stripe/checkout       - create Stripe Checkout Session
POST /api/payments/flutterwave/checkout  - create Flutterwave payment link
POST /api/payments/stripe/webhook        - Stripe events (subscription lifecycle)
POST /api/payments/flutterwave/webhook   - Flutterwave events
POST /api/payments/cancel                - cancel current subscription
GET  /api/payments/plans                 - public plan catalog
"""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import stripe

from ..database import get_db
from ..config import settings
from ..models import User, Payment, PaymentStatus
from ..services import (stripe_service, flutterwave_service, subscription_service,
                        pricing_service, refund_service)
from ..middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payments", tags=["payments"])


# ---------- schemas ----------
_PLAN_RE = "^(starter|trader|pro|elite)$"
_INTERVAL_RE = "^(month|year)$"


class CheckoutIn(BaseModel):
    plan: str = Field(pattern=_PLAN_RE)
    interval: str = Field(default="month", pattern=_INTERVAL_RE)


class FlutterwaveCheckoutIn(BaseModel):
    plan: str = Field(pattern=_PLAN_RE)
    interval: str = Field(default="month", pattern=_INTERVAL_RE)
    currency: str = "ZMW"
    phone: str | None = None


# ---------- public ----------
_TIERS = [
    ("free", "Free", "Get a feel for the edge.", "RATE_FREE",
     ["10 AI Copilot calls/day", "Live market prices (delayed)",
      "Community access", "Live sessions replay"]),
    ("starter", "Starter", "Everything to learn the markets.", "RATE_STARTER",
     ["60 AI Copilot calls/day", "Real-time market data & sentiment",
      "Economic calendar & resources", "Trade Journal (basic)",
      "Chart-pattern scanner"]),
    ("trader", "Trader", "Trade the plan, not the emotion.", "RATE_TRADER",
     ["300 AI Copilot calls/day", "VIP Pro Signals (Free + VIP channels)",
      "Chart Patterns — full library + MTF confluence", "Chart-vision analysis",
      "Advanced Journal + heatmap & calendar", "Trading calculators", "Email support"]),
    ("pro", "Pro", "Automate and scale.", "RATE_PRO",
     ["800 AI Copilot calls/day", "VoltexAI MT5 Expert Advisor", "Copy trading",
      "Prop-firm challenge access", "Backtest critique", "Priority Claude access"]),
    ("elite", "Elite", "The whole VoltexAI arsenal.", "RATE_ELITE",
     ["2,500 AI Copilot calls/day", "Everything in Pro",
      "1:1 monthly call (Owens Forex Academy)", "Futures prop-firm early access",
      "Public API access", "Dedicated priority support"]),
]


@router.get("/plans")
def list_plans():
    """5-tier product ladder with monthly + annual pricing. Each tier unlocks
    everything below it plus its own products, so the feature list on each card
    is what's NEW at that tier. Annual billing bakes in the months-free discount."""
    b = pricing_service.billing_summary()
    out = []
    for pid, name, tagline, rate_attr, features in _TIERS:
        usd = pricing_service.monthly_usd(pid)
        usd_year = pricing_service.annual_usd(pid)
        out.append({
            "id": pid, "name": name, "tagline": tagline,
            "usd": usd, "zmw": pricing_service.zmw(usd),
            # annual: total for the year, plus the per-month equivalent for display
            "usd_annual": usd_year, "zmw_annual": pricing_service.zmw(usd_year),
            "usd_annual_monthly": round(usd_year / 12, 2) if usd_year else 0,
            "annual_savings_usd": pricing_service.annual_savings_usd(pid),
            "annual_discount_pct": b["discount_pct"] if usd else 0,
            "ai_calls_per_day": getattr(settings, rate_attr),
            "features": features,
        })
    return {"billing": b, "plans": out}


# ---------- create checkout ----------
@router.post("/stripe/checkout")
def stripe_checkout(data: CheckoutIn, user: User = Depends(get_current_user)):
    try:
        result = stripe_service.create_checkout_session(
            user_email=user.email, user_id=user.id, plan=data.plan,
            interval=data.interval,
        )
        return result
    except Exception as e:
        logger.exception("Stripe checkout failed")
        raise HTTPException(502, f"Stripe error: {e}")


@router.post("/flutterwave/checkout")
async def flutterwave_checkout(data: FlutterwaveCheckoutIn,
                               user: User = Depends(get_current_user),
                               db: Session = Depends(get_db)):
    try:
        result = await flutterwave_service.create_payment_link(
            user_id=user.id, email=user.email, full_name=user.full_name,
            plan=data.plan, currency=data.currency,
            phone=data.phone or user.phone, interval=data.interval,
        )
    except Exception as e:
        logger.exception("Flutterwave checkout failed")
        raise HTTPException(502, f"Flutterwave error: {e}")

    # Record pending payment for reconciliation
    db.add(Payment(user_id=user.id, provider="flutterwave",
                   provider_ref=result["tx_ref"], amount=result["amount"],
                   currency=result["currency"], plan=data.plan,
                   status=PaymentStatus.PENDING,
                   method="mobile_money_or_card"))
    db.commit()
    return result


# ---------- webhooks ----------
@router.post("/stripe/webhook")
async def stripe_webhook(request: Request,
                         stripe_signature: str = Header(None, alias="stripe-signature"),
                         db: Session = Depends(get_db)):
    payload = await request.body()
    try:
        event = stripe_service.verify_webhook(payload, stripe_signature)
    except (stripe.error.SignatureVerificationError, ValueError) as e:
        raise HTTPException(400, f"Invalid signature: {e}")

    etype = event["type"]
    obj = event["data"]["object"]
    logger.info("Stripe webhook: %s", etype)

    if etype == "checkout.session.completed":
        user_id = int(obj.get("client_reference_id") or
                      obj.get("metadata", {}).get("user_id", 0))
        plan = obj.get("metadata", {}).get("plan", "trader")
        interval = obj.get("metadata", {}).get("interval", "month")
        sub_id = obj.get("subscription")
        if user_id:
            subscription_service.activate_plan(
                db, user_id=user_id, plan=plan, provider="stripe",
                external_id=sub_id, period_days=pricing_service.period_days(interval),
            )
            db.add(Payment(user_id=user_id, provider="stripe",
                           provider_ref=obj.get("id"),
                           amount=(obj.get("amount_total") or 0) / 100.0,
                           currency=(obj.get("currency") or "usd").upper(),
                           plan=plan, status=PaymentStatus.SUCCESS,
                           method="card",
                           raw_payload=json.dumps(obj)[:3500]))
            db.commit()

    elif etype in ("customer.subscription.deleted",
                   "customer.subscription.paused"):
        user_id = int(obj.get("metadata", {}).get("user_id", 0))
        if user_id:
            subscription_service.downgrade_to_free(db, user_id, reason="cancelled")

    elif etype == "invoice.payment_failed":
        user_id = int(obj.get("metadata", {}).get("user_id", 0))
        if user_id:
            # Mark past_due; downgrade after grace period (job, not shown here)
            sub_helper = subscription_service
            logger.warning("Stripe invoice failed for user %s", user_id)

    return {"received": True}


@router.post("/flutterwave/webhook")
async def flutterwave_webhook(request: Request,
                              verif_hash: str = Header(None, alias="verif-hash"),
                              db: Session = Depends(get_db)):
    raw = await request.body()
    if not flutterwave_service.verify_webhook(raw, verif_hash):
        raise HTTPException(401, "Bad webhook signature")

    event = await request.json()
    logger.info("FLW webhook: %s", event.get("event"))

    if event.get("event") in ("charge.completed", "subscription.cancelled"):
        data_obj = event.get("data", {})
        meta = data_obj.get("meta") or {}
        user_id = int(meta.get("user_id", 0) or 0)
        plan = meta.get("plan", "trader")
        interval = meta.get("interval", "month")
        tx_ref = data_obj.get("tx_ref")
        status_ = data_obj.get("status")

        if not user_id:
            return {"received": True, "warning": "no user_id in meta"}

        if event.get("event") == "charge.completed" and status_ == "successful":
            # Server-side verify before activating
            try:
                verify = await flutterwave_service.verify_transaction(
                    str(data_obj.get("id")))
                if verify.get("data", {}).get("status") == "successful":
                    subscription_service.activate_plan(
                        db, user_id=user_id, plan=plan, provider="flutterwave",
                        external_id=tx_ref,
                        period_days=pricing_service.period_days(interval),
                    )
                    # Update payment record
                    p = (db.query(Payment)
                           .filter(Payment.provider_ref == tx_ref).first())
                    if p:
                        p.status = PaymentStatus.SUCCESS
                        p.method = data_obj.get("payment_type", "unknown")
                        p.raw_payload = json.dumps(data_obj)[:3500]
                        db.commit()
            except Exception as e:
                logger.exception("FLW verify failed: %s", e)
        elif event.get("event") == "subscription.cancelled":
            subscription_service.downgrade_to_free(db, user_id, reason="cancelled")

    return {"received": True}


# ---------- cancel ----------
@router.post("/cancel")
def cancel_subscription(user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    sub = user.subscription
    if not sub or not sub.external_id:
        raise HTTPException(400, "No active paid subscription")
    if sub.provider.value == "stripe":
        try:
            stripe_service.cancel_subscription(sub.external_id)
        except Exception as e:
            raise HTTPException(502, f"Stripe cancel failed: {e}")
    # FLW subscriptions cancel via dashboard or call FLW API directly
    subscription_service.downgrade_to_free(db, user.id, reason="cancelled")
    return {"message": "Subscription cancelled; access continues until period end."}


# ---------- self-serve refund (annual money-back guarantee) ----------
@router.get("/refund/eligibility")
def refund_eligibility(user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """Whether the caller can self-refund under the annual money-back guarantee."""
    return refund_service.eligibility(db, user)


@router.post("/refund")
def request_refund(user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """Issue a full refund of the caller's annual payment within the guarantee
    window, cancel the plan, and drop to Free."""
    try:
        result = refund_service.process(db, user)
    except ValueError as e:
        # Not eligible (window passed, monthly plan, nothing to refund, …)
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.exception("Refund failed for user %s", user.id)
        raise HTTPException(502, f"Refund could not be processed: {e}")
    return {"message": "Refund issued. Your plan has been set to Free.", **result}
