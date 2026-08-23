"""Voltex ecosystem: products, academy, store, pay, gamification, competition."""


def test_ecosystem_catalog(client):
    d = client.get("/api/ecosystem").json()
    assert d["company"]["ceo"] == "OP Owens"
    ids = {p["id"] for p in d["products"]}
    for expected in {"markets", "signals", "vision", "scanner", "academy",
                     "prop-intel", "broker-intel", "alpha", "pay", "competition", "store"}:
        assert expected in ids
    # every product routes somewhere
    assert all(p["route"].startswith("/") for p in d["products"])


def test_academy(client):
    ov = client.get("/api/academy/overview").json()
    assert ov["total_courses"] >= 10 and len(ov["tracks"]) >= 6
    all_courses = client.get("/api/academy/courses").json()["count"]
    forex = client.get("/api/academy/courses?track=markets").json()["courses"]
    assert 0 < len(forex) < all_courses
    cid = forex[0]["id"]
    assert client.get(f"/api/academy/courses/{cid}").json()["lessons"]
    assert client.get("/api/academy/courses/nope").status_code == 404


def test_store_and_pay(client):
    store = client.get("/api/store").json()
    assert store["products"] and set(store["categories"]) >= {"plans", "merch"}
    plans = client.get("/api/store?category=plans").json()["products"]
    assert all(p["category"] == "plans" for p in plans)
    pay = client.get("/api/pay").json()
    names = {m["name"] for m in pay["methods"]}
    assert "M-Pesa" in names and "Mastercard" in names and "PayPal" in names
    assert pay["live_count"] >= 1


def test_gamification_requires_auth_and_returns_profile(client, paid_user):
    assert client.get("/api/gamification/me").status_code == 401
    g = client.get("/api/gamification/me", headers=paid_user["headers"]).json()
    assert g["level"] >= 0 and "rank" in g and isinstance(g["badges"], list)
    # elite/trader plan grants XP
    assert g["xp"] > 0


def test_competition_join_and_leaderboard(client, paid_user):
    # contests list is public
    contests = client.get("/api/competition").json()["contests"]
    assert len(contests) >= 1
    cid = contests[0]["id"]
    # join (auth) then appear on the leaderboard
    r = client.post(f"/api/competition/{cid}/join", headers=paid_user["headers"])
    assert r.status_code == 201 and r.json()["joined"]
    # duplicate join rejected
    assert client.post(f"/api/competition/{cid}/join", headers=paid_user["headers"]).status_code == 409
    board = client.get(f"/api/competition/{cid}/leaderboard").json()
    assert board["count"] >= 1
    assert board["leaderboard"][0]["rank"] == 1


def test_competition_join_requires_auth(client):
    assert client.post("/api/competition/weekly-sprint/join").status_code == 401


def test_social_testimonials_and_proof(client):
    t = client.get("/api/social/testimonials").json()
    assert len(t["testimonials"]) >= 3 and t["stats"]
    p = client.get("/api/social/proof").json()
    assert p["count"] > 0
    ev = p["events"][0]
    assert {"type", "name", "location", "detail"} <= set(ev)
