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
_AV_BASE = "https://www.alphavantage.co/query"

# internal timeframe -> Alpha Vantage intraday interval (H4/D1 use the daily series)
_AV_INTERVAL = {"M1": "1min", "M5": "5min", "M15": "15min", "M30": "30min", "H1": "60min"}

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
    return bool(settings.TWELVEDATA_API_KEY or settings.FINNHUB_API_KEY
                or settings.ALPHAVANTAGE_API_KEY)


# ---- OANDA instrument mapping (forex + metals price streaming) ----
def to_oanda_instrument(symbol: str) -> str | None:
    """Internal forex/metals symbol -> OANDA instrument (EURUSD -> EUR_USD)."""
    inst = get_instrument(symbol)
    if not inst or inst["asset_class"] not in ("forex", "metals") or len(symbol) != 6:
        return None
    return f"{symbol[:3]}_{symbol[3:]}"


def from_oanda_instrument(instrument: str) -> str:
    return instrument.replace("_", "")


def oanda_streamable_symbols() -> list[str]:
    """All catalog forex + metals symbols that OANDA can stream."""
    from ..data.instruments import ALL_SYMBOLS
    return [s for s in ALL_SYMBOLS if to_oanda_instrument(s)]


def provider_status() -> dict:
    """Config snapshot for the /status endpoint — never echoes the actual keys."""
    if settings.MARKET_DATA_PROVIDER == "synthetic":
        active = "synthetic"
    elif settings.TWELVEDATA_API_KEY:
        active = "twelvedata"
    elif settings.ALPHAVANTAGE_API_KEY:
        active = "alphavantage"
    elif settings.FINNHUB_API_KEY:
        active = "finnhub"
    else:
        active = "binance+synthetic"
    return {
        "configured": settings.MARKET_DATA_PROVIDER,
        "active_primary": active,
        "twelvedata_key_present": bool(settings.TWELVEDATA_API_KEY),
        "finnhub_key_present": bool(settings.FINNHUB_API_KEY),
        "alphavantage_key_present": bool(settings.ALPHAVANTAGE_API_KEY),
        "cache_ttl_s": settings.MARKET_CACHE_TTL,
    }


async def probe(symbol: str = "EURUSD") -> dict:
    """Live connectivity check against the configured vendor for the /status endpoint."""
    import time as _t
    t0 = _t.perf_counter()
    real = await twelvedata_quote(symbol)
    if real is None:
        real = await alphavantage_quote(symbol)
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


# ---- Alpha Vantage (forex, metals, crypto, stocks) ----
def _av_pair(symbol: str) -> tuple[str, str] | None:
    """6-char pair -> (from, to). EURUSD->(EUR,USD), BTCUSD->(BTC,USD)."""
    if len(symbol) == 6:
        return symbol[:3], symbol[3:]
    return None


async def _av_get(params: dict) -> dict | None:
    key = settings.ALPHAVANTAGE_API_KEY
    if not key:
        return None
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(_AV_BASE, params={**params, "apikey": key})
            r.raise_for_status()
            d = r.json()
            # rate-limit / info payloads have no data keys -> treat as miss
            if not isinstance(d, dict) or "Note" in d or "Information" in d or "Error Message" in d:
                return None
            return d
    except Exception as e:
        logger.debug("alphavantage %s failed: %s", params.get("function"), e)
        return None


async def alphavantage_quote(symbol: str) -> dict | None:
    inst = get_instrument(symbol)
    if not inst or not settings.ALPHAVANTAGE_API_KEY:
        return None
    ac = inst["asset_class"]
    if ac == "stocks":
        d = await _av_get({"function": "GLOBAL_QUOTE", "symbol": symbol})
        q = (d or {}).get("Global Quote") or {}
        if not q.get("05. price"):
            return None
        price = float(q["05. price"])
        prev = float(q.get("08. previous close") or price)
        return {"price": price, "prev_close": prev,
                "high": float(q.get("03. high") or price),
                "low": float(q.get("04. low") or price),
                "change": float(q.get("09. change") or (price - prev)),
                "change_pct": float((q.get("10. change percent") or "0").rstrip("%")),
                "source": "alphavantage"}
    if ac in ("forex", "metals", "crypto"):
        pair = _av_pair(symbol)
        if not pair:
            return None
        d = await _av_get({"function": "CURRENCY_EXCHANGE_RATE",
                           "from_currency": pair[0], "to_currency": pair[1]})
        rate = (d or {}).get("Realtime Currency Exchange Rate") or {}
        px = rate.get("5. Exchange Rate")
        if not px:
            return None
        price = float(px)
        # CURRENCY_EXCHANGE_RATE has no OHLC/prev; report a flat quote (real price).
        return {"price": price, "prev_close": price, "high": price, "low": price,
                "change": 0.0, "change_pct": 0.0, "source": "alphavantage"}
    return None


async def alphavantage_candles(symbol: str, timeframe: str, count: int) -> list[dict] | None:
    inst = get_instrument(symbol)
    if not inst or not settings.ALPHAVANTAGE_API_KEY:
        return None
    ac = inst["asset_class"]
    tf = timeframe.upper()
    interval = _AV_INTERVAL.get(tf)

    if ac == "stocks":
        if interval:
            d = await _av_get({"function": "TIME_SERIES_INTRADAY", "symbol": symbol,
                               "interval": interval, "outputsize": "compact"})
            series = (d or {}).get(f"Time Series ({interval})")
        else:
            d = await _av_get({"function": "TIME_SERIES_DAILY", "symbol": symbol,
                               "outputsize": "compact"})
            series = (d or {}).get("Time Series (Daily)")
        return _av_series(series, count)

    if ac in ("forex", "metals"):
        pair = _av_pair(symbol)
        if not pair:
            return None
        if interval:
            d = await _av_get({"function": "FX_INTRADAY", "from_symbol": pair[0],
                               "to_symbol": pair[1], "interval": interval, "outputsize": "compact"})
            series = (d or {}).get(f"Time Series FX ({interval})")
        else:
            d = await _av_get({"function": "FX_DAILY", "from_symbol": pair[0],
                               "to_symbol": pair[1], "outputsize": "compact"})
            series = (d or {}).get("Time Series FX (Daily)")
        return _av_series(series, count)

    return None


def _av_series(series: dict | None, count: int) -> list[dict] | None:
    if not series:
        return None
    out = []
    for ts, v in series.items():
        try:
            out.append({"time": _epoch(ts),
                        "open": float(v["1. open"]), "high": float(v["2. high"]),
                        "low": float(v["3. low"]), "close": float(v["4. close"]),
                        "volume": float(v.get("5. volume") or 0)})
        except (KeyError, ValueError):
            continue
    out.sort(key=lambda x: x["time"])
    return out[-count:] if out else None


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
