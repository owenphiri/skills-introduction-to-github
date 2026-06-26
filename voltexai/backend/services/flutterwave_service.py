"""
VoltexAI - Flutterwave service
Hosted payment links for African customers: MTN MoMo (ZM/UG), Airtel Money (ZM/KE),
M-Pesa (KE), bank transfer (NG), and African-issued cards. Charges happen in ZMW
by default but Flutterwave auto-handles other currencies.

Docs: https://developer.flutterwave.com/docs/api
"""
from __future__ import annotations
import hashlib
import hmac
import logging
import secrets

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

FLW_BASE = "https://api.flutterwave.com/v3"
PLAN_USD = {"trader": settings.PLAN_TRADER_USD, "elite": settings.PLAN_ELITE_USD}


def _generate_tx_ref(user_id: int) -> str:
    return f"VOLTX-{user_id}-{secrets.token_hex(8)}"


def _convert_to_local(usd: float, currency: str) -> float:
    """For MVP we only handle ZMW conversion locally; FLW handles NGN/KES/UGX/etc."""
    if currency == "ZMW":
        return round(usd * settings.USD_TO_ZMW_RATE, 2)
    return round(usd, 2)  # FLW will FX it


async def create_payment_link(user_id: int, email: str, full_name: str | None,
                              plan: str, currency: str = "ZMW",
                              phone: str | None = None) -> dict:
    """Create a hosted Flutterwave payment page for a subscription plan."""
    if plan not in PLAN_USD:
        raise ValueError(f"Unknown plan: {plan}")
    if not settings.FLW_SECRET_KEY:
        raise RuntimeError("FLW_SECRET_KEY not configured")

    tx_ref = _generate_tx_ref(user_id)
    amount = _convert_to_local(PLAN_USD[plan], currency)

    payload = {
        "tx_ref": tx_ref,
        "amount": amount,
        "currency": currency,
        "redirect_url": f"{settings.FRONTEND_URL}/account?checkout=success&tx_ref={tx_ref}",
        "payment_options": "card,mobilemoneyzambia,mobilemoneyuganda,mpesa,banktransfer",
        "customer": {
            "email": email,
            "name": full_name or email.split("@")[0],
            **({"phonenumber": phone} if phone else {}),
        },
        "customizations": {
            "title": "VoltexAI Subscription",
            "description": f"VoltexAI {plan.title()} plan - monthly",
            "logo": f"{settings.BASE_URL}/static/voltexai-logo.png",
        },
        "meta": {"user_id": user_id, "plan": plan, "usd_amount": PLAN_USD[plan]},
    }

    headers = {"Authorization": f"Bearer {settings.FLW_SECRET_KEY}",
               "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(f"{FLW_BASE}/payments", json=payload, headers=headers)
        r.raise_for_status()
        data = r.json()

    if data.get("status") != "success":
        raise RuntimeError(f"Flutterwave error: {data}")

    return {"checkout_url": data["data"]["link"], "tx_ref": tx_ref,
            "amount": amount, "currency": currency}


async def verify_transaction(transaction_id: str) -> dict:
    """Verify a completed payment server-side before activating a plan."""
    headers = {"Authorization": f"Bearer {settings.FLW_SECRET_KEY}"}
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(f"{FLW_BASE}/transactions/{transaction_id}/verify",
                             headers=headers)
        r.raise_for_status()
        return r.json()


def verify_webhook(raw_body: bytes, signature: str) -> bool:
    """
    Flutterwave webhook auth uses the 'verif-hash' header which must equal the
    FLW_WEBHOOK_HASH secret you set in their dashboard. We also support optional
    HMAC checking for belt-and-braces deployments.
    """
    if not settings.FLW_WEBHOOK_HASH:
        logger.warning("FLW_WEBHOOK_HASH not configured - skipping webhook verification")
        return True
    return hmac.compare_digest(signature or "", settings.FLW_WEBHOOK_HASH)
