"""
Voltex Telegram Bot — command handlers + Telegram Stars VIP subscriptions.

Runs off a webhook (see routes/telegram_routes.py). All outbound calls go through
telegram_service.api_call, which is a no-op when the bot token is unset, so the
dispatcher logic is fully testable offline. Payments use Telegram Stars (XTR):
VIP Basic is a native recurring 30-day subscription; Pro/Elite are one-time Stars
purchases granting a longer window.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from ..config import settings
from ..models import TelegramSubscriber, ProSignal
from . import telegram_service as tg
from . import referral_service

logger = logging.getLogger(__name__)

# Stars pricing (XTR). Telegram recurring subscriptions must be 30 days.
PLANS = {
    "vip_basic": {"title": "VIP Basic — 30 days", "days": 30, "stars": 499, "recurring": True},
    "vip_pro":   {"title": "VIP Pro — 90 days",   "days": 90, "stars": 1299, "recurring": False},
    "vip_elite": {"title": "VIP Elite — 365 days", "days": 365, "stars": 3999, "recurring": False},
}

_MENU = {
    "inline_keyboard": [
        [{"text": "📊 Latest Signals", "callback_data": "signals"},
         {"text": "📈 Performance", "callback_data": "performance"}],
        [{"text": "💎 Become VIP", "callback_data": "vip"},
         {"text": "👤 My Status", "callback_data": "status"}],
        [{"text": "📚 Rules", "callback_data": "rules"},
         {"text": "🆘 Support", "callback_data": "support"}],
    ]
}

_VIP_BUTTONS = {
    "inline_keyboard": [
        [{"text": f"🥉 {PLANS['vip_basic']['title']} · {PLANS['vip_basic']['stars']}⭐", "callback_data": "buy:vip_basic"}],
        [{"text": f"🥈 {PLANS['vip_pro']['title']} · {PLANS['vip_pro']['stars']}⭐", "callback_data": "buy:vip_pro"}],
        [{"text": f"🥇 {PLANS['vip_elite']['title']} · {PLANS['vip_elite']['stars']}⭐", "callback_data": "buy:vip_elite"}],
    ]
}


async def _send(chat_id, text, keyboard=None):
    payload = {"chat_id": chat_id, "text": text, "disable_web_page_preview": True}
    if keyboard:
        payload["reply_markup"] = keyboard
    return await tg.api_call("sendMessage", payload)


def _sub(db: Session, tg_user: dict) -> TelegramSubscriber:
    tid = tg_user["id"]
    row = db.query(TelegramSubscriber).filter(TelegramSubscriber.telegram_id == tid).first()
    if not row:
        row = TelegramSubscriber(telegram_id=tid, username=tg_user.get("username"),
                                 first_name=tg_user.get("first_name"))
        db.add(row)
    row.last_seen = datetime.utcnow()
    row.username = tg_user.get("username") or row.username
    db.commit()
    return row


def is_vip(row: TelegramSubscriber | None) -> bool:
    return bool(row and row.vip_until and row.vip_until > datetime.utcnow())


# ---------------- text builders ----------------
def _rules_text() -> str:
    return ("📚 VOLTEX RULES\n\n"
            "• Risk 1% per idea, max 3 open.\n• Only A/A+ setups.\n"
            "• TP1 secure partial · TP2 move to BE · TP3 trail.\n"
            "• Discipline > everything. Educational only — not financial advice.")


def _signals_text(db: Session) -> str:
    rows = db.query(ProSignal).order_by(ProSignal.created_at.desc()).limit(5).all()
    if not rows:
        return "No signals published yet — the desk posts A+ setups as they trigger."
    lines = ["📊 LATEST SIGNALS\n"]
    for s in rows:
        lines.append(f"{s.grade} {s.symbol} {s.direction.upper()} · "
                     f"Q{int(s.quality_score)} · RR 1:{s.risk_reward} · {s.status}")
    lines.append("\n💎 Full entries, SL & TP2–4 in VIP. /vip")
    return "\n".join(lines)


def _performance_text(db: Session) -> str:
    from ..routes.pro_signals_routes import performance as _perf
    p = _perf(db)  # reuse the same aggregation
    return (f"📈 VOLTEX PERFORMANCE\n\n"
            f"Signals: {p['total_signals']}  ·  Graded: {p['graded']}\n"
            f"Win rate: {p['win_rate']}%\nProfit factor: {p['profit_factor']}\n"
            f"Total: {p['total_r']:+}R  ·  Best pair: {p['best_pair'] or '—'}\n\n"
            f"This week: {p['week']['signals']} signals, {p['week']['net_r']:+}R\n\n"
            f"Past performance does not guarantee future results.")


def _status_text(row: TelegramSubscriber) -> str:
    if is_vip(row):
        return (f"👤 YOUR STATUS\n\n💎 VIP active — {row.plan}\n"
                f"Expires: {row.vip_until:%Y-%m-%d}\nThank you for trading with Voltex ⚡")
    return "👤 YOUR STATUS\n\nFree tier. Upgrade for full setups + auto-execution: /vip"


# ---------------- payments ----------------
async def _send_invoice(chat_id, plan_id: str):
    plan = PLANS.get(plan_id)
    if not plan:
        return await _send(chat_id, "Unknown plan.")
    invoice = {
        "chat_id": chat_id, "title": f"VoltexAI {plan['title']}",
        "description": "VIP signals: full entry zones, SL & TP1–TP4, live management + MT5.",
        "payload": f"plan:{plan_id}", "currency": "XTR",
        "prices": [{"label": plan["title"], "amount": plan["stars"]}],
    }
    if plan["recurring"]:
        invoice["subscription_period"] = 2592000   # 30 days, required for Stars subscriptions
    return await tg.api_call("sendInvoice", invoice)


async def _grant_vip(db: Session, tg_user: dict, sp: dict):
    """Activate/extend VIP after a successful Stars payment."""
    plan_id = (sp.get("invoice_payload") or "").replace("plan:", "") or "vip_basic"
    plan = PLANS.get(plan_id, PLANS["vip_basic"])
    row = _sub(db, tg_user)
    base = row.vip_until if is_vip(row) else datetime.utcnow()
    row.vip_until = base + timedelta(days=plan["days"])
    row.plan = plan_id
    row.stars_paid = (row.stars_paid or 0) + int(sp.get("total_amount", plan["stars"]))
    row.is_recurring = bool(plan["recurring"])
    row.last_charge_id = sp.get("telegram_payment_charge_id")
    db.commit()

    # affiliate: credit the referrer on this conversion
    try:
        referral_service.qualify(db, referred_telegram_id=tg_user["id"],
                                 stars=int(sp.get("total_amount", plan["stars"])),
                                 note=f"VIP {plan_id}")
    except Exception as e:
        logger.warning("referral qualify failed: %s", e)

    # generate a single-use VIP channel invite (bot must be admin of the channel)
    link = None
    ch = settings.TELEGRAM_VIP_CHANNEL
    if ch:
        res = await tg.api_call("createChatInviteLink",
                                {"chat_id": ch, "member_limit": 1,
                                 "name": f"VIP {tg_user.get('username') or tg_user['id']}"})
        link = (res.get("result") or {}).get("invite_link")
    msg = (f"✅ Payment received — VIP active until {row.vip_until:%Y-%m-%d}!\n\n"
           f"Welcome to the winning team ⚡")
    if link:
        msg += f"\n\n🔗 Join the VIP channel: {link}"
    await _send(tg_user["id"], msg)


# ---------------- dispatcher ----------------
async def dispatch(update: dict, db: Session) -> dict:
    # 1) pre-checkout — must answer within seconds
    if "pre_checkout_query" in update:
        q = update["pre_checkout_query"]
        await tg.api_call("answerPreCheckoutQuery", {"pre_checkout_query_id": q["id"], "ok": True})
        return {"handled": "pre_checkout"}

    # 2) successful payment
    msg = update.get("message") or {}
    if "successful_payment" in msg:
        await _grant_vip(db, msg["from"], msg["successful_payment"])
        return {"handled": "payment"}

    # 3) callback buttons
    if "callback_query" in update:
        cq = update["callback_query"]
        data = cq.get("data", "")
        chat_id = cq["from"]["id"]
        await tg.api_call("answerCallbackQuery", {"callback_query_id": cq["id"]})
        row = _sub(db, cq["from"])
        if data.startswith("buy:"):
            await _send_invoice(chat_id, data.split(":", 1)[1])
        else:
            await _route(chat_id, data, row, db)
        return {"handled": "callback"}

    # 4) text commands
    if msg.get("text"):
        chat_id = msg["chat"]["id"]
        row = _sub(db, msg["from"])
        parts = msg["text"].strip().split()
        cmd = parts[0].lower().lstrip("/").split("@")[0]
        arg = parts[1] if len(parts) > 1 else None
        # /start <CODE> deep link -> attribute the referral to this Telegram user
        if cmd == "start" and arg and not row.ref_code:
            row.ref_code = arg.upper()
            db.commit()
            referral_service.attribute(db, arg, referred_telegram_id=msg["from"]["id"])
        await _route(chat_id, cmd, row, db)
        return {"handled": "command", "cmd": cmd}

    return {"handled": "ignored"}


async def expire_sweep(db) -> dict:
    """Kick lapsed VIPs from the channel and DM a renewal offer. Idempotent."""
    now = datetime.utcnow()
    lapsed = (db.query(TelegramSubscriber)
              .filter(TelegramSubscriber.vip_until.isnot(None),
                      TelegramSubscriber.vip_until < now,
                      TelegramSubscriber.expired_notified == False).all())  # noqa: E712
    ch = settings.TELEGRAM_VIP_CHANNEL
    for row in lapsed:
        if ch:
            await tg.api_call("banChatMember", {"chat_id": ch, "user_id": row.telegram_id,
                                                "until_date": int(now.timestamp()) + 40})
            await tg.api_call("unbanChatMember", {"chat_id": ch, "user_id": row.telegram_id,
                                                  "only_if_banned": True})
        await _send(row.telegram_id,
                    "⏳ Your Voltex VIP has expired. Renew to keep full setups, live "
                    "management and MT5 auto-execution ⚡\n\n/vip to resubscribe.")
        row.expired_notified = True
    db.commit()
    return {"checked": len(lapsed), "removed": len(lapsed)}


async def _route(chat_id, key, row, db):
    if key in ("start", "help", "menu"):
        await _send(chat_id,
                    "🚀 VOLTEX AI FOREX\n\nA+ signals, live management and VIP auto-execution.\n"
                    "Every day a payday. Roadmap to Billionaires ⚡\n\nChoose an option:", _MENU)
    elif key in ("vip", "subscribe"):
        await _send(chat_id, "💎 VOLTEX VIP\n\nUnlock full entry zones, SL & TP1–TP4, live "
                             "management and MT5 auto-execution. Pay with Telegram Stars ⭐:", _VIP_BUTTONS)
    elif key == "signals":
        await _send(chat_id, _signals_text(db))
    elif key == "performance":
        await _send(chat_id, _performance_text(db))
    elif key in ("status", "profile"):
        await _send(chat_id, _status_text(row))
    elif key == "rules":
        await _send(chat_id, _rules_text())
    elif key == "support":
        await _send(chat_id, "🆘 Support: support@voltexai.app · we reply fast. ⚡")
    else:
        await _send(chat_id, "Unknown command. Try /start", _MENU)
