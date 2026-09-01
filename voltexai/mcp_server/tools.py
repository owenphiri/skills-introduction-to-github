"""
Phase 0 tool logic — pure, dependency-free, unit-testable.

Each function returns plain JSON-able data and never raises for bad input (it
returns an {"error": ...} dict instead), so the MCP wrapper in server.py can stay
a thin binding. These reuse VoltexAI's own market_service, so the MCP server and
the app always agree on prices.
"""
from __future__ import annotations

from backend.services import market_service
from backend.data import instruments

VALID_TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"]
MAX_SYMBOLS = 25          # cap batch quote requests
MAX_CANDLES = 500


async def list_symbols(asset_class: str = "all") -> dict:
    """Symbol catalog, optionally filtered by asset class."""
    ac = (asset_class or "all").lower()
    if ac != "all" and ac not in instruments.ASSET_CLASSES:
        return {"error": f"Unknown asset_class '{asset_class}'.",
                "asset_classes": instruments.ASSET_CLASSES}
    items = instruments.list_by_class(ac)
    return {
        "asset_class": ac,
        "asset_classes": instruments.ASSET_CLASSES,
        "count": len(items),
        "symbols": [{"symbol": i["symbol"], "display": i["display"],
                     "asset_class": i["asset_class"]} for i in items],
    }


async def get_quote(symbol: str) -> dict:
    """Latest quote for one symbol (live provider when configured, else the
    high-fidelity synthetic feed)."""
    sym = (symbol or "").upper()
    if not instruments.get_instrument(sym):
        return {"error": f"Unknown symbol '{symbol}'. Try list_symbols."}
    quotes = await market_service.get_quotes([sym])
    return quotes[0] if quotes else {"error": f"No quote available for '{sym}'."}


async def get_quotes(symbols: list[str]) -> dict:
    """Latest quotes for up to 25 symbols at once."""
    if not symbols:
        return {"error": "Provide at least one symbol."}
    syms, unknown = [], []
    for s in symbols[:MAX_SYMBOLS]:
        u = (s or "").upper()
        (syms if instruments.get_instrument(u) else unknown).append(u)
    quotes = await market_service.get_quotes(syms) if syms else []
    out = {"count": len(quotes), "quotes": quotes}
    if unknown:
        out["unknown"] = unknown
    return out


async def get_candles(symbol: str, timeframe: str = "M15", count: int = 200) -> dict:
    """OHLC candles for a symbol/timeframe (max 500)."""
    sym = (symbol or "").upper()
    if not instruments.get_instrument(sym):
        return {"error": f"Unknown symbol '{symbol}'. Try list_symbols."}
    tf = (timeframe or "M15").upper()
    if tf not in VALID_TIMEFRAMES:
        return {"error": f"Invalid timeframe '{timeframe}'.",
                "valid_timeframes": VALID_TIMEFRAMES}
    try:
        n = max(1, min(int(count), MAX_CANDLES))
    except (TypeError, ValueError):
        n = 200
    candles = market_service.get_candles(sym, tf, n)
    return {"symbol": sym, "timeframe": tf, "count": len(candles), "candles": candles}
