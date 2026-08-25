"""
Voltex Telegram publisher — formats and posts signals to the Free and VIP
channels via the Telegram Bot API. Fully gated: with no bot token / channel set
it becomes a no-op that just logs (like the console email provider), so the app
runs anywhere without external config.
"""
from __future__ import annotations

import logging

import httpx

from ..config import settings

logger = logging.getLogger(__name__)
_API = "https://api.telegram.org"


def configured() -> bool:
    return bool(settings.TELEGRAM_BOT_TOKEN)


async def api_call(method: str, payload: dict) -> dict:
    """Call any Bot API method. No-op (logged) when the bot token is unset."""
    if not configured():
        logger.info("[telegram:noop] %s %s", method, list(payload.keys()))
        return {"ok": False, "reason": "telegram not configured"}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.post(f"{_API}/bot{settings.TELEGRAM_BOT_TOKEN}/{method}", json=payload)
            data = r.json()
            if not data.get("ok"):
                logger.warning("telegram %s error: %s", method, data.get("description"))
            return data
    except Exception as e:
        logger.warning("telegram %s failed: %s", method, e)
        return {"ok": False, "reason": str(e)}


def _channel(tier: str) -> str | None:
    return settings.TELEGRAM_VIP_CHANNEL if tier == "vip" else settings.TELEGRAM_FREE_CHANNEL


def format_free(sig: dict) -> str:
    return (
        f"🚨 VOLTEX AI FOREX\n\n{sig['grade_emoji']} {sig['symbol']} {sig['direction'].upper()}\n\n"
        f"Entry: {sig['entry']}\nSL: {sig['sl']}\n"
        f"TP1: {sig['tp1']}\nTP2: {sig['tp2']}\nTP3: {sig['tp3']}\n\n"
        f"RR: 1:{sig['risk_reward']}   ·   Quality: {int(sig['quality_score'])}/100\n\n"
        f"💎 Full entry zone, TP4 & live management in VIP.\n"
        f"⚠️ Educational only. Trade responsibly."
    )


def format_vip(sig: dict) -> str:
    sess = f"\n🕐 Session: {sig['session']}" if sig.get("session") else ""
    return (
        f"🔥 VOLTEX AI VIP SIGNAL\n\n{sig['symbol']} — {sig['direction'].upper()} "
        f"{sig['grade_emoji']}\n━━━━━━━━━━━━━━━━━━\n"
        f"📍 Entry: {sig['entry']}\n🛑 Stop Loss: {sig['sl']}\n"
        f"🎯 TP1: {sig['tp1']}\n🎯 TP2: {sig['tp2']}\n🎯 TP3: {sig['tp3']}\n🎯 TP4: {sig['tp4']}\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"RR: 1:{sig['risk_reward']}   ·   Quality: {int(sig['quality_score'])}/100 "
        f"({sig['grade']}){sess}\n"
        f"Strategy: {sig['strategy']}\n\n"
        f"Management: TP1 secure partial · TP2 move SL to BE · TP3 trail."
    )


async def _send(tier: str, text: str) -> dict:
    ch = _channel(tier)
    if not configured() or not ch:
        logger.info("[telegram:noop tier=%s] %s", tier, text.split(chr(10))[0])
        return {"sent": False, "reason": "telegram not configured"}
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.post(
                f"{_API}/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": ch, "text": text, "disable_web_page_preview": True},
            )
            ok = r.status_code == 200 and r.json().get("ok")
            return {"sent": bool(ok), "tier": tier}
    except Exception as e:
        logger.warning("telegram send failed: %s", e)
        return {"sent": False, "reason": str(e)}


async def publish_signal(sig: dict) -> dict:
    """Free channel gets the basic card; VIP gets the full setup."""
    free = await _send("free", format_free(sig))
    vip = await _send("vip", format_vip(sig))
    return {"free": free, "vip": vip}


async def publish_update(text: str, tier: str = "vip") -> dict:
    return await _send(tier, text)
