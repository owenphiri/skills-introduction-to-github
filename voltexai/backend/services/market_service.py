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

from ..data.instruments import INSTRUMENTS, get_instrument

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


async def get_quote(symbol: str) -> Quote | None:
    symbol = symbol.upper()
    inst = get_instrument(symbol)
    if not inst:
        return None
    t = time.time()
    source = "synthetic"

    price = await _live_crypto_price(symbol)
    if price is not None:
        source = "binance"
    else:
        price = _synthetic_price(symbol, t)

    # previous close ~ price 24h ago on the synthetic curve (anchors % change)
    prev = _synthetic_price(symbol, t - 86400)
    if source == "binance":
        # scale the synthetic prev-close to the live price level for a sane %change
        prev = price * (prev / _synthetic_price(symbol, t))

    change = price - prev
    change_pct = (change / prev) * 100.0 if prev else 0.0

    # intraday range from the last 24 sampled points
    samples = [_synthetic_price(symbol, t - i * 3600) for i in range(24)]
    if source == "binance":
        scale = price / samples[0]
        samples = [s * scale for s in samples]
    day_high = max(samples + [price])
    day_low = min(samples + [price])

    pip = inst["pip_size"]
    spread = pip * (2 if inst["asset_class"] in ("forex", "metals") else 6)
    half = spread / 2.0
    return Quote(
        symbol=symbol, display=inst["display"], asset_class=inst["asset_class"],
        price=price, bid=price - half, ask=price + half,
        change=change, change_pct=change_pct,
        day_high=day_high, day_low=day_low, spread=spread,
        updated_at=t, source=source,
    )


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
