"""
VoltexAI - Market data routes
GET  /api/markets/instruments            - catalog (optionally by asset class)
GET  /api/markets/quotes                 - live quotes for a comma list or a class
GET  /api/markets/quote/{symbol}         - single live quote
GET  /api/markets/candles/{symbol}       - OHLC candles (timeframe, count)
GET  /api/markets/movers                 - top gainers / losers across the board
WS   /api/markets/stream                 - websocket: pushes quotes every ~2s

These endpoints are public (no auth) so the landing page and marketing surfaces
can show a live ticker without a login.
"""
import asyncio
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, HTTPException

from ..services import market_service as mkt
from ..data.instruments import list_by_class, ALL_SYMBOLS, ASSET_CLASSES

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/markets", tags=["markets"])


@router.get("/instruments")
def instruments(asset_class: str = Query("all")):
    return {
        "asset_classes": ASSET_CLASSES,
        "instruments": [
            {k: v for k, v in i.items() if k != "seed"}
            for i in list_by_class(asset_class)
        ],
    }


@router.get("/quotes")
async def quotes(symbols: str = Query(None, description="comma-separated symbols"),
                 asset_class: str = Query("all")):
    if symbols:
        syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    else:
        syms = [i["symbol"] for i in list_by_class(asset_class)]
    data = await mkt.get_quotes(syms)
    return {"count": len(data), "quotes": data}


@router.get("/quote/{symbol}")
async def quote(symbol: str):
    q = await mkt.get_quote(symbol)
    if not q:
        raise HTTPException(404, f"Unknown instrument: {symbol}")
    return q.as_dict()


@router.get("/candles/{symbol}")
async def candles(symbol: str, timeframe: str = Query("M15"),
                  count: int = Query(200, ge=10, le=500)):
    data = await mkt.get_candles_live(symbol, timeframe, count)
    if not data:
        raise HTTPException(404, f"Unknown instrument: {symbol}")
    return {"symbol": symbol.upper(), "timeframe": timeframe.upper(),
            "count": len(data), "candles": data}


@router.get("/movers")
async def movers(limit: int = Query(6, ge=1, le=20)):
    data = await mkt.get_quotes(ALL_SYMBOLS)
    data.sort(key=lambda q: q["change_pct"], reverse=True)
    return {"gainers": data[:limit], "losers": list(reversed(data[-limit:]))}


@router.websocket("/stream")
async def stream(ws: WebSocket):
    """Push live quotes. Client may send {"symbols": [...]} to filter."""
    await ws.accept()
    symbols = ALL_SYMBOLS[:20]
    try:
        # optional first message selects symbols
        try:
            init = await asyncio.wait_for(ws.receive_json(), timeout=0.5)
            if isinstance(init, dict) and init.get("symbols"):
                symbols = [s.upper() for s in init["symbols"]][:40]
        except (asyncio.TimeoutError, Exception):
            pass

        while True:
            data = await mkt.get_quotes(symbols)
            await ws.send_json({"type": "quotes", "quotes": data})
            await asyncio.sleep(2.0)
    except WebSocketDisconnect:
        return
    except Exception as e:
        logger.info("ws closed: %s", e)
        try:
            await ws.close()
        except Exception:
            pass
