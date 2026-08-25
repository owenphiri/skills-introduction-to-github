"""
Voltex Telegram Bot routes.
POST /api/telegram/webhook/{secret}   - Telegram pushes updates here
POST /api/telegram/set-webhook        - (admin) register the webhook with Telegram
GET  /api/telegram/vip/{telegram_id}  - VIP status lookup (gateway key or admin)
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User, UserRole, TelegramSubscriber
from ..middleware.auth_middleware import get_current_user
from ..services import telegram_bot, telegram_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/telegram", tags=["telegram"])


@router.post("/webhook/{secret}")
async def webhook(secret: str, request: Request, db: Session = Depends(get_db)):
    if not settings.TELEGRAM_WEBHOOK_SECRET or secret != settings.TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(404, "Not found")
    try:
        update = await request.json()
    except Exception:
        return {"ok": True}
    try:
        result = await telegram_bot.dispatch(update, db)
    except Exception as e:                       # never 500 back to Telegram
        logger.warning("telegram dispatch error: %s", e)
        result = {"handled": "error"}
    return {"ok": True, **result}


@router.post("/set-webhook")
async def set_webhook(request: Request, user: User = Depends(get_current_user)):
    if user.role != UserRole.ADMIN:
        raise HTTPException(403, "Admin only")
    if not (settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_WEBHOOK_SECRET):
        raise HTTPException(400, "Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET first")
    base = str(request.base_url).rstrip("/")
    url = f"{base}/api/telegram/webhook/{settings.TELEGRAM_WEBHOOK_SECRET}"
    res = await telegram_service.api_call("setWebhook", {
        "url": url,
        "allowed_updates": ["message", "callback_query", "pre_checkout_query"],
    })
    return {"requested_url": url, "telegram": res}


@router.get("/vip/{telegram_id}")
def vip_status(telegram_id: int, x_gateway_key: str | None = Header(default=None),
               db: Session = Depends(get_db)):
    if not settings.MT5_GATEWAY_KEY or x_gateway_key != settings.MT5_GATEWAY_KEY:
        raise HTTPException(401, "gateway key required")
    row = db.query(TelegramSubscriber).filter(TelegramSubscriber.telegram_id == telegram_id).first()
    return {"telegram_id": telegram_id, "vip": telegram_bot.is_vip(row),
            "vip_until": row.vip_until.isoformat() if row and row.vip_until else None,
            "plan": row.plan if row else None}
