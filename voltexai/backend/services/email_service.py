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
    VoltexAI — powered by Axion Labs Technologies. Trading carries a high risk of
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


# ----------------------------- receipts -----------------------------
def _money(amount: float, currency: str) -> str:
    """Format an amount with a symbol for common currencies, code otherwise."""
    sym = {"USD": "$", "ZMW": "K", "NGN": "₦", "KES": "KSh",
           "GHS": "₵", "ZAR": "R"}.get((currency or "").upper())
    n = f"{amount:,.2f}"
    return f"{sym}{n}" if sym else f"{n} {currency.upper()}"


def _receipt_html(*, receipt_no: str, date_str: str, buyer_name: str | None,
                  buyer_email: str, items: list[tuple[str, str, float]],
                  total: float, currency: str, method: str, reference: str) -> str:
    from ..data.products import COMPANY
    rows = ""
    for label, detail, amount in items:
        sub = (f'<div style="color:#6b7689;font-size:12px;margin-top:2px;">{detail}</div>'
               if detail else "")
        rows += (
            f'<tr><td style="padding:12px 0;border-bottom:1px solid #1f2a3d;color:#e6ecf3;">'
            f'<div style="font-weight:600;color:#e6ecf3;">{label}</div>{sub}</td>'
            f'<td style="padding:12px 0;border-bottom:1px solid #1f2a3d;text-align:right;'
            f'white-space:nowrap;font-family:monospace;color:#e6ecf3;">'
            f'{_money(amount, currency)}</td></tr>')
    return f"""\
<div style="background:#0a0e1a;color:#e6ecf3;font-family:Inter,Arial,sans-serif;
     padding:32px;border-radius:16px;max-width:600px;margin:auto;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="font-size:22px;font-weight:800;color:{_BRAND};">⚡ VoltexAI</div>
      <div style="color:#6b7689;font-size:12px;margin-top:2px;">{COMPANY['powered_by']}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-weight:800;letter-spacing:1px;color:#b8c2d4;">RECEIPT</div>
      <div style="color:#6b7689;font-size:12px;margin-top:2px;">{receipt_no}</div>
    </div>
  </div>
  <hr style="border:none;border-top:1px solid #1f2a3d;margin:20px 0;">
  <table style="width:100%;font-size:13px;color:#b8c2d4;">
    <tr>
      <td style="vertical-align:top;">
        <div style="color:#6b7689;text-transform:uppercase;font-size:11px;letter-spacing:.5px;">Billed to</div>
        <div style="margin-top:4px;color:#e6ecf3;font-weight:600;">{buyer_name or 'Valued trader'}</div>
        <div style="margin-top:2px;">{buyer_email}</div>
      </td>
      <td style="vertical-align:top;text-align:right;">
        <div style="color:#6b7689;text-transform:uppercase;font-size:11px;letter-spacing:.5px;">Date</div>
        <div style="margin-top:4px;color:#e6ecf3;">{date_str}</div>
        <div style="color:#6b7689;text-transform:uppercase;font-size:11px;letter-spacing:.5px;margin-top:10px;">Payment</div>
        <div style="margin-top:4px;">{method}</div>
      </td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;margin-top:22px;font-size:14px;">
    <thead><tr>
      <th style="text-align:left;color:#6b7689;font-size:11px;text-transform:uppercase;
          letter-spacing:.5px;padding-bottom:8px;border-bottom:1px solid #1f2a3d;">Item</th>
      <th style="text-align:right;color:#6b7689;font-size:11px;text-transform:uppercase;
          letter-spacing:.5px;padding-bottom:8px;border-bottom:1px solid #1f2a3d;">Amount</th>
    </tr></thead>
    <tbody>{rows}</tbody>
  </table>
  <table style="width:100%;margin-top:16px;font-size:16px;">
    <tr>
      <td style="font-weight:700;color:#e6ecf3;">Total paid</td>
      <td style="text-align:right;font-weight:800;color:{_BRAND};font-family:monospace;">
        {_money(total, currency)}</td>
    </tr>
  </table>
  <div style="background:#121826;border:1px solid #1f2a3d;border-radius:10px;
       padding:12px 14px;margin-top:20px;color:#6b7689;font-size:12px;">
    Transaction reference: <span style="font-family:monospace;color:#b8c2d4;">{reference}</span>
    <br>Status: <span style="color:{_BRAND};font-weight:700;">PAID</span>
  </div>
  <p style="color:#6b7689;font-size:12px;margin-top:22px;line-height:1.6;">
    Thank you for your purchase. This receipt confirms your payment to
    {COMPANY['name']} ({COMPANY['legal']}), {COMPANY['hq']} · {COMPANY['established']}.
    Keep it for your records. Questions? Just reply to this email.
    <br><br>Trading carries a high risk of loss; this is not investment advice.
    <br>{COMPANY['copyright']}
  </p>
</div>"""


def send_receipt_email(email: str, name: str | None, *, receipt_no: str,
                       items: list[tuple[str, str, float]], total: float,
                       currency: str, method: str, reference: str,
                       date_str: str | None = None) -> bool:
    """Email an itemized, branded purchase receipt. Best-effort like all sends."""
    from datetime import datetime, timezone
    date_str = date_str or datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    html = _receipt_html(receipt_no=receipt_no, date_str=date_str, buyer_name=name,
                         buyer_email=email, items=items, total=total, currency=currency,
                         method=method, reference=reference)
    lines = "\n".join(f"  {lbl} — {_money(amt, currency)}" for lbl, _d, amt in items)
    text = (f"VoltexAI receipt {receipt_no}\nDate: {date_str}\n\n{lines}\n\n"
            f"Total paid: {_money(total, currency)}\nReference: {reference}\nStatus: PAID")
    return send_email(email, f"Your VoltexAI receipt · {receipt_no}", html, text=text)
