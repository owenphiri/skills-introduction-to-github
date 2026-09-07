"""Global Results wall — feed, posting, likes, validation."""


def test_results_feed_public_has_seeds(client):
    d = client.get("/api/results/feed").json()
    assert d["count"] > 0
    assert any(p["real"] is False for p in d["posts"])          # seed wins present
    p = d["posts"][0]
    assert "flag" in p and "market" in p and "body" in p


def test_results_market_filter(client):
    d = client.get("/api/results/feed?market=synthetics").json()
    assert all(p.get("market") == "synthetics" for p in d["posts"] if p.get("market"))


def test_post_result_requires_auth(client):
    assert client.post("/api/results", json={"body": "made money"}).status_code in (401, 403)


def test_post_and_like_result(client, free_user):
    h = free_user["headers"]
    r = client.post("/api/results", headers=h, json={
        "body": "Caught a clean gold long off the scanner — +6% today!",
        "symbol": "XAUUSD", "market": "metals", "timeframe": "M15",
        "pnl_pct": 6.0, "pnl_amount": 300, "image_url": "https://example.com/win.png",
    })
    assert r.status_code == 201
    body = r.json()
    assert body["real"] is True and body["verified"] is False
    assert body["symbol"] == "XAUUSD" and body["market"] == "metals"
    assert body["image_url"].startswith("https://")
    rid = body["id"]

    # it appears in the feed (real posts first)
    feed = client.get("/api/results/feed").json()
    assert any(p["id"] == rid for p in feed["posts"])

    liked = client.post(f"/api/results/{rid}/like", headers=h).json()
    assert liked["likes"] == 1


def test_bad_image_url_rejected(client, free_user):
    r = client.post("/api/results", headers=free_user["headers"],
                    json={"body": "nice win here", "image_url": "javascript:alert(1)"})
    assert r.status_code == 422


def test_unknown_market_is_nulled(client, free_user):
    r = client.post("/api/results", headers=free_user["headers"],
                    json={"body": "solid week overall", "market": "tulips"})
    assert r.status_code == 201 and r.json()["market"] is None
