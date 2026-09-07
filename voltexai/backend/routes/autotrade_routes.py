"""
VoltexAI - Auto-Trader routes (scanner-anchored, risk-gated execution)

GET  /api/autotrade/status      - config, balance, open positions, risk budget (public read)
POST /api/autotrade/run         - run one scan+auto-execute cycle (auth)
GET  /api/autotrade/positions   - open positions, marked to market (auth)
POST /api/autotrade/close/{id}  - close a paper position (auth)

Execution is PAPER by default and gated: live routing needs a broker token AND an
explicit opt-in (see auto_trader.config). Nothing here moves real money unless the
operator has deliberately enabled live mode.
"""
from fastapi import APIRouter, Query, Depends, HTTPException

from ..services import auto_trader
from ..models import User
from ..middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/autotrade", tags=["autotrade"])


@router.get("/status")
def status():
    return auto_trader.status()


@router.post("/run")
def run(asset_class: str = Query("all"),
        timeframe: str = Query(None),
        htf: str = Query(None),
        _: User = Depends(get_current_user)):
    return auto_trader.run_cycle(asset_class, timeframe, htf)


@router.get("/positions")
def positions(_: User = Depends(get_current_user)):
    return {"positions": auto_trader.positions()}


@router.post("/close/{position_id}")
def close(position_id: str, _: User = Depends(get_current_user)):
    res = auto_trader.close_position(position_id)
    if res.get("error"):
        raise HTTPException(404, res["error"])
    return res
