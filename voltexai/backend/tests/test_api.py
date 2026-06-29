"""End-to-end API tests via TestClient: public data, auth, KYC, trade gating."""


# ----------------------------- public surfaces -----------------------------
def test_health_and_root(client):
    assert client.get("/health").json()["status"] == "healthy"
    assert client.get("/").json()["status"] == "ok"


def test_public_market_endpoints(client):
    assert client.get("/api/markets/instruments").json()["instruments"]
    assert client.get("/api/markets/quotes?asset_class=crypto").status_code == 200
    assert client.get("/api/markets/candles/AAPL?timeframe=M15&count=20").json()["count"] == 20
    st = client.get("/api/markets/status").json()
    assert "active_primary" in st and "oanda_stream" in st


def test_public_signals_and_directories(client):
    assert client.get("/api/signals/board/top").status_code == 200
    assert client.get("/api/directory/prop-firms").json()["count"] > 0
    assert client.get("/api/directory/brokers").json()["count"] > 0
    assert client.get("/api/fund/summary").status_code == 200
    assert len(client.get("/api/fund/pitch").json()["slides"]) > 0


def test_fund_enquiry(client):
    r = client.post("/api/fund/enquire",
                    json={"name": "Investor X", "email": "inv@test.io",
                          "amount_usd": 25000, "tier": "growth"})
    assert r.status_code == 200 and r.json()["received"] is True


# ----------------------------- auth -----------------------------
def test_register_login_me_flow(client, free_user):
    r = client.get("/api/auth/me", headers=free_user["headers"])
    assert r.status_code == 200
    assert r.json()["plan"] == "free"
    lg = client.post("/api/auth/login",
                     json={"email": free_user["email"], "password": "password123"})
    assert lg.status_code == 200 and lg.json()["access_token"]


def test_login_rejects_bad_password(client, free_user):
    r = client.post("/api/auth/login",
                    json={"email": free_user["email"], "password": "wrongpass"})
    assert r.status_code == 401


def test_duplicate_registration_conflicts(client, free_user):
    r = client.post("/api/auth/register",
                    json={"email": free_user["email"], "password": "password123"})
    assert r.status_code == 409


# ----------------------------- KYC -----------------------------
def test_kyc_submit_and_admin_decision(client, free_user, admin_user):
    # user starts with no KYC
    assert client.get("/api/kyc/status", headers=free_user["headers"]).json()["status"] == "none"
    sub = client.post("/api/kyc/submit", headers=free_user["headers"],
                      json={"full_legal_name": "Test Trader", "country": "Zambia",
                            "document_type": "passport", "document_number": "ZN1"})
    assert sub.json()["status"] == "pending"
    # non-admin can't list pending
    assert client.get("/api/kyc/pending", headers=free_user["headers"]).status_code == 403
    # admin approves
    assert client.get("/api/kyc/pending", headers=admin_user["headers"]).json()["count"] >= 1
    dec = client.post(f"/api/kyc/{free_user['user_id']}/decision",
                      headers=admin_user["headers"], json={"decision": "approve"})
    assert dec.json()["status"] == "approved"
    assert client.get("/api/kyc/status", headers=free_user["headers"]).json()["status"] == "approved"


# ----------------------------- trade gating -----------------------------
def test_trade_requires_auth(client):
    assert client.get("/api/trade/account").status_code == 401


def test_free_plan_cannot_place_orders(client, free_user):
    r = client.post("/api/trade/orders", headers=free_user["headers"],
                    json={"symbol": "AAPL", "side": "buy", "qty": 1, "type": "market"})
    assert r.status_code == 402   # payment required


def test_paid_plan_can_trade_and_reconcile(client, paid_user):
    acc = client.get("/api/trade/account", headers=paid_user["headers"])
    assert acc.status_code == 200 and acc.json()["broker"] == "paper"
    place = client.post("/api/trade/orders", headers=paid_user["headers"],
                        json={"symbol": "AAPL", "side": "buy", "qty": 3, "type": "market"})
    assert place.status_code == 201 and place.json()["status"] == "filled"
    pos = client.get("/api/trade/positions", headers=paid_user["headers"]).json()["positions"]
    assert any(p["symbol"] == "AAPL" for p in pos)
    recon = client.get("/api/trade/reconciliation", headers=paid_user["headers"])
    assert recon.status_code == 200 and recon.json()["broker"] == "paper"
    broker = client.get("/api/trade/broker", headers=paid_user["headers"]).json()
    assert broker["is_live"] is False
