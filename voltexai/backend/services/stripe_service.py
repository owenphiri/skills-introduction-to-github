"""
VoltexAI - Stripe service
Hosted Checkout Sessions for $29 (Trader) and $99 (Elite) plans.
Used by international users / card payments. Local African mobile money goes through
Flutterwave instead.
"""
from __future__ import annotations
import logging
import stripe

from ..config import settings

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY


PLAN_TO_PRICE_ID = {
    "trader": settings.STRIPE_PRICE_TRADER,
    "elite": settings.STRIPE_PRICE_ELITE,
}


def create_checkout_session(user_email: str, user_id: int, plan: str) -> dict:
    """Create a Stripe Checkout Session for a subscription plan."""
    if plan not in PLAN_TO_PRICE_ID:
        raise ValueError(f"Unknown plan: {plan}")
    price_id = PLAN_TO_PRICE_ID[plan]
    if not price_id:
        raise ValueError(f"STRIPE_PRICE_{plan.upper()} not configured")

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer_email=user_email,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.FRONTEND_URL}/account?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.FRONTEND_URL}/pricing?checkout=cancelled",
        client_reference_id=str(user_id),
        metadata={"user_id": str(user_id), "plan": plan},
        subscription_data={"metadata": {"user_id": str(user_id), "plan": plan}},
    )
    return {"checkout_url": session.url, "session_id": session.id}


def verify_webhook(payload: bytes, signature: str) -> stripe.Event:
    """Raises stripe.error.SignatureVerificationError if invalid."""
    return stripe.Webhook.construct_event(
        payload=payload,
        sig_header=signature,
        secret=settings.STRIPE_WEBHOOK_SECRET,
    )


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
