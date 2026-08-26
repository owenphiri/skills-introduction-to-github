"""
VoltexAI - Stripe service
Hosted Checkout Sessions for the Starter/Trader/Pro/Elite plans.
Used by international users / card payments. Local African mobile money goes through
Flutterwave instead.
"""
from __future__ import annotations
import json
import logging
import stripe

from ..config import settings

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY


# plan -> {interval -> Stripe recurring price id}
PLAN_TO_PRICE_ID = {
    "starter": {"month": settings.STRIPE_PRICE_STARTER,
                "year": settings.STRIPE_PRICE_STARTER_ANNUAL},
    "trader": {"month": settings.STRIPE_PRICE_TRADER,
               "year": settings.STRIPE_PRICE_TRADER_ANNUAL},
    "pro": {"month": settings.STRIPE_PRICE_PRO,
            "year": settings.STRIPE_PRICE_PRO_ANNUAL},
    "elite": {"month": settings.STRIPE_PRICE_ELITE,
              "year": settings.STRIPE_PRICE_ELITE_ANNUAL},
}


def create_checkout_session(user_email: str, user_id: int, plan: str,
                            interval: str = "month") -> dict:
    """Create a Stripe Checkout Session for a subscription plan (monthly or annual)."""
    if plan not in PLAN_TO_PRICE_ID:
        raise ValueError(f"Unknown plan: {plan}")
    if interval not in ("month", "year"):
        raise ValueError(f"Unknown interval: {interval}")
    price_id = PLAN_TO_PRICE_ID[plan][interval]
    if not price_id:
        suffix = "_ANNUAL" if interval == "year" else ""
        raise ValueError(f"STRIPE_PRICE_{plan.upper()}{suffix} not configured")

    meta = {"user_id": str(user_id), "plan": plan, "interval": interval}
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer_email=user_email,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.FRONTEND_URL}/account?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.FRONTEND_URL}/pricing?checkout=cancelled",
        client_reference_id=str(user_id),
        metadata=meta,
        subscription_data={"metadata": meta},
    )
    return {"checkout_url": session.url, "session_id": session.id}


def verify_webhook(payload: bytes, signature: str) -> stripe.Event:
    """Raises stripe.error.SignatureVerificationError if invalid."""
    return stripe.Webhook.construct_event(
        payload=payload,
        sig_header=signature,
        secret=settings.STRIPE_WEBHOOK_SECRET,
    )


def refund_payment(payment) -> dict:
    """Refund a Stripe charge in full using the payment_intent recorded on the
    Checkout Session. No-op (simulated) when STRIPE_SECRET_KEY is unset."""
    if not settings.STRIPE_SECRET_KEY:
        return {"simulated": True, "provider": "stripe"}
    try:
        obj = json.loads(payment.raw_payload or "{}")
    except (ValueError, TypeError):
        obj = {}
    payment_intent = obj.get("payment_intent")
    if not payment_intent:
        raise ValueError("No payment_intent on record; refund via the Stripe dashboard.")
    refund = stripe.Refund.create(payment_intent=payment_intent)
    return {"provider": "stripe", "id": refund.id, "status": refund.status}


def cancel_subscription(stripe_sub_id: str) -> dict:
    sub = stripe.Subscription.delete(stripe_sub_id)
    return {"id": sub.id, "status": sub.status}


def fetch_subscription(stripe_sub_id: str) -> dict:
    sub = stripe.Subscription.retrieve(stripe_sub_id)
    return {
        "id": sub.id,
        "status": sub.status,
        "current_period_end": sub.current_period_end,
        "cancel_at_period_end": sub.cancel_at_period_end,
    }
