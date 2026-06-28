"""
VoltexAI - Trade execution routes (auth required)
GET  /api/trade/account      - balance, equity, P&L, return
GET  /api/trade/positions    - open positions with live unrealized P&L
GET  /api/trade/orders       - order history (+ resting limit orders)
POST /api/trade/orders       - place a market or limit order
POST /api/trade/orders/{id}/cancel - cancel a resting limit order
GET  /api/trade/broker       - which broker is active + whether it's live money

The active broker is the safe built-in PaperBroker unless BROKER=alpaca with keys.
Placing/closing trades is gated to paid plans (Trader/Elite); the free plan can
view the account but not transact.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, PlanTier
from ..middleware.auth_middleware import get_current_user
from ..services.execution_service import get_broker
from ..config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/trade", tags=["trade"])


class OrderIn(BaseModel):
    symbol: str = Field(min_length=2, max_length=20)
    side: str = Field(pattern="^(buy|sell)$")
    qty: float = Field(gt=0)
    type: str = Field(default="market", pattern="^(market|limit)$")
    limit_price: float | None = Field(default=None, gt=0)
    note: str | None = Field(default=None, max_length=255)


def _plan(user: User) -> str:
    return user.subscription.plan.value if user.subscription else "free"


def _require_paid(user: User):
    if _plan(user) == "free":
        raise HTTPException(402,
            "Trading requires a Trader or Elite plan. Upgrade to place orders.")


@router.get("/broker")
def broker_info(user: User = Depends(get_current_user)):
    b = get_broker()
    is_live = getattr(b, "is_live", False)
    info = {
        "broker": b.name,
        "is_live": is_live,
        "configured": settings.BROKER,
        "note": ("Live brokerage — real orders." if is_live
                 else "Simulated paper trading — no real money moves."),
    }
    if b.name == "router":
        info["venue_map"] = b.venue_map()
        info["note"] = ("Multi-venue routing: each asset class trades on its venue. "
                        + ("Some venues are LIVE." if is_live
                           else "All venues simulated/practice."))
    return info


@router.get("/account")
async def account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await get_broker().get_account(db, user)


@router.get("/positions")
async def positions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"positions": await get_broker().get_positions(db, user)}


@router.get("/orders")
async def orders(limit: int = 50, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    return {"orders": await get_broker().list_orders(db, user, limit)}


@router.post("/orders", status_code=201)
async def place_order(data: OrderIn, user: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    _require_paid(user)
    if data.type == "limit" and not data.limit_price:
        raise HTTPException(400, "limit_price is required for limit orders")
    return await get_broker().place_order(
        db, user, symbol=data.symbol, side=data.side, qty=data.qty,
        order_type=data.type, limit_price=data.limit_price, note=data.note,
    )


@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    _require_paid(user)
    return await get_broker().cancel_order(db, user, order_id)
