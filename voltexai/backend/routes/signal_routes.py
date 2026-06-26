"""
VoltexAI - Algorithmic signal routes (the live scanner)
GET /api/signals/{symbol}        - single algorithmic signal for a symbol/timeframe
GET /api/signals                 - scan a list/class and return ranked signals
GET /api/signals/board/top       - the headline board: best signals right now

These run the deterministic engine (no LLM, no AI quota) so they are public and
cheap, powering the live Signals dashboard and the mobile app. The Claude-narrated
signal stays at POST /api/ai/signal for paid users who want the full write-up.
"""
import logging

from fastapi import APIRouter, Query, HTTPException

from ..services import signal_engine
from ..data.instruments import list_by_class, ALL_SYMBOLS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/signals", tags=["signals"])


@router.get("/board/top")
def top_board(timeframe: str = Query("M15"),
              min_confidence: int = Query(5, ge=0, le=10),
              limit: int = Query(12, ge=1, le=40)):
    signals = signal_engine.scan(ALL_SYMBOLS, timeframe, min_confidence)
    return {"timeframe": timeframe.upper(), "count": len(signals),
            "signals": signals[:limit]}


@router.get("")
def scan(asset_class: str = Query("all"),
         symbols: str = Query(None, description="comma-separated symbols"),
         timeframe: str = Query("M15"),
         min_confidence: int = Query(5, ge=0, le=10)):
    if symbols:
        syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    else:
        syms = [i["symbol"] for i in list_by_class(asset_class)]
    signals = signal_engine.scan(syms, timeframe, min_confidence)
    return {"timeframe": timeframe.upper(), "asset_class": asset_class,
            "count": len(signals), "signals": signals}


@router.get("/{symbol}")
def one(symbol: str, timeframe: str = Query("M15")):
    sig = signal_engine.generate(symbol, timeframe)
    if sig.get("error"):
        raise HTTPException(404, sig["error"])
    return sig
