"""Global Results wall — feed, posting, likes, validation."""


def test_results_feed_public_has_seeds(client):
    d = client.get("/api/results/feed").json()
    assert d["count"] > 0
    assert any(p["real"] is False for p in d["posts"])          # seed wins present
    p = d["posts"][0]
    assert "flag" in p and "market" in p and "body" in p


def test_verified_feed_excludes_unverified(client, free_user, admin_user):
    rid = client.post("/api/results", headers=free_user["headers"],
                      json={"body": "fresh unverified win for the marquee test"}).json()["id"]
    v = client.get("/api/results/feed?verified=true").json()["posts"]
    assert all(p["verified"] for p in v)                 # only verified returned
    assert not any(p["id"] == rid for p in v)            # our unverified one excluded
    assert len(v) > 0                                    # verified seeds keep it alive

    client.post(f"/api/admin/results/{rid}/verify", headers=admin_user["headers"], json={"verified": True})
    v2 = client.get("/api/results/feed?verified=true").json()["posts"]
    assert any(p["id"] == rid for p in v2)               # now it shows in the marquee feed


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


# ----------------------------- admin moderation -----------------------------
def test_admin_verify_and_delete_result(client, free_user, admin_user):
    rid = client.post("/api/results", headers=free_user["headers"],
                      json={"body": "another clean win off the scanner"}).json()["id"]

    # non-admin cannot moderate
    assert client.get("/api/admin/results", headers=free_user["headers"]).status_code == 403

    listing = client.get("/api/admin/results", headers=admin_user["headers"]).json()
    assert any(r["id"] == rid and r["verified"] is False for r in listing["results"])

    # toggle verify -> true
    v = client.post(f"/api/admin/results/{rid}/verify", headers=admin_user["headers"], json={})
    assert v.status_code == 200 and v.json()["verified"] is True
    # explicit set -> false
    v2 = client.post(f"/api/admin/results/{rid}/verify", headers=admin_user["headers"],
                     json={"verified": False})
    assert v2.json()["verified"] is False

    # only_unverified filter includes it
    unv = client.get("/api/admin/results?only_unverified=true", headers=admin_user["headers"]).json()
    assert any(r["id"] == rid for r in unv["results"])

    # delete
    d = client.delete(f"/api/admin/results/{rid}", headers=admin_user["headers"])
    assert d.status_code == 200 and d.json()["deleted"] == rid
    assert not any(p["id"] == rid for p in client.get("/api/results/feed").json()["posts"])
