"""VoltexAI Real Estate — overview + coming-soon waitlist."""


def test_realestate_overview_coming_soon(client):
    r = client.get("/api/realestate")
    assert r.status_code == 200
    d = r.json()
    assert d["launch"]["status"] == "coming_soon"
    assert len(d["properties"]) >= 6
    assert "Zambia" in d["markets"]
    assert all({"id", "yield_pct", "min_invest_usd", "funded_pct"} <= set(p) for p in d["properties"])


def test_realestate_market_filter(client):
    d = client.get("/api/realestate?market=Nigeria").json()
    assert d["properties"] and all(p["country"] == "Nigeria" for p in d["properties"])


def test_realestate_waitlist_interest(client):
    ok = client.post("/api/realestate/interest", json={
        "property_id": "kasama-heights", "amount_usd": 500,
        "email": "investor@example.com", "provider": "flutterwave", "country": "Zambia"})
    assert ok.status_code == 201
    body = ok.json()
    assert body["ok"] is True and body["status"] == "coming_soon"
    # unknown property rejected
    assert client.post("/api/realestate/interest",
                       json={"property_id": "nope", "amount_usd": 10}).status_code == 404
    # anonymous interest (no email) still records
    assert client.post("/api/realestate/interest",
                       json={"property_id": "lagos-lekki", "amount_usd": 100}).status_code == 201
