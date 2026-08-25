"""Voltex affiliate/referral + VIP-expiry automation."""
from datetime import datetime, timedelta

from backend.database import SessionLocal
from backend.models import TelegramSubscriber


def test_referral_account_and_links(client, free_user):
    me = client.get("/api/referrals/me", headers=free_user["headers"]).json()
    assert me["code"].startswith("VX")
    assert me["link"].endswith(f"ref={me['code']}")
    assert me["code"] in me["telegram_link"]
    assert client.get("/api/referrals/me").status_code == 401


def test_web_referral_attribution(client, free_user):
    code = client.get("/api/referrals/me", headers=free_user["headers"]).json()["code"]
    assert client.post("/api/referrals/track", json={"code": code}).json()["tracked"] is True
    # referred signup
    client.post("/api/auth/register", json={"email": "reffed@t.io", "password": "password123",
                                            "full_name": "Reffed", "referral_code": code})
    st = client.get("/api/referrals/me", headers=free_user["headers"]).json()
    assert st["clicks"] == 1 and st["signups"] == 1 and st["conversions"] == 0
    # bad code is a no-op
    assert client.post("/api/referrals/track", json={"code": "NOPE"}).json()["tracked"] is False


def test_telegram_referral_qualifies_and_credits(client, free_user, monkeypatch):
    from backend.config import settings
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "wh")
    code = client.get("/api/referrals/me", headers=free_user["headers"]).json()["code"]
    U = {"id": 4242, "username": "j", "first_name": "J"}
    hook = lambda p: client.post("/api/telegram/webhook/wh", json=p)
    hook({"message": {"chat": {"id": 4242}, "from": U, "text": f"/start {code}"}})
    hook({"message": {"chat": {"id": 4242}, "from": U, "successful_payment": {
        "currency": "XTR", "total_amount": 1299, "invoice_payload": "plan:vip_pro",
        "telegram_payment_charge_id": "c"}}})
    st = client.get("/api/referrals/me", headers=free_user["headers"]).json()
    assert st["conversions"] == 1 and st["earned_stars"] == int(1299 * 0.20)
    lb = client.get("/api/referrals/leaderboard").json()["leaders"]
    assert any(x["code"] == code for x in lb)


def test_vip_expiry_sweep(client, monkeypatch):
    from backend.config import settings
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "wh")
    monkeypatch.setattr(settings, "MT5_GATEWAY_KEY", "gw")
    U = {"id": 9191, "username": "x", "first_name": "X"}
    client.post("/api/telegram/webhook/wh", json={"message": {"chat": {"id": 9191}, "from": U,
                "successful_payment": {"currency": "XTR", "total_amount": 499,
                "invoice_payload": "plan:vip_basic", "telegram_payment_charge_id": "c"}}})
    # force expiry
    db = SessionLocal()
    try:
        row = db.query(TelegramSubscriber).filter_by(telegram_id=9191).first()
        row.vip_until = datetime.utcnow() - timedelta(days=1)
        db.commit()
    finally:
        db.close()
    r = client.post("/api/telegram/expire-sweep", headers={"X-Gateway-Key": "gw"}).json()
    assert r["removed"] == 1
    # idempotent + auth-gated
    assert client.post("/api/telegram/expire-sweep", headers={"X-Gateway-Key": "gw"}).json()["removed"] == 0
    assert client.post("/api/telegram/expire-sweep").status_code == 401
