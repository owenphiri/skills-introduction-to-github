"""
VoltexAI - automated mailing system

Newsletter subscriptions + an automated/broadcast sender built on top of the
existing email_service (SMTP / Resend / console providers). Every send is recorded
in EmailLog, every marketing email carries a one-click unsubscribe link, and
broadcasts are captured as Campaign rows for a clean audit trail.

Automated flows:
  * subscribe()      → confirmation/welcome email on opt-in
  * weekly_digest()  → composes top signals + the news calendar and broadcasts it
                        (call from a scheduler / cron)
  * broadcast()      → admin one-off to the list

Honesty: actual delivery depends on a configured provider (SMTP_HOST or a Resend
key). Without one, EMAIL_PROVIDER=console logs the message and the send is recorded
as 'sent (console)'. Nothing here guarantees inbox placement.
"""
from __future__ import annotations

import re
import secrets
from datetime import datetime

from sqlalchemy.orm import Session

from . import email_service
from ..config import settings
from ..models.mailing import NewsletterSubscriber, EmailLog, Campaign

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _valid(email: str) -> bool:
    return bool(email and _EMAIL_RE.match(email.strip()))


def _unsub_url(token: str) -> str:
    return f"{settings.BASE_URL}/api/mailing/unsubscribe?token={token}"


def _footer(token: str | None) -> str:
    if not token:
        return ""
    return (f'<p style="color:#8b97ac;font-size:11px;margin-top:18px">'
            f'You receive this because you subscribed to VoltexAI updates. '
            f'<a href="{_unsub_url(token)}" style="color:#8b97ac">Unsubscribe</a>.</p>')


def _log(db: Session, to: str, subject: str, kind: str,
         ok: bool, error: str | None = None) -> None:
    db.add(EmailLog(to_email=to, subject=subject, kind=kind,
                    status="sent" if ok else "failed", error=(error or None)[:300] if error else None))
    db.commit()


def _send_tracked(db: Session, to: str, subject: str, html: str,
                  text: str | None, kind: str) -> bool:
    ok, err = True, None
    try:
        ok = bool(email_service.send_email(to, subject, html, text=text))
    except Exception as e:                       # never let a bad address break a run
        ok, err = False, str(e)
    _log(db, to, subject, kind, ok, err)
    return ok


# ----------------------------- subscriptions -----------------------------
def subscribe(db: Session, email: str, name: str | None = None,
              source: str = "site", locale: str = "en") -> dict:
    email = (email or "").strip().lower()
    if not _valid(email):
        return {"ok": False, "error": "Enter a valid email address."}
    sub = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.email == email).first()
    reactivated = False
    if sub:
        if not sub.unsubscribed:
            return {"ok": True, "already": True, "message": "You're already subscribed — thank you!"}
        sub.unsubscribed = False                 # re-opt-in
        reactivated = True
    else:
        sub = NewsletterSubscriber(
            email=email, name=(name or None), source=source, locale=locale,
            unsubscribe_token=secrets.token_urlsafe(24))
        db.add(sub)
    db.commit(); db.refresh(sub)

    body = ("Welcome to the VoltexAI list ⚡ You'll get quality signal digests, "
            "high-impact news heads-ups and platform updates — no spam, unsubscribe "
            "anytime. Trade smart, trade safe.")
    html = email_service._wrap("You're subscribed", body, "Open VoltexAI",
                               f"{settings.FRONTEND_URL}/") + _footer(sub.unsubscribe_token)
    _send_tracked(db, email, "Welcome to VoltexAI updates ⚡", html, body, "newsletter_welcome")
    sub.last_emailed_at = datetime.utcnow(); db.commit()
    return {"ok": True, "reactivated": reactivated,
            "message": "Subscribed — check your inbox for a welcome email."}


def unsubscribe(db: Session, token: str) -> dict:
    sub = db.query(NewsletterSubscriber).filter(
        NewsletterSubscriber.unsubscribe_token == token).first()
    if not sub:
        return {"ok": False, "error": "This unsubscribe link is invalid or expired."}
    if not sub.unsubscribed:
        sub.unsubscribed = True
        db.commit()
    return {"ok": True, "email": sub.email, "message": "You've been unsubscribed. Sorry to see you go."}


def stats(db: Session) -> dict:
    q = db.query(NewsletterSubscriber)
    total = q.count()
    active = q.filter(NewsletterSubscriber.unsubscribed == False).count()  # noqa: E712
    sent = db.query(EmailLog).filter(EmailLog.status == "sent").count()
    failed = db.query(EmailLog).filter(EmailLog.status == "failed").count()
    campaigns = db.query(Campaign).count()
    return {"subscribers_total": total, "subscribers_active": active,
            "unsubscribed": total - active, "emails_sent": sent,
            "emails_failed": failed, "campaigns": campaigns,
            "provider": settings.EMAIL_PROVIDER}


# ----------------------------- broadcasts -----------------------------
def _recipients(db: Session, segment: str) -> list[NewsletterSubscriber]:
    q = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.unsubscribed == False)  # noqa: E712
    if segment == "confirmed":
        q = q.filter(NewsletterSubscriber.confirmed == True)  # noqa: E712
    return q.all()


def broadcast(db: Session, subject: str, body_html: str, *, segment: str = "all",
              name: str | None = None, kind: str = "broadcast") -> dict:
    """Send a message to the active list; audited as a Campaign."""
    if not subject or not body_html:
        return {"ok": False, "error": "subject and body are required"}
    recips = _recipients(db, segment)
    camp = Campaign(name=(name or subject)[:140], subject=subject[:255],
                    body_html=body_html, segment=segment, kind=kind,
                    status="sending", recipients=len(recips))
    db.add(camp); db.commit(); db.refresh(camp)

    sent = failed = 0
    for sub in recips:
        html = body_html + _footer(sub.unsubscribe_token)
        if _send_tracked(db, sub.email, subject, html, None, kind):
            sent += 1; sub.last_emailed_at = datetime.utcnow()
        else:
            failed += 1
    camp.sent_count, camp.failed_count = sent, failed
    camp.status, camp.sent_at = "sent", datetime.utcnow()
    db.commit()
    return {"ok": True, "campaign_id": camp.id, "recipients": len(recips),
            "sent": sent, "failed": failed, "provider": settings.EMAIL_PROVIDER}


# ----------------------------- automated digest -----------------------------
def _digest_html() -> tuple[str, str]:
    """Compose the weekly digest from live signals + the news calendar."""
    from . import signal_engine
    from ..data import news_events, instruments

    syms = [i["symbol"] for i in instruments.list_by_class("all")][:24]
    try:
        top = signal_engine.quality_scan(syms, "H1", "H4", min_grade="A", min_rr=1.8, limit=5)
    except Exception:
        top = []
    rows = "".join(
        f'<tr><td style="padding:6px 10px"><b>{s["symbol"]}</b></td>'
        f'<td style="padding:6px 10px">{s["direction"]}</td>'
        f'<td style="padding:6px 10px">{s.get("grade","-")}</td>'
        f'<td style="padding:6px 10px">R:R {s.get("risk_reward_tp3","-")}</td></tr>'
        for s in top) or '<tr><td style="padding:6px 10px" colspan="4">No A-grade setups clear the filter right now — patience pays.</td></tr>'

    cal = news_events.calendar(days=7)[:5]
    news = "".join(
        f'<li>{e.get("event","Event")} ({e.get("currency","")}) · '
        f'{e.get("time_cat") or e.get("countdown","soon")}</li>' for e in cal) \
        or "<li>No high-impact events flagged this week.</li>"

    body = (
        '<p>Your weekly VoltexAI edge — top higher-timeframe setups and the news that '
        'moves them. Educational only, not financial advice.</p>'
        '<h3 style="margin:16px 0 6px">Top quality setups</h3>'
        '<table style="border-collapse:collapse;font-size:13px;width:100%">'
        '<tr style="color:#8b97ac"><td style="padding:6px 10px">Symbol</td>'
        '<td style="padding:6px 10px">Bias</td><td style="padding:6px 10px">Grade</td>'
        f'<td style="padding:6px 10px">Target</td></tr>{rows}</table>'
        '<h3 style="margin:16px 0 6px">High-impact week ahead</h3>'
        f'<ul style="font-size:13px;line-height:1.7">{news}</ul>'
        '<p style="color:#8b97ac;font-size:12px">Trading is high-risk; you can lose more '
        'than you invest. Hypothetical/simulated results have limitations (CFTC 4.41).</p>')
    html = email_service._wrap("VoltexAI weekly digest ⚡", body, "Open the scanner",
                               f"{settings.FRONTEND_URL}/scanner")
    text = "VoltexAI weekly digest — top setups and the week's high-impact news. " \
           "Educational only, not financial advice."
    return html, text


def weekly_digest(db: Session, segment: str = "all") -> dict:
    """Build and broadcast the weekly digest — the automated flow (cron-friendly)."""
    html, _ = _digest_html()
    subject = f"VoltexAI weekly digest · {datetime.utcnow():%d %b %Y}"
    return broadcast(db, subject, html, segment=segment, name="Weekly digest", kind="digest")
