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

ASSET_CLASSES = ["forex", "metals", "energy", "indices", "crypto", "stocks",
                 "synthetics", "futures"]

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
        "always_on": False,
        "venue": "cfd",
        "deriv_symbol": None,
    }

# ---- Deriv synthetic indices (trade 24/7/365) ----
# deriv_symbol is the code the Deriv API uses, so the auto-executor can route an
# order to Deriv directly. Seeds/vol are references for the synthetic feed.
_SYNTHETICS = [
    # symbol,    display,                   pip,    seed,     vol%, deriv_symbol
    ("V10",      "Volatility 10 Index",     0.001,  6500.0,   1.10, "R_10"),
    ("V25",      "Volatility 25 Index",     0.001,  2600.0,   2.60, "R_25"),
    ("V50",      "Volatility 50 Index",     0.0001, 245.0,    4.90, "R_50"),
    ("V75",      "Volatility 75 Index",     0.0001, 39500.0,  7.30, "R_75"),
    ("V100",     "Volatility 100 Index",    0.01,   1560.0,   9.60, "R_100"),
    ("BOOM500",  "Boom 500 Index",          0.0001, 9200.0,   2.20, "BOOM500"),
    ("BOOM1000", "Boom 1000 Index",         0.001,  11500.0,  1.80, "BOOM1000"),
    ("CRASH500", "Crash 500 Index",         0.0001, 8700.0,   2.20, "CRASH500"),
    ("CRASH1000","Crash 1000 Index",        0.001,  10200.0,  1.80, "CRASH1000"),
    ("STEPIDX",  "Step Index",              0.1,    9300.0,   1.20, "stpRNG"),
    ("JUMP75",   "Jump 75 Index",           0.0001, 22800.0,  6.10, "JD75"),
    ("JUMP100",  "Jump 100 Index",          0.01,   19100.0,  8.40, "JD100"),
]
for symbol, display, pip, seed, vol, deriv in _SYNTHETICS:
    INSTRUMENTS[symbol] = {
        "symbol": symbol, "display": display, "asset_class": "synthetics",
        "pip_size": pip, "seed": seed, "daily_vol_pct": vol, "quote_ccy": "USD",
        "always_on": True, "venue": "deriv", "deriv_symbol": deriv,
    }

# ---- Futures (CME / ICE style) ----
_FUTURES = [
    # symbol,  display,                     pip,   seed,     vol%
    ("ES",     "S&P 500 E-mini",            0.25,  5460.0,   0.95),
    ("NQ",     "Nasdaq 100 E-mini",         0.25,  19650.0,  1.25),
    ("YM",     "Dow E-mini",                1.0,   39250.0,  0.85),
    ("GC",     "Gold Futures",              0.1,   2338.0,   1.05),
    ("SI",     "Silver Futures",            0.005, 29.45,    1.85),
    ("CL",     "Crude Oil Futures (WTI)",   0.01,  79.50,    1.95),
    ("NG",     "Natural Gas Futures",       0.001, 2.75,     3.10),
    ("6E",     "Euro FX Futures",           0.0001, 1.0845,  0.55),
]
for symbol, display, pip, seed, vol in _FUTURES:
    INSTRUMENTS[symbol] = {
        "symbol": symbol, "display": display, "asset_class": "futures",
        "pip_size": pip, "seed": seed, "daily_vol_pct": vol, "quote_ccy": "USD",
        "always_on": False, "venue": "futures", "deriv_symbol": None,
    }

ALL_SYMBOLS = list(INSTRUMENTS.keys())


def get_instrument(symbol: str) -> dict | None:
    return INSTRUMENTS.get(symbol.upper())


def list_by_class(asset_class: str | None = None) -> list[dict]:
    if not asset_class or asset_class == "all":
        return list(INSTRUMENTS.values())
    return [i for i in INSTRUMENTS.values() if i["asset_class"] == asset_class]
