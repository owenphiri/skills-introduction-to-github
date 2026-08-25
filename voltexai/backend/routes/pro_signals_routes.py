"""
Voltex Signals SaaS — the managed TradingView -> engine -> Free/VIP -> MT5 pipeline.

Public / user:
  GET  /api/pro-signals/feed         - signal feed (VIP detail gated by plan)
  GET  /api/pro-signals/performance  - win rate, profit factor, weekly report
  GET  /api/pro-signals/{uuid}       - one signal (VIP detail gated)

Ingestion / ops (secured):
  POST /api/pro-signals/webhook          - TradingView alert (shared secret)
  POST /api/pro-signals/{uuid}/events    - lifecycle update (admin or MT5 gateway key)
  POST /api/pro-signals                  - manual signal (admin)
  GET  /api/pro-signals/mt5/pull         - EA pulls active signals (gateway key)
  POST /api/pro-signals/mt5/execution    - EA reports an execution (gateway key)
"""
import logging
import uuid as _uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User, PlanTier, UserRole, ProSignal, ProSignalEvent
from ..middleware.auth_middleware import get_current_user, get_current_user_optional
from ..services import signal_score, telegram_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pro-signals", tags=["pro-signals"])

_VIP_PLANS = {PlanTier.TRADER, PlanTier.ELITE}
_CLOSE_EVENTS = {"closed", "cancelled", "sl"}


def _is_vip(user: User | None) -> bool:
    if not user:
        return False
    if user.role == UserRole.ADMIN:
        return True
    plan = user.subscription.plan if user.subscription else PlanTier.FREE
    return plan in _VIP_PLANS


def _require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(403, "Admin only")
    return user


def _require_gateway(x_gateway_key: str | None = Header(default=None)):
    if not settings.MT5_GATEWAY_KEY or x_gateway_key != settings.MT5_GATEWAY_KEY:
        raise HTTPException(401, "Invalid gateway key")
    return True


def _public(s: ProSignal, vip: bool) -> dict:
    """Serialize a signal — VIP detail (entry zone, SL, TP2-4) masked for free users."""
    base = {
        "uuid": s.signal_uuid, "symbol": s.symbol, "direction": s.direction,
        "timeframe": s.timeframe, "grade": s.grade,
        "grade_emoji": signal_score.grade_emoji(s.grade),
        "quality_score": s.quality_score, "risk_reward": s.risk_reward,
        "strategy": s.strategy, "session": s.session, "status": s.status,
        "result_r": s.result_r, "tier": s.tier,
        "created_at": s.created_at.isoformat(),
    }
    if vip or s.tier == "free":
        base.update({"entry": s.entry, "sl": s.sl, "tp1": s.tp1, "tp2": s.tp2,
                     "tp3": s.tp3, "tp4": s.tp4, "locked": False})
    else:
        # free preview: show entry + TP1 only, lock the rest
        base.update({"entry": s.entry, "sl": None, "tp1": s.tp1, "tp2": None,
                     "tp3": None, "tp4": None, "locked": True})
    return base


# ---------------- ingestion ----------------
class WebhookIn(BaseModel):
    secret: str | None = None
    symbol: str
    direction: str
    timeframe: str | None = None
    entry: float
    sl: float
    strategy: str | None = None
    session: str | None = None
    signal_id: str | None = None
    components: dict | None = None

    class Config:
        extra = "allow"   # accept confluence flags (htf, liquidity, ob, fvg, ...)


async def _ingest(payload: dict, db: Session, tier: str = "vip") -> dict:
    try:
        sig = signal_score.build_signal(payload)
    except ValueError as e:
        raise HTTPException(422, str(e))

    if sig["quality_score"] < settings.SIGNAL_MIN_SCORE:
        return {"received": True, "published": False, "grade": sig["grade"],
                "quality_score": sig["quality_score"],
                "reason": f"below min score {settings.SIGNAL_MIN_SCORE}"}

    sid = str(payload.get("signal_id") or "").strip() or f"{sig['symbol']}-{_uuid.uuid4().hex[:10]}"
    if db.query(ProSignal).filter(ProSignal.signal_uuid == sid).first():
        return {"received": True, "published": False, "reason": "duplicate signal_id",
                "signal_uuid": sid}

    row = ProSignal(
        signal_uuid=sid, symbol=sig["symbol"], direction=sig["direction"],
        timeframe=sig["timeframe"], entry=sig["entry"], sl=sig["sl"],
        tp1=sig["tp1"], tp2=sig["tp2"], tp3=sig["tp3"], tp4=sig["tp4"],
        risk_reward=sig["risk_reward"], quality_score=sig["quality_score"],
        grade=sig["grade"], strategy=sig["strategy"], session=sig["session"],
        tier=tier, status="active", published=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    published = await telegram_service.publish_signal(sig)
    return {"received": True, "published": True, "signal_uuid": sid,
            "grade": sig["grade"], "quality_score": sig["quality_score"],
            "telegram": published}


@router.post("/webhook")
async def tradingview_webhook(data: WebhookIn, request: Request, db: Session = Depends(get_db)):
    payload = data.model_dump()
    # merge any extra confluence flags TradingView included
    try:
        payload.update({k: v for k, v in (await request.json()).items() if k not in payload})
    except Exception:
        pass
    if settings.TRADINGVIEW_WEBHOOK_SECRET and payload.get("secret") != settings.TRADINGVIEW_WEBHOOK_SECRET:
        raise HTTPException(401, "Invalid webhook secret")
    return await _ingest(payload, db, tier="vip")


@router.post("", status_code=201)
async def create_signal(data: WebhookIn, _: User = Depends(_require_admin),
                        db: Session = Depends(get_db)):
    return await _ingest(data.model_dump(), db, tier="vip")


# ---------------- feed / read ----------------
@router.get("/feed")
def feed(limit: int = 20, tier: str = "all",
         user: User | None = Depends(get_current_user_optional),
         db: Session = Depends(get_db)):
    vip = _is_vip(user)
    q = db.query(ProSignal).order_by(ProSignal.created_at.desc())
    if tier in ("free", "vip"):
        q = q.filter(ProSignal.tier == tier)
    rows = q.limit(min(limit, 100)).all()
    return {"is_vip": vip, "count": len(rows),
            "signals": [_public(s, vip) for s in rows]}


@router.get("/performance")
def performance(db: Session = Depends(get_db)):
    closed = db.query(ProSignal).filter(ProSignal.status.in_(["closed", "cancelled"])).all()
    graded = [s for s in closed if s.result_r is not None]
    n = len(graded)
    wins = [s for s in graded if s.result_r > 0]
    losses = [s for s in graded if s.result_r <= 0]
    gross_win = sum(s.result_r for s in wins)
    gross_loss = -sum(s.result_r for s in losses)
    total_active = db.query(ProSignal).filter(ProSignal.status == "active").count()

    def _by(attr):
        agg: dict[str, float] = {}
        for s in wins:
            k = getattr(s, attr) or "—"
            agg[k] = agg.get(k, 0) + s.result_r
        return max(agg, key=agg.get) if agg else None

    week_ago = datetime.utcnow() - timedelta(days=7)
    wk = [s for s in graded if s.created_at >= week_ago]
    return {
        "total_signals": db.query(ProSignal).count(),
        "graded": n, "active": total_active,
        "wins": len(wins), "losses": len(losses),
        "win_rate": round(len(wins) / n * 100, 1) if n else 0,
        "avg_win_r": round(gross_win / len(wins), 2) if wins else 0,
        "avg_loss_r": round(-gross_loss / len(losses), 2) if losses else 0,
        "profit_factor": round(gross_win / gross_loss, 2) if gross_loss else (round(gross_win, 2) or 0),
        "total_r": round(sum(s.result_r for s in graded), 2),
        "best_pair": _by("symbol"), "best_session": _by("session"),
        "week": {"signals": len(wk), "wins": sum(1 for s in wk if s.result_r > 0),
                 "net_r": round(sum(s.result_r for s in wk), 2)},
    }


@router.get("/mt5/pull")
def mt5_pull(_: bool = Depends(_require_gateway), db: Session = Depends(get_db)):
    rows = (db.query(ProSignal).filter(ProSignal.status == "active")
            .order_by(ProSignal.created_at.desc()).limit(20).all())
    return {"count": len(rows), "signals": [{
        "uuid": s.signal_uuid, "symbol": s.symbol, "direction": s.direction,
        "entry": s.entry, "sl": s.sl, "tp1": s.tp1, "tp2": s.tp2, "tp3": s.tp3,
        "tp4": s.tp4, "grade": s.grade, "quality_score": s.quality_score,
    } for s in rows]}


@router.get("/{uuid}")
def one(uuid: str, user: User | None = Depends(get_current_user_optional),
        db: Session = Depends(get_db)):
    s = db.query(ProSignal).filter(ProSignal.signal_uuid == uuid).first()
    if not s:
        raise HTTPException(404, "Signal not found")
    events = (db.query(ProSignalEvent).filter(ProSignalEvent.signal_id == s.id)
              .order_by(ProSignalEvent.created_at.asc()).all())
    out = _public(s, _is_vip(user))
    out["events"] = [{"event": e.event, "price": e.price, "note": e.note,
                      "at": e.created_at.isoformat()} for e in events]
    return out


# ---------------- lifecycle events ----------------
class EventIn(BaseModel):
    event: str = Field(pattern="^(filled|tp1|tp2|tp3|tp4|be|closed|cancelled|sl)$")
    price: float | None = None
    result_r: float | None = None
    note: str | None = None


async def _apply_event(uuid: str, data: EventIn, db: Session) -> dict:
    s = db.query(ProSignal).filter(ProSignal.signal_uuid == uuid).first()
    if not s:
        raise HTTPException(404, "Signal not found")
    db.add(ProSignalEvent(signal_id=s.id, event=data.event, price=data.price, note=data.note))
    if data.event in _CLOSE_EVENTS:
        s.status = "closed" if data.event != "cancelled" else "cancelled"
        if data.result_r is not None:
            s.result_r = data.result_r
    elif data.event == "filled":
        s.status = "filled"
    else:
        s.status = data.event   # tp1/tp2/tp3/tp4/be
    db.commit()

    label = {"filled": "🟢 FILLED", "tp1": "🎯 TP1 HIT", "tp2": "🎯 TP2 HIT",
             "tp3": "🎯 TP3 HIT", "tp4": "🏆 TP4 HIT", "be": "🛡️ MOVED TO BREAK-EVEN",
             "closed": "✅ CLOSED", "cancelled": "❌ CANCELLED", "sl": "🛑 STOPPED"}.get(data.event, data.event)
    txt = f"{label} — {s.symbol} {s.direction.upper()}"
    if data.result_r is not None:
        txt += f"\nResult: {data.result_r:+.1f}R"
    await telegram_service.publish_update(txt, tier="vip")
    return {"ok": True, "uuid": uuid, "status": s.status, "result_r": s.result_r}


@router.post("/{uuid}/events")
async def add_event(uuid: str, data: EventIn,
                    x_gateway_key: str | None = Header(default=None),
                    user: User | None = Depends(get_current_user_optional),
                    db: Session = Depends(get_db)):
    # authorize via the MT5 gateway key OR an admin JWT
    gateway_ok = bool(settings.MT5_GATEWAY_KEY) and x_gateway_key == settings.MT5_GATEWAY_KEY
    if not gateway_ok and not (user and user.role == UserRole.ADMIN):
        raise HTTPException(401, "Admin or gateway key required")
    return await _apply_event(uuid, data, db)


@router.post("/mt5/execution")
def mt5_execution(payload: dict, _: bool = Depends(_require_gateway)):
    logger.info("MT5 execution report: %s", payload)
    return {"received": True}
