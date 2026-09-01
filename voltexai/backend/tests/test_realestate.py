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


def test_property_prospectus_endpoint(client):
    r = client.get("/api/realestate/property/kasama-heights")
    assert r.status_code == 200
    p = r.json()["property"]
    assert p["id"] == "kasama-heights"
    assert p["highlights"] and p["summary"] and p["sponsor"]
    assert len(p["projection"]) == 5 and p["projection"][0]["year"] == 1
    assert r.json()["launch"]["status"] == "coming_soon"
    assert client.get("/api/realestate/property/nope").status_code == 404


def test_admin_waitlist(client, admin_user, free_user):
    # seed a couple of reservations
    client.post("/api/realestate/interest", json={"property_id": "kasama-heights", "amount_usd": 500, "email": "a@x.io"})
    client.post("/api/realestate/interest", json={"property_id": "kasama-heights", "amount_usd": 250, "email": "b@x.io"})
    client.post("/api/realestate/interest", json={"property_id": "lagos-lekki", "amount_usd": 1000, "email": "c@x.io"})
    w = client.get("/api/admin/realestate/waitlist", headers=admin_user["headers"])
    assert w.status_code == 200
    body = w.json()
    assert body["total_signups"] >= 3
    assert body["total_demand_usd"] >= 1750
    top = body["properties"][0]
    assert top["id"] in ("kasama-heights", "lagos-lekki") and top["total_usd"] > 0
    # non-admin blocked
    assert client.get("/api/admin/realestate/waitlist", headers=free_user["headers"]).status_code == 403


def test_admin_waitlist_csv(client, admin_user):
    client.post("/api/realestate/interest", json={"property_id": "dubai-jvc", "amount_usd": 3000, "email": "z@x.io", "provider": "stripe", "country": "UAE"})
    r = client.get("/api/admin/realestate/waitlist.csv", headers=admin_user["headers"])
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "attachment" in r.headers.get("content-disposition", "")
    text = r.text
    assert text.splitlines()[0] == "created_at_utc,property_id,property_name,email,amount_usd,provider,country"
    assert "dubai-jvc" in text and "JVC Smart Studios" in text
