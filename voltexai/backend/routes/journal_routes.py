"""
Voltex Trade Journal routes (auth).
GET    /api/journal            - trades + full advanced dashboard (stats, equity,
                                 heat map, breakdowns)
POST   /api/journal            - log a trade
DELETE /api/journal/{id}       - delete a trade
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, JournalTrade
from ..middleware.auth_middleware import get_current_user
from ..services import journal_service

router = APIRouter(prefix="/api/journal", tags=["journal"])


class TradeIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    side: str = Field(pattern="^(buy|sell)$")
    entry: float
    exit: float | None = None
    size: float = Field(default=1.0, gt=0)
    pnl: float = 0.0
    rr: float | None = None
    setup: str | None = Field(default=None, max_length=60)
    trade_date: date | None = None
    notes: str | None = Field(default=None, max_length=2000)


def _user_trades(db: Session, uid: int) -> list[JournalTrade]:
    return (db.query(JournalTrade).filter(JournalTrade.user_id == uid)
            .order_by(JournalTrade.trade_date.desc(), JournalTrade.id.desc()).all())


@router.get("")
def get_journal(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    trades = _user_trades(db, user.id)
    return {"trades": [journal_service.to_dict(t) for t in trades],
            **journal_service.dashboard(trades)}


@router.post("", status_code=201)
def add_trade(data: TradeIn, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    t = JournalTrade(user_id=user.id, symbol=data.symbol.upper(), side=data.side,
                     entry=data.entry, exit=data.exit, size=data.size, pnl=data.pnl,
                     rr=data.rr, setup=data.setup, trade_date=data.trade_date or date.today(),
                     notes=data.notes)
    db.add(t)
    db.commit()
    db.refresh(t)
    # Voltex Coin: reward logging a trade (deduped per trade, capped 10/day)
    try:
        from ..services import voltex_coin_service
        voltex_coin_service.award_capped_daily(
            db, user.id, "journal_trade", ref=f"journal:{t.id}", max_per_day=10)
    except Exception:
        pass
    return journal_service.to_dict(t)


@router.delete("/{trade_id}")
def delete_trade(trade_id: int, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    t = (db.query(JournalTrade)
         .filter(JournalTrade.id == trade_id, JournalTrade.user_id == user.id).first())
    if not t:
        raise HTTPException(404, "Trade not found")
    db.delete(t)
    db.commit()
    return {"deleted": True, "id": trade_id}
