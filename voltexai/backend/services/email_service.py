"""
VoltexAI - Transactional email
One send_email() behind three providers, chosen by EMAIL_PROVIDER:
  * console (default) — logs the message; zero config, safe for dev/CI.
  * smtp             — any SMTP server (SendGrid/Mailgun/Gmail/etc.).
  * resend           — the Resend HTTP API (https://resend.com).

Plus typed helpers for the flows that need email: account verification, welcome,
password reset, and KYC status updates. All sends are best-effort: a failure is
logged and swallowed so it never breaks the request that triggered it.
"""
from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

_BRAND = "#c2f53d"


def _wrap(title: str, body_html: str, cta_label: str | None = None,
          cta_url: str | None = None) -> str:
    button = ""
    if cta_label and cta_url:
        button = (f'<a href="{cta_url}" style="display:inline-block;background:{_BRAND};'
                  f'color:#0a0e1a;font-weight:700;text-decoration:none;padding:12px 22px;'
                  f'border-radius:10px;margin:18px 0;">{cta_label}</a>')
    return f"""\
<div style="background:#0a0e1a;color:#e6ecf3;font-family:Inter,Arial,sans-serif;
     padding:32px;border-radius:16px;max-width:560px;margin:auto;">
  <div style="font-size:22px;font-weight:800;color:{_BRAND};margin-bottom:8px;">⚡ VoltexAI</div>
  <h2 style="margin:0 0 12px;">{title}</h2>
  <div style="color:#b8c2d4;line-height:1.6;">{body_html}</div>
  {button}
  <p style="color:#6b7689;font-size:12px;margin-top:24px;">
    VoltexAI by PrimeAxis ICT Trade &amp; Solutions Ltd. Trading carries a high risk of
    loss; this is not investment advice. If you didn't request this, you can ignore it.
  </p>
</div>"""


def send_email(to: str, subject: str, html: str, text: str | None = None) -> bool:
    """Dispatch one email. Returns True on (apparent) success, False otherwise."""
    provider = settings.EMAIL_PROVIDER
    text = text or "View this email in an HTML-capable client."
    try:
        if provider == "smtp" and settings.SMTP_HOST:
            return _send_smtp(to, subject, html, text)
        if provider == "resend" and settings.RESEND_API_KEY:
            return _send_resend(to, subject, html, text)
        # console / unconfigured fallback
        logger.info("[email:console] to=%s subject=%s\n%s", to, subject, text)
        return True
    except Exception as e:
        logger.warning("email send failed (provider=%s, to=%s): %s", provider, to, e)
        return False


def _send_smtp(to: str, subject: str, html: str, text: str) -> bool:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        if settings.SMTP_TLS:
            server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.EMAIL_FROM, [to], msg.as_string())
    logger.info("[email:smtp] sent to=%s subject=%s", to, subject)
    return True


def _send_resend(to: str, subject: str, html: str, text: str) -> bool:
    r = httpx.post("https://api.resend.com/emails", timeout=10,
                   headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                   json={"from": settings.EMAIL_FROM, "to": [to],
                         "subject": subject, "html": html, "text": text})
    r.raise_for_status()
    logger.info("[email:resend] sent to=%s subject=%s", to, subject)
    return True


# ----------------------------- typed flows -----------------------------
def send_verification_email(email: str, name: str | None, token: str) -> bool:
    url = f"{settings.FRONTEND_URL}/verify?token={token}"
    body = (f"Hi {name or 'trader'}, welcome to the winning team. "
            "Confirm your email to unlock the full terminal, live signals and the trade desk.")
    return send_email(email, "Confirm your VoltexAI account",
                      _wrap("Verify your email", body, "Verify my email", url),
                      text=f"{body}\nVerify: {url}")


def send_welcome_email(email: str, name: str | None) -> bool:
    body = ("You're in. Jump into the AI Terminal, scan live signals, paper-trade the "
            "markets risk-free, and level up with the Academy. Trade smart, trade safe.")
    return send_email(email, "Welcome to VoltexAI ⚡",
                      _wrap("Welcome aboard", body, "Open the terminal",
                            f"{settings.FRONTEND_URL}/terminal"),
                      text=body)


def send_password_reset_email(email: str, token: str) -> bool:
    url = f"{settings.FRONTEND_URL}/reset?token={token}"
    body = ("We received a request to reset your password. This link expires shortly. "
            "If it wasn't you, ignore this email.")
    return send_email(email, "Reset your VoltexAI password",
                      _wrap("Reset your password", body, "Choose a new password", url),
                      text=f"{body}\nReset: {url}")


def send_kyc_status_email(email: str, name: str | None, status: str) -> bool:
    msgs = {
        "pending": "We've received your verification and our team is reviewing it.",
        "approved": "You're verified ✅ — your account is fully unlocked.",
        "rejected": "We couldn't verify your details. Please review and resubmit.",
    }
    body = f"Hi {name or 'trader'}, {msgs.get(status, 'your verification status was updated.')}"
    return send_email(email, f"VoltexAI verification: {status}",
                      _wrap("Identity verification", body), text=body)
