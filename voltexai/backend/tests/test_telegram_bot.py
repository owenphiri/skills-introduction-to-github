"""Voltex Telegram bot: webhook, commands, Stars payment -> VIP grant."""
from datetime import datetime

from backend.database import SessionLocal
from backend.models import TelegramSubscriber
from backend.services.telegram_bot import is_vip, PLANS

_U = {"id": 90210, "username": "amara", "first_name": "Amara"}


def _hook(client, payload):
    return client.post("/api/telegram/webhook/whsec", json=payload)


def test_webhook_secret_guard(client, monkeypatch):
    from backend.config import settings
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "whsec")
    assert client.post("/api/telegram/webhook/wrong", json={}).status_code == 404
    # unset secret -> endpoint stays closed
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "")
    assert client.post("/api/telegram/webhook/whsec", json={}).status_code == 404


def test_commands_dispatch(client, monkeypatch):
    from backend.config import settings
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "whsec")
    for text, cmd in (("/start", "start"), ("/vip", "vip"), ("/signals", "signals"),
                      ("/performance", "performance"), ("/status", "status"), ("/rules", "rules")):
        r = _hook(client, {"message": {"chat": {"id": 90210}, "from": _U, "text": text}}).json()
        assert r["ok"] and r["handled"] == "command" and r["cmd"] == cmd


def test_stars_payment_grants_vip(client, monkeypatch):
    from backend.config import settings
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "whsec")
    # buy button -> invoice
    assert _hook(client, {"callback_query": {"id": "c1", "from": _U, "data": "buy:vip_pro"}}).json()["handled"] == "callback"
    # pre-checkout answered
    assert _hook(client, {"pre_checkout_query": {"id": "p1", "from": _U, "currency": "XTR",
                          "total_amount": PLANS["vip_pro"]["stars"], "invoice_payload": "plan:vip_pro"}}).json()["handled"] == "pre_checkout"
    # successful payment grants VIP
    assert _hook(client, {"message": {"chat": {"id": 90210}, "from": _U, "successful_payment": {
        "currency": "XTR", "total_amount": PLANS["vip_pro"]["stars"],
        "invoice_payload": "plan:vip_pro", "telegram_payment_charge_id": "ch_x"}}}).json()["handled"] == "payment"

    db = SessionLocal()
    try:
        row = db.query(TelegramSubscriber).filter_by(telegram_id=90210).first()
        assert row is not None and is_vip(row)
        assert row.plan == "vip_pro" and row.stars_paid == PLANS["vip_pro"]["stars"]
        assert row.vip_until > datetime.utcnow()
    finally:
        db.close()


def test_vip_status_lookup_needs_gateway_key(client, monkeypatch):
    from backend.config import settings
    monkeypatch.setattr(settings, "MT5_GATEWAY_KEY", "gwkey")
    assert client.get("/api/telegram/vip/90210").status_code == 401
    r = client.get("/api/telegram/vip/90210", headers={"X-Gateway-Key": "gwkey"})
    assert r.status_code == 200 and "vip" in r.json()
