"""
VoltexAI - Market data service
Provides live-style quotes and OHLC candles for every instrument in the catalog.

Design goals:
  * Works with ZERO external configuration (synthetic feed) so the whole product
    is demoable and the UI is never blank.
  * Optionally upgrades to a real feed when one is available: crypto quotes are
    pulled from Binance's public REST endpoint (no API key required) and cached.
  * Deterministic-but-evolving: each symbol follows a seeded random walk with
    intraday seasonality and class-appropriate volatility, so charts look real
    and signals computed on them are meaningful.

The synthetic generator is a geometric Brownian motion anchored to the catalog
seed price, advanced by wall-clock time. Because it is a pure function of
(symbol, timestamp), every client sees the same price at the same moment and
candles are reproducible.
"""
from __future__ import annotations

import hashlib
import math
import time
from dataclasses import dataclass

import httpx

from ..config import settings
from ..data.instruments import INSTRUMENTS, get_instrument
from . import data_providers

# timeframe -> seconds per candle
TIMEFRAMES = {
    "M1": 60, "M5": 300, "M15": 900, "M30": 1800,
    "H1": 3600, "H4": 14400, "D1": 86400,
}

# Binance symbol mapping for the live crypto upgrade path
_BINANCE = {
    "BTCUSD": "BTCUSDT", "ETHUSD": "ETHUSDT", "SOLUSD": "SOLUSDT",
    "BNBUSD": "BNBUSDT", "XRPUSD": "XRPUSDT",
}

_live_cache: dict[str, tuple[float, float]] = {}   # symbol -> (price, fetched_at)
_LIVE_TTL = 15.0   # seconds


def _seed_hash(symbol: str) -> float:
    """Stable per-symbol seed in [0, 1)."""
    h = hashlib.sha256(symbol.encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def _noise(symbol: str, t: float) -> float:
    """Smooth pseudo-random walk in [-1, 1] from layered sines (no global state)."""
    s = _seed_hash(symbol)
    # three octaves of incommensurate frequencies give an organic, non-repeating wiggle
    a = math.sin(t / 900.0 + s * 6.283)            # ~15 min swing
    b = math.sin(t / 180.0 + s * 12.566) * 0.5     # ~3 min chop
    c = math.sin(t / 3600.0 + s * 3.141) * 0.8     # ~1 hr trend
    d = math.sin(t / 21600.0 + s * 1.5) * 1.2      # ~6 hr macro drift
    return max(-1.0, min(1.0, (a + b + c + d) / 3.5))


def _session_factor(t: float) -> float:
    """Volatility seasonality: London + NY overlap is hottest, Asia quietest."""
    hour = (t / 3600.0) % 24.0   # UTC hour
    # peak around 13:00-16:00 UTC (London/NY overlap)
    overlap = math.exp(-((hour - 14.5) ** 2) / 18.0)
    london = math.exp(-((hour - 9.0) ** 2) / 14.0) * 0.7
    asia = math.exp(-((hour - 1.0) ** 2) / 20.0) * 0.4
    return 0.4 + overlap + london + asia


@dataclass
class Quote:
    symbol: str
    display: str
    asset_class: str
    price: float
    bid: float
    ask: float
    change: float
    change_pct: float
    day_high: float
    day_low: float
    spread: float
    updated_at: float
    source: str

    def as_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "display": self.display,
            "asset_class": self.asset_class,
            "price": round(self.price, _dp(self.symbol)),
            "bid": round(self.bid, _dp(self.symbol)),
            "ask": round(self.ask, _dp(self.symbol)),
            "change": round(self.change, _dp(self.symbol)),
            "change_pct": round(self.change_pct, 2),
            "day_high": round(self.day_high, _dp(self.symbol)),
            "day_low": round(self.day_low, _dp(self.symbol)),
            "spread": round(self.spread, _dp(self.symbol)),
            "updated_at": self.updated_at,
            "source": self.source,
        }


def _dp(symbol: str) -> int:
    """Decimal places to render based on pip size."""
    inst = get_instrument(symbol)
    pip = inst["pip_size"] if inst else 0.0001
    if pip >= 1:
        return 2
    return max(2, len(str(pip).split(".")[-1]) + 1)


def _synthetic_price(symbol: str, t: float) -> float:
    inst = INSTRUMENTS[symbol]
    seed = inst["seed"]
    vol = inst["daily_vol_pct"] / 100.0
    drift = _noise(symbol, t) * vol * _session_factor(t)
    # gentle long-cycle bias so prices wander rather than mean-revert hard
    bias = math.sin(t / 172800.0 + _seed_hash(symbol) * 6.28) * vol * 0.6
    return seed * (1.0 + drift + bias)


async def _live_crypto_price(symbol: str) -> float | None:
    """Best-effort live crypto price from Binance public API. None on any failure."""
    pair = _BINANCE.get(symbol)
    if not pair:
        return None
    now = time.time()
    cached = _live_cache.get(symbol)
    if cached and now - cached[1] < _LIVE_TTL:
        return cached[0]
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.get(
                "https://api.binance.com/api/v3/ticker/price",
                params={"symbol": pair},
            )
            r.raise_for_status()
            price = float(r.json()["price"])
            _live_cache[symbol] = (price, now)
            return price
    except Exception:
        return None


_quote_cache: dict[str, tuple["Quote", float]] = {}   # symbol -> (quote, cached_at)


def _make_quote(symbol: str, inst: dict, price: float, prev: float,
                day_high: float, day_low: float, source: str) -> "Quote":
    change = price - prev
    change_pct = (change / prev) * 100.0 if prev else 0.0
    pip = inst["pip_size"]
    spread = pip * (2 if inst["asset_class"] in ("forex", "metals") else 6)
    half = spread / 2.0
    return Quote(
        symbol=symbol, display=inst["display"], asset_class=inst["asset_class"],
        price=price, bid=price - half, ask=price + half,
        change=change, change_pct=change_pct,
        day_high=max(day_high, price), day_low=min(day_low, price),
        spread=spread, updated_at=time.time(), source=source,
    )


async def _fetch_quote(symbol: str, inst: dict) -> "Quote":
    """Provider chain: real vendor -> Binance (crypto) -> synthetic fallback."""
    t = time.time()
    provider = settings.MARKET_DATA_PROVIDER

    # 1) real vendor (Twelve Data covers FX/metals/crypto/indices/stocks; Finnhub stocks)
    if provider != "synthetic":
        real = await data_providers.twelvedata_quote(symbol)
        if real is None and inst["asset_class"] == "stocks":
            real = await data_providers.finnhub_quote(symbol)
        if real:
            return _make_quote(symbol, inst, real["price"], real["prev_close"],
                               real["high"], real["low"], real["source"])

    # 2) live crypto via Binance (no key needed)
    if provider != "synthetic":
        price = await _live_crypto_price(symbol)
        if price is not None:
            ratio = price / _synthetic_price(symbol, t)
            prev = _synthetic_price(symbol, t - 86400) * ratio
            samples = [_synthetic_price(symbol, t - i * 3600) * ratio for i in range(24)]
            return _make_quote(symbol, inst, price, prev,
                               max(samples), min(samples), "binance")

    # 3) built-in synthetic feed (always works, zero config)
    price = _synthetic_price(symbol, t)
    prev = _synthetic_price(symbol, t - 86400)
    samples = [_synthetic_price(symbol, t - i * 3600) for i in range(24)]
    return _make_quote(symbol, inst, price, prev, max(samples), min(samples), "synthetic")


async def get_quote(symbol: str) -> Quote | None:
    symbol = symbol.upper()
    inst = get_instrument(symbol)
    if not inst:
        return None
    cached = _quote_cache.get(symbol)
    if cached and time.time() - cached[1] < settings.MARKET_CACHE_TTL:
        return cached[0]
    q = await _fetch_quote(symbol, inst)
    _quote_cache[symbol] = (q, time.time())
    return q


async def get_quotes(symbols: list[str]) -> list[dict]:
    out = []
    for s in symbols:
        q = await get_quote(s)
        if q:
            out.append(q.as_dict())
    return out


def get_candles(symbol: str, timeframe: str = "M15", count: int = 200) -> list[dict]:
    """Reproducible OHLC candles built from the synthetic curve."""
    symbol = symbol.upper()
    inst = get_instrument(symbol)
    if not inst:
        return []
    step = TIMEFRAMES.get(timeframe.upper(), 900)
    now = time.time()
    # align to candle boundary
    last_open = (int(now) // step) * step
    candles = []
    sub = 6   # intra-candle samples for hi/lo
    for i in range(count - 1, -1, -1):
        c_open_t = last_open - i * step
        prices = [_synthetic_price(symbol, c_open_t + (j * step / sub))
                  for j in range(sub + 1)]
        o, c = prices[0], prices[-1]
        candles.append({
            "time": int(c_open_t),
            "open": round(o, _dp(symbol)),
            "high": round(max(prices), _dp(symbol)),
            "low": round(min(prices), _dp(symbol)),
            "close": round(c, _dp(symbol)),
            "volume": round(1000 * _session_factor(c_open_t) *
                            (1 + abs(_noise(symbol, c_open_t))), 1),
        })
    return candles


def closes(symbol: str, timeframe: str = "M15", count: int = 200) -> list[float]:
    return [c["close"] for c in get_candles(symbol, timeframe, count)]


async def get_candles_live(symbol: str, timeframe: str = "M15",
                           count: int = 200) -> list[dict]:
    """Real vendor candles when configured, else the reproducible synthetic set."""
    symbol = symbol.upper()
    if not get_instrument(symbol):
        return []
    if settings.MARKET_DATA_PROVIDER != "synthetic":
        real = await data_providers.twelvedata_candles(symbol, timeframe, count)
        if real:
            return real
    return get_candles(symbol, timeframe, count)


async def get_price(symbol: str) -> float | None:
    """Single mid price — used by the execution engine to fill orders."""
    q = await get_quote(symbol)
    return q.price if q else None

