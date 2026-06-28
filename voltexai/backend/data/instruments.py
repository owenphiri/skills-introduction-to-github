"""
VoltexAI - Instrument catalog
The universe of markets VoltexAI tracks: forex majors/minors, metals, energies,
indices, crypto and a set of liquid US equities. Each instrument carries the
metadata the market + signal services need (asset class, pip size, a seed price
used by the simulated feed, and typical session volatility).

`seed` is only a starting reference for the synthetic feed and for bootstrapping
candles when a live provider is not configured. When a live provider IS wired in,
the live quote overrides the seed entirely.
"""
from __future__ import annotations

# asset_class | symbol | display | base/quote | pip_size | seed price | daily vol %
_RAW = [
    # ---- Forex majors ----
    ("forex", "EURUSD", "Euro / US Dollar",        0.0001, 1.0840, 0.55),
    ("forex", "GBPUSD", "Pound / US Dollar",       0.0001, 1.2710, 0.65),
    ("forex", "USDJPY", "US Dollar / Yen",         0.01,   157.30, 0.60),
    ("forex", "USDCHF", "US Dollar / Swiss Franc", 0.0001, 0.8950, 0.50),
    ("forex", "AUDUSD", "Aussie / US Dollar",      0.0001, 0.6630, 0.70),
    ("forex", "USDCAD", "US Dollar / Loonie",      0.0001, 1.3680, 0.50),
    ("forex", "NZDUSD", "Kiwi / US Dollar",        0.0001, 0.6120, 0.72),
    # ---- Forex crosses / minors ----
    ("forex", "EURGBP", "Euro / Pound",            0.0001, 0.8530, 0.45),
    ("forex", "EURJPY", "Euro / Yen",              0.01,   170.50, 0.70),
    ("forex", "GBPJPY", "Pound / Yen",             0.01,   199.80, 0.90),
    ("forex", "AUDJPY", "Aussie / Yen",            0.01,   104.20, 0.85),
    # ---- African / EM pairs (home-market relevance) ----
    ("forex", "USDZAR", "US Dollar / Rand",        0.0001, 18.250, 1.10),
    ("forex", "USDNGN", "US Dollar / Naira",       0.01,   1535.0, 1.40),
    ("forex", "USDKES", "US Dollar / Sh. Kenya",   0.01,   129.50, 0.80),
    # ---- Metals ----
    ("metals", "XAUUSD", "Gold / US Dollar",       0.01,   2335.0, 1.05),
    ("metals", "XAGUSD", "Silver / US Dollar",     0.001,  29.40, 1.80),
    # ---- Energy ----
    ("energy", "WTIUSD", "WTI Crude Oil",          0.01,   79.40, 1.90),
    ("energy", "XBRUSD", "Brent Crude Oil",        0.01,   83.10, 1.80),
    # ---- Indices ----
    ("indices", "US30",   "Dow Jones 30",          1.0,    39250.0, 0.85),
    ("indices", "NAS100", "Nasdaq 100",            0.25,   19650.0, 1.20),
    ("indices", "SPX500", "S&P 500",               0.25,   5460.0, 0.95),
    ("indices", "GER40",  "DAX 40",                0.5,    18350.0, 1.00),
    ("indices", "UK100",  "FTSE 100",              0.5,    8180.0, 0.70),
    ("indices", "JP225",  "Nikkei 225",            1.0,    38900.0, 1.10),
    # ---- Crypto ----
    ("crypto", "BTCUSD", "Bitcoin / US Dollar",    0.1,    67500.0, 3.20),
    ("crypto", "ETHUSD", "Ethereum / US Dollar",   0.01,   3520.0, 3.80),
    ("crypto", "SOLUSD", "Solana / US Dollar",     0.01,   168.50, 5.40),
    ("crypto", "BNBUSD", "BNB / US Dollar",        0.01,   605.0, 4.10),
    ("crypto", "XRPUSD", "XRP / US Dollar",        0.0001, 0.5210, 4.60),
    # ---- US equities ----
    ("stocks", "AAPL", "Apple Inc.",               0.01,   214.20, 1.40),
    ("stocks", "MSFT", "Microsoft Corp.",          0.01,   449.50, 1.30),
    ("stocks", "NVDA", "NVIDIA Corp.",             0.01,   126.40, 3.10),
    ("stocks", "TSLA", "Tesla Inc.",               0.01,   183.00, 3.60),
    ("stocks", "AMZN", "Amazon.com Inc.",          0.01,   189.10, 1.70),
    ("stocks", "META", "Meta Platforms",           0.01,   505.20, 2.00),
]

ASSET_CLASSES = ["forex", "metals", "energy", "indices", "crypto", "stocks"]

INSTRUMENTS: dict[str, dict] = {}
for asset_class, symbol, display, pip, seed, vol in _RAW:
    INSTRUMENTS[symbol] = {
        "symbol": symbol,
        "display": display,
        "asset_class": asset_class,
        "pip_size": pip,
        "seed": seed,
        "daily_vol_pct": vol,
        # mid-cap crypto / equities quote in USD, FX quotes are price-as-is
        "quote_ccy": "USD",
    }

ALL_SYMBOLS = list(INSTRUMENTS.keys())


def get_instrument(symbol: str) -> dict | None:
    return INSTRUMENTS.get(symbol.upper())


def list_by_class(asset_class: str | None = None) -> list[dict]:
    if not asset_class or asset_class == "all":
        return list(INSTRUMENTS.values())
    return [i for i in INSTRUMENTS.values() if i["asset_class"] == asset_class]
