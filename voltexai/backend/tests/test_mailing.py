"""
Automated mailing: subscribe / unsubscribe / re-opt-in, send logging, admin
broadcast + weekly digest, and the public/admin API surface. Email provider is
'console' in tests, so sends are best-effort and logged, never a real network call.
"""
import pytest

from backend.database import SessionLocal
from backend.services import mailing
from backend.models import NewsletterSubscriber, EmailLog, Campaign


@pytest.fixture(autouse=True)
def _schema(client):
    """Depend on the app client so init_db() has created the mailing tables."""
    yield


def _db():
    return SessionLocal()


def test_subscribe_creates_and_logs_welcome():
    db = _db()
    try:
        res = mailing.subscribe(db, "trader1@test.io", "Trader One", source="footer")
        assert res["ok"] is True
        sub = db.query(NewsletterSubscriber).filter_by(email="trader1@test.io").first()
        assert sub and sub.unsubscribe_token and not sub.unsubscribed
        # a welcome email was recorded
        assert db.query(EmailLog).filter_by(to_email="trader1@test.io",
                                            kind="newsletter_welcome").count() == 1
    finally:
        db.close()


def test_subscribe_rejects_bad_email():
    db = _db()
    try:
        assert mailing.subscribe(db, "not-an-email")["ok"] is False
    finally:
        db.close()


def test_duplicate_subscribe_is_idempotent():
    db = _db()
    try:
        mailing.subscribe(db, "dup@test.io")
        again = mailing.subscribe(db, "dup@test.io")
        assert again["ok"] and again.get("already")
        assert db.query(NewsletterSubscriber).filter_by(email="dup@test.io").count() == 1
    finally:
        db.close()


def test_unsubscribe_then_reoptin():
    db = _db()
    try:
        mailing.subscribe(db, "leave@test.io")
        tok = db.query(NewsletterSubscriber).filter_by(email="leave@test.io").first().unsubscribe_token
        out = mailing.unsubscribe(db, tok)
        assert out["ok"] and out["email"] == "leave@test.io"
        assert db.query(NewsletterSubscriber).filter_by(email="leave@test.io").first().unsubscribed
        # re-subscribe reactivates the same row
        again = mailing.subscribe(db, "leave@test.io")
        assert again["ok"] and again.get("reactivated")
        assert not db.query(NewsletterSubscriber).filter_by(email="leave@test.io").first().unsubscribed
    finally:
        db.close()


def test_unsubscribe_bad_token():
    db = _db()
    try:
        assert mailing.unsubscribe(db, "nope")["ok"] is False
    finally:
        db.close()


def test_broadcast_only_hits_active_subscribers():
    db = _db()
    try:
        mailing.subscribe(db, "b_active@test.io")
        mailing.subscribe(db, "b_gone@test.io")
        tok = db.query(NewsletterSubscriber).filter_by(email="b_gone@test.io").first().unsubscribe_token
        mailing.unsubscribe(db, tok)
        res = mailing.broadcast(db, "Hello list", "<p>News</p>", name="Test blast")
        assert res["ok"]
        active_emails = {s.email for s in db.query(NewsletterSubscriber).filter_by(unsubscribed=False)}
        assert "b_gone@test.io" not in active_emails
        # a campaign row was recorded with recipient counts
        camp = db.query(Campaign).filter_by(name="Test blast").first()
        assert camp and camp.status == "sent" and camp.recipients == res["recipients"]
    finally:
        db.close()


def test_weekly_digest_broadcasts():
    db = _db()
    try:
        mailing.subscribe(db, "digest@test.io")
        res = mailing.weekly_digest(db)
        assert res["ok"] and res["recipients"] >= 1
        assert db.query(Campaign).filter_by(kind="digest").count() >= 1
    finally:
        db.close()


def test_stats_shape():
    db = _db()
    try:
        mailing.subscribe(db, "stat@test.io")
        s = mailing.stats(db)
        assert s["subscribers_active"] >= 1
        assert "provider" in s and "emails_sent" in s
    finally:
        db.close()


# ----------------------------- API -----------------------------
def test_api_subscribe_public(client):
    r = client.post("/api/mailing/subscribe", json={"email": "api1@test.io", "name": "Api"})
    assert r.status_code == 200 and r.json()["ok"]


def test_api_subscribe_bad_email(client):
    assert client.post("/api/mailing/subscribe", json={"email": "bad"}).status_code == 400


def test_api_unsubscribe_returns_html(client):
    client.post("/api/mailing/subscribe", json={"email": "apiunsub@test.io"})
    db = _db()
    tok = db.query(NewsletterSubscriber).filter_by(email="apiunsub@test.io").first().unsubscribe_token
    db.close()
    r = client.get("/api/mailing/unsubscribe", params={"token": tok})
    assert r.status_code == 200 and "Unsubscribed" in r.text


def test_api_broadcast_requires_admin(client, paid_user, admin_user):
    body = {"subject": "Members note", "body_html": "<p>Hi</p>"}
    assert client.post("/api/mailing/broadcast", json=body,
                       headers=paid_user["headers"]).status_code == 403
    r = client.post("/api/mailing/broadcast", json=body, headers=admin_user["headers"])
    assert r.status_code == 200 and r.json()["ok"]


def test_api_stats_admin_only(client, admin_user):
    assert client.get("/api/mailing/stats").status_code == 401
    r = client.get("/api/mailing/stats", headers=admin_user["headers"])
    assert r.status_code == 200 and "subscribers_active" in r.json()
