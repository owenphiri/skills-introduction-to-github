"""Self-serve refunds under the annual money-back guarantee."""
from datetime import datetime, timedelta

from backend.database import SessionLocal
from backend.models import Payment, PaymentStatus


def _add_payment(user_id, *, amount, plan="trader", provider="stripe",
                 currency="USD", days_ago=1, status=PaymentStatus.SUCCESS):
    db = SessionLocal()
    try:
        p = Payment(user_id=user_id, provider=provider, provider_ref=f"ref_{user_id}_{amount}",
                    amount=amount, currency=currency, plan=plan, status=status,
                    method="card", raw_payload="{}")
        p.created_at = datetime.utcnow() - timedelta(days=days_ago)
        db.add(p)
        db.commit()
        return p.id
    finally:
        db.close()


def _plan_of(client, headers):
    return client.get("/api/auth/me", headers=headers).json()["plan"]


def test_annual_refund_within_window(client, paid_user):
    # $490 = annual Trader -> inferred as a yearly purchase, 1 day ago
    _add_payment(paid_user["user_id"], amount=490, plan="trader", days_ago=1)

    elig = client.get("/api/payments/refund/eligibility", headers=paid_user["headers"]).json()
    assert elig["eligible"] is True
    assert elig["moneyback_days"] == 30 and elig["days_left"] >= 27

    r = client.post("/api/payments/refund", headers=paid_user["headers"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["refunded"] is True and body["amount"] == 490
    assert body["simulated"] is True   # no Stripe key in tests

    # plan dropped to free and the payment is marked refunded
    assert _plan_of(client, paid_user["headers"]) == "free"
    db = SessionLocal()
    try:
        p = db.query(Payment).filter(Payment.user_id == paid_user["user_id"]).first()
        assert p.status == PaymentStatus.REFUNDED
    finally:
        db.close()

    # second attempt is no longer eligible
    again = client.post("/api/payments/refund", headers=paid_user["headers"])
    assert again.status_code == 400


def test_monthly_is_not_covered(client, paid_user):
    _add_payment(paid_user["user_id"], amount=49, plan="trader", days_ago=1)
    elig = client.get("/api/payments/refund/eligibility", headers=paid_user["headers"]).json()
    assert elig["eligible"] is False and "annual" in elig["reason"].lower()
    assert client.post("/api/payments/refund", headers=paid_user["headers"]).status_code == 400


def test_window_expired(client, paid_user):
    _add_payment(paid_user["user_id"], amount=490, plan="trader", days_ago=31)
    elig = client.get("/api/payments/refund/eligibility", headers=paid_user["headers"]).json()
    assert elig["eligible"] is False and "window" in elig["reason"].lower()


def test_no_payment_no_refund(client, free_user):
    elig = client.get("/api/payments/refund/eligibility", headers=free_user["headers"]).json()
    assert elig["eligible"] is False
    assert client.post("/api/payments/refund", headers=free_user["headers"]).status_code == 400
