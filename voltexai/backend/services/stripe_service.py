"""
VoltexAI - Stripe service
Hosted Checkout Sessions for the Starter/Trader/Pro/Elite plans.
Used by international users / card payments. Local African mobile money goes through
Flutterwave instead.
"""
from __future__ import annotations
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
                            interval: str = "month",
                            discount_usd: float = 0.0, vxc_redeem: int = 0) -> dict:
    """Create a Stripe Checkout Session for a subscription plan (monthly or annual).
    A Voltex Coin credit is applied to the FIRST invoice via a one-time coupon
    (`amount_off`, duration='once'); `vxc_redeem` coins are burned on webhook
    success (stamped into metadata)."""
    if plan not in PLAN_TO_PRICE_ID:
        raise ValueError(f"Unknown plan: {plan}")
    if interval not in ("month", "year"):
        raise ValueError(f"Unknown interval: {interval}")
    price_id = PLAN_TO_PRICE_ID[plan][interval]
    if not price_id:
        suffix = "_ANNUAL" if interval == "year" else ""
        raise ValueError(f"STRIPE_PRICE_{plan.upper()}{suffix} not configured")

    meta = {"user_id": str(user_id), "plan": plan, "interval": interval,
            "vxc_redeem": str(int(vxc_redeem))}
    kwargs = dict(
        mode="subscription",
        customer_email=user_email,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.FRONTEND_URL}/account?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.FRONTEND_URL}/pricing?checkout=cancelled",
        client_reference_id=str(user_id),
        metadata=meta,
        subscription_data={"metadata": meta},
    )
    if discount_usd and float(discount_usd) > 0:
        coupon = stripe.Coupon.create(
            amount_off=int(round(float(discount_usd) * 100)), currency="usd",
            duration="once", name="Voltex Coin credit")
        kwargs["discounts"] = [{"coupon": coupon.id}]
    session = stripe.checkout.Session.create(**kwargs)
    return {"checkout_url": session.url, "session_id": session.id}


def create_product_checkout(user_email: str, user_id: int, product: dict,
                            discount_usd: float = 0.0, vxc_redeem: int = 0) -> dict:
    """One-time Stripe Checkout for a Store product (course, EA, merch).
    Uses inline price_data so no per-product Stripe price is required.
    `discount_usd` is a Voltex Coin credit applied to the charge; `vxc_redeem`
    is the coin count to burn on webhook success (stamped into metadata)."""
    gross = float(product["price_usd"])
    net = max(0.0, round(gross - max(0.0, float(discount_usd)), 2))
    amount_cents = int(round(net * 100))
    meta = {"user_id": str(user_id), "kind": "store", "product_id": product["id"],
            "vxc_redeem": str(int(vxc_redeem)), "gross_usd": str(gross)}
    session = stripe.checkout.Session.create(
        mode="payment",
        customer_email=user_email,
        line_items=[{
            "quantity": 1,
            "price_data": {
                "currency": "usd",
                "unit_amount": amount_cents,
                "product_data": {"name": f"VoltexAI · {product['name']}"},
            },
        }],
        success_url=f"{settings.FRONTEND_URL}/account?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.FRONTEND_URL}/store?checkout=cancelled",
        client_reference_id=str(user_id),
        metadata=meta,
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
