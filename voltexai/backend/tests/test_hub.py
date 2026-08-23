"""Voltex hub features: sentiment, live sessions, resources, travel, community."""


def test_sentiment_overview(client):
    d = client.get("/api/sentiment").json()
    assert 0 <= d["fear_greed"] <= 100
    assert d["label"]
    assert 0 <= d["bullish_pct"] <= 100
    assert d["bullish"] + d["bearish"] + d["neutral"] > 0
    assert d["by_class"] and all("asset_class" in c for c in d["by_class"])
    assert isinstance(d["top_bullish"], list) and isinstance(d["top_bearish"], list)


def test_sessions_status(client):
    d = client.get("/api/sessions").json()
    names = {s["name"] for s in d["sessions"]}
    assert {"Sydney", "Tokyo", "London", "New York"} <= names
    assert "utc_time" in d and isinstance(d["open_now"], list)
    assert len(d["streams"]) >= 1
    assert all("starts_utc" in s for s in d["streams"])


def test_resources_and_calendar(client):
    r = client.get("/api/resources").json()
    assert r["resources"] and set(r["categories"]) >= {"guides", "tools"}
    guides = client.get("/api/resources?category=guides").json()["resources"]
    assert all(x["category"] == "guides" for x in guides)
    cal = client.get("/api/resources/calendar?days=7").json()
    assert cal["count"] == len(cal["events"])


def test_travel_events_and_rsvp(client):
    d = client.get("/api/travel").json()
    assert d["count"] >= 5
    summits = client.get("/api/travel?type=Summit").json()["events"]
    assert all(e["type"] == "Summit" for e in summits)
    ev_id = d["events"][0]["id"]
    ok = client.post(f"/api/travel/{ev_id}/rsvp",
                     json={"name": "Test Trader", "email": "t@test.io", "country": "Zambia"})
    assert ok.status_code == 200 and ok.json()["received"]
    assert client.post("/api/travel/nope/rsvp",
                       json={"name": "Test Trader", "email": "t@test.io"}).status_code == 404


def test_company_content(client):
    d = client.get("/api/company").json()
    for key in ("mission", "phrases", "global", "about", "services", "futures",
                "careers", "csr", "foundation", "press", "tv", "youtube", "media",
                "podcast", "blog", "offers", "awards", "faq", "sitemap"):
        assert key in d, f"missing {key}"
    assert len(d["services"]) >= 5
    assert d["futures"]["status"] == "Coming Soon"
    assert d["youtube"]["channel_url"].startswith("http")
    assert d["about"]["established"] == "EST. 2017"
    assert d["mission"]["headline"]
    assert len(d["phrases"]) >= 4 and all("color" in p for p in d["phrases"])
    assert d["careers"]["roles"] and d["faq"] and d["awards"]
    sections = {s["section"] for s in d["sitemap"]}
    assert {"Company", "Media"} <= sections


def test_careers_apply(client):
    role = client.get("/api/company").json()["careers"]["roles"][0]["id"]
    ok = client.post("/api/careers/apply",
                     json={"role_id": role, "name": "Test Trader", "email": "t@test.io"})
    assert ok.status_code == 200 and ok.json()["received"]
    assert client.post("/api/careers/apply",
                       json={"role_id": "nope", "name": "Test Trader", "email": "t@test.io"}).status_code == 404


def test_branding_axion_labs(client):
    c = client.get("/api/ecosystem").json()["company"]
    assert c["ceo"] == "OP OWENS PHIRI"
    assert c["legal"] == "Axion Labs Technologies"
    assert c["founded"] == 2017


def test_socials_include_tiktok_youtube(client):
    ids = {s["id"] for s in client.get("/api/dashboard").json()["socials"]}
    assert {"tiktok", "youtube"} <= ids


def test_live_subscribers(client):
    d = client.get("/api/live/subscribers").json()
    assert d["total"] > 40000 and d["per_min"] > 0
    assert len(d["regions"]) >= 4 and d["recent"]
    assert d["countries"] >= 20


def test_brokers_include_vantage(client):
    firms = client.get("/api/directory/brokers").json()["brokers"]
    assert any(b["id"] == "vantage" for b in firms)


def test_journal_flow(client, free_user):
    H = free_user["headers"]
    assert client.get("/api/journal").status_code == 401
    empty = client.get("/api/journal", headers=H).json()
    assert empty["stats"]["count"] == 0 and "heatmap" in empty and "equity" in empty
    t = client.post("/api/journal", headers=H, json={
        "symbol": "eurusd", "side": "buy", "entry": 1.08, "exit": 1.085,
        "pnl": 120, "rr": 2.0, "setup": "SMC", "trade_date": "2026-08-20"})
    assert t.status_code == 201 and t.json()["symbol"] == "EURUSD"
    tid = t.json()["id"]
    client.post("/api/journal", headers=H, json={
        "symbol": "xauusd", "side": "sell", "entry": 2400, "exit": 2410, "pnl": -60, "rr": -1.0})
    d = client.get("/api/journal", headers=H).json()
    assert d["stats"]["count"] == 2 and d["stats"]["net_pnl"] == 60.0
    assert d["stats"]["win_rate"] == 50.0 and len(d["equity"]) == 2
    assert d["heatmap"]["days"] and d["by_symbol"]
    assert client.delete(f"/api/journal/{tid}", headers=H).json()["deleted"]
    assert client.get("/api/journal", headers=H).json()["stats"]["count"] == 1


def test_ea_fleet(client):
    d = client.get("/api/eas").json()
    assert d["count"] >= 6 and d["eas"]
    # ordered most-advanced first: flagships lead
    assert d["eas"][0]["tier"] == "Flagship"
    ids = [e["id"] for e in d["eas"]]
    assert ids[0] == "rl-alpha" and "gold-hydra" in ids
    assert any(e["self_optimizing"] for e in d["eas"])
    assert len(d["indicators"]) >= 8
    assert "Roadmap to Billionaires." in d["slogans"]


def test_sitemap_xml(client):
    r = client.get("/sitemap.xml")
    assert r.status_code == 200 and "application/xml" in r.headers["content-type"]
    assert r.text.count("<loc>") >= 20 and "/about" in r.text


def test_dashboard_snapshot(client):
    d = client.get("/api/dashboard").json()
    ids = {k["id"] for k in d["kpis"]}
    assert {"fear_greed", "bullish", "sessions", "products", "academy", "community"} <= ids
    assert all("value" in k and "label" in k for k in d["kpis"])
    assert d["analytics"]["by_class"] and d["analytics"]["sessions"]
    assert d["marquee"]["movers"] and d["marquee"]["wins"]
    social_ids = {s["id"] for s in d["socials"]}
    assert {"x", "telegram", "facebook", "whatsapp"} <= social_ids
    assert all(s["url"].startswith("http") for s in d["socials"])


def test_ecosystem_exposes_socials(client):
    d = client.get("/api/ecosystem").json()
    assert {s["id"] for s in d["socials"]} >= {"x", "telegram", "facebook", "whatsapp"}


def test_community_feed_and_post(client, free_user):
    feed = client.get("/api/community/feed").json()
    assert feed["count"] >= 1 and feed["posts"]
    # posting requires auth
    assert client.post("/api/community/posts", json={"body": "hi there"}).status_code == 401
    r = client.post("/api/community/posts", json={"body": "London open was clean today ⚡"},
                    headers=free_user["headers"])
    assert r.status_code == 201
    pid = r.json()["id"]
    assert r.json()["real"] is True
    # like increments
    liked = client.post(f"/api/community/posts/{pid}/like", headers=free_user["headers"])
    assert liked.status_code == 200 and liked.json()["likes"] == 1
    # the new post shows up in the feed
    assert any(p["id"] == pid for p in client.get("/api/community/feed").json()["posts"])
