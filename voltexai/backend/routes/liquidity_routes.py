"""
VoltexAI - ICT liquidity routes (news-aware smart-money mapping)

GET /api/liquidity/map/{symbol}       - liquidity pools + premium/discount (public)
GET /api/liquidity/assess/{symbol}    - full news-aware assessment (public)
GET /api/liquidity/news               - pre-news liquidity board across the hot list

Educational / analytical only — structured ICT reading, not financial advice and
not a profit guarantee (CFTC Rule 4.41).
"""
from fastapi import APIRouter, Query, HTTPException

from ..services import liquidity, liquidity_backtest

router = APIRouter(prefix="/api/liquidity", tags=["liquidity"])


@router.get("/map/{symbol}")
def liquidity_map(symbol: str, timeframe: str = Query("M15")):
    m = liquidity.liquidity_map(symbol, timeframe)
    if m.get("error"):
        raise HTTPException(404, m["error"])
    return m


@router.get("/assess/{symbol}")
def assess(symbol: str, timeframe: str = Query("M15"),
           direction: str = Query(None, pattern="^(LONG|SHORT)$")):
    a = liquidity.assess(symbol, timeframe, direction)
    if a.get("error"):
        raise HTTPException(404, a["error"])
    return a


@router.get("/news")
def news_board(timeframe: str = Query("M15")):
    return liquidity.news_liquidity(timeframe=timeframe)


@router.get("/backtest/{symbol}")
def backtest(symbol: str, timeframe: str = Query("M15"),
             bars: int = Query(700, ge=300, le=2000),
             horizon: int = Query(24, ge=4, le=120),
             rr: float = Query(2.0, gt=0, le=5)):
    r = liquidity_backtest.backtest(symbol, timeframe, bars=bars, horizon=horizon, rr=rr)
    if r.get("error"):
        raise HTTPException(404, r["error"])
    return r


@router.get("/backtest")
def backtest_board(timeframe: str = Query("M15"),
                   bars: int = Query(700, ge=300, le=2000)):
    return liquidity_backtest.backtest_many(timeframe=timeframe, bars=bars)
