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
from ..services import stripe_service, flutterwave_service, subscription_service
from ..middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payments", tags=["payments"])


# ---------- schemas ----------
class CheckoutIn(BaseModel):
    plan: str = Field(pattern="^(trader|elite)$")


class FlutterwaveCheckoutIn(BaseModel):
    plan: str = Field(pattern="^(trader|elite)$")
    currency: str = "ZMW"
    phone: str | None = None


# ---------- public ----------
@router.get("/plans")
def list_plans():
    return [
        {"id": "free", "name": "Free", "usd": 0, "zmw": 0,
         "ai_calls_per_day": settings.RATE_FREE,
         "features": ["10 AI calls/day", "Basic market analysis",
                      "Community access"]},
        {"id": "trader", "name": "Trader", "usd": settings.PLAN_TRADER_USD,
         "zmw": round(settings.PLAN_TRADER_USD * settings.USD_TO_ZMW_RATE, 2),
         "ai_calls_per_day": settings.RATE_TRADER,
         "features": ["250 AI calls/day", "Chart vision analysis",
                      "Signal generation", "Conversation history",
                      "Email support"]},
        {"id": "elite", "name": "Elite", "usd": settings.PLAN_ELITE_USD,
         "zmw": round(settings.PLAN_ELITE_USD * settings.USD_TO_ZMW_RATE, 2),
         "ai_calls_per_day": settings.RATE_ELITE,
         "features": ["2000 AI calls/day", "Priority Claude access",
                      "Custom EA tuning chat", "Backtest critique",
                      "1:1 monthly call (Owens Forex Academy)",
                      "API access (coming soon)"]},
    ]


# ---------- create checkout ----------
@router.post("/stripe/checkout")
def stripe_checkout(data: CheckoutIn, user: User = Depends(get_current_user)):
    try:
        result = stripe_service.create_checkout_session(
            user_email=user.email, user_id=user.id, plan=data.plan,
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
            phone=data.phone or user.phone,
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
        sub_id = obj.get("subscription")
        if user_id:
            subscription_service.activate_plan(
                db, user_id=user_id, plan=plan, provider="stripe",
                external_id=sub_id, period_days=30,
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
                        external_id=tx_ref, period_days=30,
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
