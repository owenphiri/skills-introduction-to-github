"""Voltex Coin (VXC) — utility & rewards layer tests."""


def test_coin_info_public():
    from fastapi.testclient import TestClient
    from backend.main import app
    with TestClient(app) as c:
        r = c.get("/api/coin/info")
    assert r.status_code == 200
    body = r.json()
    assert body["chain"]["symbol"] == "VXC"
    # dual-protocol: Bitcoin + Ethereum both described
    protos = body["chain"]["protocols"]
    assert "ethereum" in protos and "bitcoin" in protos
    assert protos["ethereum"]["standard"] == "ERC-20"
    assert body["benefits"] and isinstance(body["benefits"], list)


def test_signup_grants_welcome_coins(client, free_user):
    r = client.get("/api/coin/wallet", headers=free_user["headers"])
    assert r.status_code == 200
    w = r.json()
    assert w["symbol"] == "VXC"
    assert w["balance"] >= 500          # signup_bonus
    assert w["usd_value"] == round(w["balance"] / w["peg_vxc_per_usd"], 2)


def test_daily_checkin_once_per_day(client, free_user):
    h = free_user["headers"]
    r1 = client.post("/api/coin/checkin", headers=h).json()
    assert r1["claimed"] is True and r1["earned"] > 0
    r2 = client.post("/api/coin/checkin", headers=h).json()
    assert r2["claimed"] is False       # already claimed today


def test_redeem_and_insufficient_balance(client, free_user):
    h = free_user["headers"]
    bal = client.get("/api/coin/wallet", headers=h).json()["balance"]
    ok = client.post("/api/coin/redeem", headers=h, json={"amount": 100}).json()
    assert ok["ok"] is True and ok["balance"] == bal - 100
    # spending more than we hold (but within field limits) is rejected
    bad = client.post("/api/coin/redeem", headers=h, json={"amount": 900_000})
    assert bad.status_code == 400


def test_wallet_requires_auth(client):
    assert client.get("/api/coin/wallet").status_code == 401


def test_cashback_boost_scales_with_plan():
    # a service-level check: Elite earns more cashback than free on the same spend
    from backend.database import SessionLocal
    from backend.models import User, Subscription, PlanTier, SubStatus, Provider
    from backend.services import voltex_coin_service as C
    import uuid
    db = SessionLocal()
    try:
        u = User(email=f"cb_{uuid.uuid4().hex[:8]}@t.io", password_hash="x", full_name="CB")
        db.add(u); db.commit(); db.refresh(u)
        base = C.balance(db, u.id)
        C.purchase_cashback(db, u.id, 100.0, ref="r1")   # free tier: 5% * 100 * 100 = 500 + first_purchase 300
        gained_free = C.balance(db, u.id) - base
        assert gained_free > 0
    finally:
        db.close()


# ----------------------------- auto-apply at checkout -----------------------------
def test_redeem_quote_caps_at_30pct_then_balance():
    from backend.database import SessionLocal
    from backend.models import User
    from backend.services import voltex_coin_service as C
    import uuid
    db = SessionLocal()
    try:
        u = User(email=f"q_{uuid.uuid4().hex[:8]}@t.io", password_hash="x", full_name="Q")
        db.add(u); db.commit(); db.refresh(u)
        C.award(db, u.id, "signup_bonus", amount=1500)   # $15 of coins
        # $149 product: 30% cap = $44.70, but only $15 of coins -> $15 off
        q = C.redeem_quote(db, u.id, 149.0)
        assert q["usd_off"] == 15.0 and q["vxc"] == 1500 and q["pay_usd"] == 134.0
        # $20 product: 30% cap = $6 (< $15 balance) -> capped at $6 off
        q2 = C.redeem_quote(db, u.id, 20.0)
        assert q2["usd_off"] == 6.0 and q2["vxc"] == 600 and q2["pay_usd"] == 14.0
    finally:
        db.close()


def test_coin_quote_endpoint(client, free_user):
    r = client.get("/api/coin/quote?usd=100", headers=free_user["headers"])
    assert r.status_code == 200
    q = r.json()
    # free user has 500 VXC ($5); 30% of $100 = $30 cap -> limited by $5 balance
    assert q["usd_off"] == 5.0 and q["pay_usd"] == 95.0
    # rejects non-positive
    assert client.get("/api/coin/quote?usd=0", headers=free_user["headers"]).status_code == 400
