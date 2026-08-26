"""
VoltexAI Chart Patterns route (public).
GET /api/patterns?symbol=EURUSD&timeframe=M15
Detects a chart pattern on the live/synthetic candles and returns a visual
trade plan (entry, SL, TP1–TP3, break-even) plus drawing geometry.
"""
from fastapi import APIRouter, Query, HTTPException

from ..services import market_service, chart_patterns
from ..services.market_service import _dp
from ..data.instruments import get_instrument

router = APIRouter(prefix="/api/patterns", tags=["patterns"])

_TF = {"M5", "M15", "M30", "H1", "H4", "D1"}


@router.get("")
async def patterns(symbol: str = Query("EURUSD"), timeframe: str = Query("M15"),
                   count: int = Query(120, ge=60, le=300)):
    symbol = symbol.upper()
    tf = timeframe.upper()
    inst = get_instrument(symbol)
    if not inst:
        raise HTTPException(404, f"Unknown symbol {symbol}")
    if tf not in _TF:
        raise HTTPException(422, f"timeframe must be one of {sorted(_TF)}")
    candles = await market_service.get_candles_live(symbol, tf, count)
    if not candles or len(candles) < 40:
        raise HTTPException(503, "Not enough candle data")
    result = chart_patterns.detect(candles, dp=_dp(symbol))
    return {"symbol": symbol, "timeframe": tf, "decimals": _dp(symbol),
            "asset_class": inst["asset_class"], **result}
