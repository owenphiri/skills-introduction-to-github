"""
VoltexAI - Arbitrage / spread scanner routes (fee-aware, paper-first)

GET  /api/arbitrage/scan          - cross-venue net-edge scan + basis table (public read)
GET  /api/arbitrage/quotes/{sym}  - per-venue bid/ask for one symbol (public read)
GET  /api/arbitrage/status        - paper arb book + shared operator guardrails (public read)
POST /api/arbitrage/run           - book simulated hedged pairs above threshold (auth)
POST /api/arbitrage/close/{id}    - close a paper arb pair (auth)

Nothing here moves real money: the executor is paper-only and reuses the
auto-trader's kill switch / news guard / enable flag.
"""
from fastapi import APIRouter, Query, Depends, HTTPException

from ..services import arbitrage
from ..models import User
from ..middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/arbitrage", tags=["arbitrage"])


@router.get("/scan")
def scan(min_net_bps: float = Query(0.0),
         notional: float = Query(10000.0, gt=0),
         fee_tier_bps: float = Query(None, ge=0,
             description="Model a per-side fee tier (e.g. 0-2 bps maker/VIP) "
                         "instead of standard retail taker fees")):
    return arbitrage.scan(min_net_bps=min_net_bps, notional=notional,
                          fee_bps_override=fee_tier_bps)


@router.get("/quotes/{symbol}")
def quotes(symbol: str):
    q = arbitrage.venue_quotes(symbol)
    if not q:
        raise HTTPException(404, f"'{symbol}' is not cross-listed for arbitrage")
    return {"symbol": symbol.upper(), "venues": q}


@router.get("/status")
def status():
    return arbitrage.arb_status()


@router.post("/run")
def run(min_net_bps: float = Query(0.0),
        notional: float = Query(10000.0, gt=0),
        fee_tier_bps: float = Query(None, ge=0),
        _: User = Depends(get_current_user)):
    return arbitrage.run_arbitrage_cycle(min_net_bps=min_net_bps, notional=notional,
                                         fee_bps_override=fee_tier_bps)


@router.post("/close/{position_id}")
def close(position_id: str, _: User = Depends(get_current_user)):
    res = arbitrage.close_arb(position_id)
    if res.get("error"):
        raise HTTPException(404, res["error"])
    return res
