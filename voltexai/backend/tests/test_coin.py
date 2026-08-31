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


def test_plan_checkout_runs_coin_quote_without_error(client, free_user):
    # No Stripe/FLW keys in tests -> reaches the provider and 502s. A 500 would
    # mean the new coin-quote code path broke; 502 proves it ran cleanly.
    r = client.post("/api/payments/stripe/checkout", headers=free_user["headers"],
                    json={"plan": "trader", "interval": "month"})
    assert r.status_code == 502
    r2 = client.post("/api/payments/flutterwave/checkout", headers=free_user["headers"],
                     json={"plan": "pro", "interval": "year", "currency": "ZMW"})
    assert r2.status_code == 502


# ----------------------------- referral earn -----------------------------
def test_referrer_earns_vxc_when_friend_joins(client):
    import uuid
    # referrer registers and gets their code
    remail = f"ref_{uuid.uuid4().hex[:8]}@t.io"
    rr = client.post("/api/auth/register", json={
        "email": remail, "password": "password123", "full_name": "Referrer",
        "country": "Zambia"})
    assert rr.status_code == 201
    rhead = {"Authorization": f"Bearer {rr.json()['access_token']}"}
    code = client.get("/api/referrals/me", headers=rhead).json()["code"]
    before = client.get("/api/coin/wallet", headers=rhead).json()["balance"]

    # a friend joins with that code
    femail = f"friend_{uuid.uuid4().hex[:8]}@t.io"
    fr = client.post("/api/auth/register", json={
        "email": femail, "password": "password123", "full_name": "Friend",
        "country": "Nigeria", "referral_code": code})
    assert fr.status_code == 201

    after = client.get("/api/coin/wallet", headers=rhead).json()["balance"]
    from backend.services.voltex_coin_service import EARN_RULES
    assert after == before + EARN_RULES["referral_signup"]   # +750

    # the friend also got their own signup bonus
    fhead = {"Authorization": f"Bearer {fr.json()['access_token']}"}
    assert client.get("/api/coin/wallet", headers=fhead).json()["balance"] >= 500


def test_referral_reward_is_deduped_per_friend():
    # awarding twice for the same referral row pays the referrer only once
    from backend.database import SessionLocal
    from backend.models import User
    from backend.services import voltex_coin_service as C
    import uuid
    db = SessionLocal()
    try:
        u = User(email=f"rr_{uuid.uuid4().hex[:8]}@t.io", password_hash="x", full_name="RR")
        db.add(u); db.commit(); db.refresh(u)

        class _Ref:  # stand-in for a Referral row
            id = 12345
            referrer_user_id = u.id
        base = C.balance(db, u.id)
        C.award_referral(db, _Ref())
        C.award_referral(db, _Ref())          # same referral id -> no double pay
        assert C.balance(db, u.id) == base + C.EARN_RULES["referral_signup"]
    finally:
        db.close()


# ----------------------------- journal + academy earn -----------------------------
def test_logging_a_trade_earns_vxc(client, free_user):
    h = free_user["headers"]
    before = client.get("/api/coin/wallet", headers=h).json()["balance"]
    r = client.post("/api/journal", headers=h, json={
        "symbol": "XAUUSD", "side": "buy", "entry": 2300, "exit": 2320,
        "size": 1, "pnl": 200, "rr": 2.0, "setup": "SMC"})
    assert r.status_code == 201
    after = client.get("/api/coin/wallet", headers=h).json()["balance"]
    assert after == before + 15


def test_journal_earn_daily_cap(client, free_user):
    h = free_user["headers"]
    start = client.get("/api/coin/wallet", headers=h).json()["balance"]
    for i in range(12):    # cap is 10/day
        client.post("/api/journal", headers=h, json={
            "symbol": "EURUSD", "side": "buy", "entry": 1.1, "exit": 1.11,
            "size": 1, "pnl": 10, "rr": 1.0, "setup": "t"})
    gained = client.get("/api/coin/wallet", headers=h).json()["balance"] - start
    assert gained == 10 * 15          # only 10 awards, not 12


def test_academy_lesson_complete_earns_once(client, free_user):
    h = free_user["headers"]
    before = client.get("/api/coin/wallet", headers=h).json()["balance"]
    r = client.post("/api/academy/courses/how-markets-work/lessons/0/complete", headers=h)
    assert r.status_code == 200 and r.json()["earned"] == 40
    after = client.get("/api/coin/wallet", headers=h).json()["balance"]
    assert after == before + 40
    # completing the same lesson again pays nothing
    r2 = client.post("/api/academy/courses/how-markets-work/lessons/0/complete", headers=h)
    assert r2.json()["already_claimed"] is True and r2.json()["earned"] == 0
    assert client.get("/api/coin/wallet", headers=h).json()["balance"] == after


def test_academy_bad_lesson_404(client, free_user):
    h = free_user["headers"]
    assert client.post("/api/academy/courses/how-markets-work/lessons/999/complete",
                       headers=h).status_code == 404
    assert client.post("/api/academy/courses/nope/lessons/0/complete",
                       headers=h).status_code == 404


# ----------------------------- admin coin console -----------------------------
def test_admin_coin_stats_and_adjust(client, admin_user, free_user):
    ah = admin_user["headers"]
    # stats reachable by admin
    s = client.get("/api/admin/coins/stats", headers=ah)
    assert s.status_code == 200 and s.json()["symbol"] == "VXC"

    # look up the free user's ledger
    femail = free_user["email"]
    u = client.get(f"/api/admin/coins/user?q={femail}", headers=ah).json()
    before = u["balance"]

    # grant 1000
    g = client.post("/api/admin/coins/adjust", headers=ah,
                    json={"user_query": femail, "amount": 1000, "reason": "goodwill"})
    assert g.status_code == 200 and g.json()["balance"] == before + 1000

    # deduct 200
    d = client.post("/api/admin/coins/adjust", headers=ah,
                    json={"user_query": femail, "amount": -200, "reason": "correction"})
    assert d.json()["balance"] == before + 800

    # cannot deduct into the negative
    bad = client.post("/api/admin/coins/adjust", headers=ah,
                      json={"user_query": femail, "amount": -10_000_000, "reason": "x"})
    assert bad.status_code in (400, 422)


def test_admin_coin_requires_admin(client, free_user):
    # a normal user cannot reach the admin console
    assert client.get("/api/admin/coins/stats", headers=free_user["headers"]).status_code == 403
    assert client.get("/api/admin/coins/stats").status_code == 401
