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
