"""
VoltexAI - Real market-data providers
Thin async clients for live vendors, with symbol mapping from our internal
catalog to each vendor's notation. Every function returns None on any failure
(no key, rate-limited, network error, unsupported symbol) so the caller can fall
back cleanly to the next provider and ultimately the built-in synthetic feed.

Providers:
  * Twelve Data  — forex, metals, crypto, indices, stocks (one key, broad cover)
  * Finnhub      — US stocks (secondary quote source)
  * Binance      — crypto spot (no key required) [used directly in market_service]

Free tiers are rate-limited, so results are cached (see market_service cache) and
the algorithmic scanner intentionally stays on the model feed rather than hammering
these endpoints across the whole universe.
"""
from __future__ import annotations

import logging

import httpx

from ..config import settings
from ..data.instruments import get_instrument

logger = logging.getLogger(__name__)

_TD_BASE = "https://api.twelvedata.com"
_FH_BASE = "https://finnhub.io/api/v1"

# our index symbols -> Twelve Data index notation
_TD_INDEX = {
    "US30": "DJI", "NAS100": "IXIC", "SPX500": "GSPC",
    "GER40": "GDAXI", "UK100": "FTSE", "JP225": "N225",
}
# energy isn't reliably on the free tier — left to fall back to synthetic
_TD_INTERVAL = {
    "M1": "1min", "M5": "5min", "M15": "15min", "M30": "30min",
    "H1": "1h", "H4": "4h", "D1": "1day",
}


def td_symbol(symbol: str) -> str | None:
    """Map an internal symbol to Twelve Data notation, or None if unsupported."""
    inst = get_instrument(symbol)
    if not inst:
        return None
    ac = inst["asset_class"]
    if ac in ("forex", "metals", "crypto"):
        # 6-char pairs -> BASE/QUOTE  (XAUUSD->XAU/USD, BTCUSD->BTC/USD)
        if len(symbol) == 6:
            return f"{symbol[:3]}/{symbol[3:]}"
        return None
    if ac == "stocks":
        return symbol
    if ac == "indices":
        return _TD_INDEX.get(symbol)
    return None


def has_provider() -> bool:
    return bool(settings.TWELVEDATA_API_KEY or settings.FINNHUB_API_KEY)


def provider_status() -> dict:
    """Config snapshot for the /status endpoint — never echoes the actual keys."""
    if settings.MARKET_DATA_PROVIDER == "synthetic":
        active = "synthetic"
    elif settings.TWELVEDATA_API_KEY:
        active = "twelvedata"
    elif settings.FINNHUB_API_KEY:
        active = "finnhub"
    else:
        active = "binance+synthetic"
    return {
        "configured": settings.MARKET_DATA_PROVIDER,
        "active_primary": active,
        "twelvedata_key_present": bool(settings.TWELVEDATA_API_KEY),
        "finnhub_key_present": bool(settings.FINNHUB_API_KEY),
        "cache_ttl_s": settings.MARKET_CACHE_TTL,
    }


async def probe(symbol: str = "EURUSD") -> dict:
    """Live connectivity check against the configured vendor for the /status endpoint."""
    import time as _t
    t0 = _t.perf_counter()
    real = await twelvedata_quote(symbol)
    if real is None and get_instrument(symbol) and \
            get_instrument(symbol)["asset_class"] == "stocks":
        real = await finnhub_quote(symbol)
    latency_ms = round((_t.perf_counter() - t0) * 1000, 1)
    if real:
        return {"ok": True, "symbol": symbol, "source": real["source"],
                "price": real["price"], "latency_ms": latency_ms}
    return {"ok": False, "symbol": symbol, "source": "synthetic-fallback",
            "latency_ms": latency_ms,
            "reason": "no vendor key set or vendor unreachable — using built-in feed"}


async def twelvedata_quote(symbol: str) -> dict | None:
    key = settings.TWELVEDATA_API_KEY
    sym = td_symbol(symbol)
    if not key or not sym:
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{_TD_BASE}/quote",
                                 params={"symbol": sym, "apikey": key})
            r.raise_for_status()
            d = r.json()
            if not isinstance(d, dict) or d.get("status") == "error" or "close" not in d:
                return None
            close = float(d["close"])
            prev = float(d.get("previous_close") or close)
            high = float(d.get("high") or close)
            low = float(d.get("low") or close)
            change = float(d.get("change") or (close - prev))
            pct = float(d.get("percent_change") or 0.0)
            return {"price": close, "prev_close": prev, "high": high, "low": low,
                    "change": change, "change_pct": pct, "source": "twelvedata"}
    except Exception as e:
        logger.debug("twelvedata_quote(%s) failed: %s", symbol, e)
        return None


async def twelvedata_candles(symbol: str, timeframe: str, count: int) -> list[dict] | None:
    key = settings.TWELVEDATA_API_KEY
    sym = td_symbol(symbol)
    interval = _TD_INTERVAL.get(timeframe.upper())
    if not key or not sym or not interval:
        return None
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(f"{_TD_BASE}/time_series", params={
                "symbol": sym, "interval": interval,
                "outputsize": min(count, 500), "apikey": key, "order": "asc",
            })
            r.raise_for_status()
            d = r.json()
            if not isinstance(d, dict) or d.get("status") == "error":
                return None
            vals = d.get("values") or []
            out = []
            for v in vals:
                out.append({
                    "time": _epoch(v.get("datetime")),
                    "open": float(v["open"]), "high": float(v["high"]),
                    "low": float(v["low"]), "close": float(v["close"]),
                    "volume": float(v.get("volume") or 0),
                })
            return out or None
    except Exception as e:
        logger.debug("twelvedata_candles(%s) failed: %s", symbol, e)
        return None


async def finnhub_quote(symbol: str) -> dict | None:
    """US stocks only on the free tier."""
    key = settings.FINNHUB_API_KEY
    inst = get_instrument(symbol)
    if not key or not inst or inst["asset_class"] != "stocks":
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{_FH_BASE}/quote",
                                 params={"symbol": symbol, "token": key})
            r.raise_for_status()
            d = r.json()
            if not d or not d.get("c"):
                return None
            return {"price": float(d["c"]), "prev_close": float(d.get("pc") or d["c"]),
                    "high": float(d.get("h") or d["c"]), "low": float(d.get("l") or d["c"]),
                    "change": float(d.get("d") or 0.0), "change_pct": float(d.get("dp") or 0.0),
                    "source": "finnhub"}
    except Exception as e:
        logger.debug("finnhub_quote(%s) failed: %s", symbol, e)
        return None


def _epoch(dt_str: str | None) -> int:
    import datetime as _dt
    if not dt_str:
        return 0
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return int(_dt.datetime.strptime(dt_str, fmt)
                       .replace(tzinfo=_dt.timezone.utc).timestamp())
        except ValueError:
            continue
    return 0
