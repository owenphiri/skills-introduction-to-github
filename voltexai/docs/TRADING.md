# VoltexAI — Real Data Feed & Trade Execution

## Market data feed

VoltexAI resolves quotes through a provider chain (configured in `backend/config.py`,
overridable via env):

1. **Real vendor** — [Twelve Data](https://twelvedata.com) covers forex, metals,
   crypto, indices and stocks with a single key. [Finnhub](https://finnhub.io) is a
   secondary source for US stocks.
2. **Binance** public API for live crypto spot prices (no key needed).
3. **Built-in synthetic feed** — a reproducible model feed so the app is never blank.

```bash
# .env
MARKET_DATA_PROVIDER=auto          # auto | twelvedata | finnhub | synthetic
TWELVEDATA_API_KEY=your_key        # leave blank to stay on the simulated feed
FINNHUB_API_KEY=
MARKET_CACHE_TTL=12                # seconds; protects free-tier rate limits
```

Quotes are cached per `MARKET_CACHE_TTL`. The algorithmic **signal scanner stays on
the model feed** by design — scanning 35 instruments on every refresh would exhaust
free-tier vendor limits. Charts and the live markets board use the real vendor when a
key is present (`GET /api/markets/candles/{symbol}`).

> Symbol coverage: forex `EURUSD→EUR/USD`, metals `XAUUSD→XAU/USD`, crypto
> `BTCUSD→BTC/USD`, indices mapped (`US30→DJI`, `NAS100→IXIC`, …), stocks as-is.
> Energy and any unmapped symbol fall back to the model feed.

## Trade execution

Two interchangeable brokers behind one API (`/api/trade/*`):

| Broker | What it is | Money | Default |
|---|---|---|---|
| `paper` | Built-in simulated broker (DB-backed). Fills market orders at the live/model quote; supports **long & short**, limit orders, P&L. | None — simulated | ✅ |
| `alpaca` | Real [Alpaca](https://alpaca.markets) REST (US stocks + crypto). | Paper or live | opt-in |

```bash
# .env — safe default
BROKER=paper
PAPER_STARTING_BALANCE=100000

# go real (Alpaca) — defaults to the PAPER endpoint
BROKER=alpaca
ALPACA_API_KEY=...
ALPACA_API_SECRET=...
ALPACA_BASE_URL=https://paper-api.alpaca.markets   # live: https://api.alpaca.markets
```

The system **never silently trades live money**: Alpaca defaults to the paper
endpoint, and the UI shows a red `● LIVE BROKER` badge only when pointed at the live
host. Placing/closing orders requires a paid plan (Trader/Elite); free users can view
but not transact.

### Endpoints
```
GET  /api/trade/broker                 active broker + is_live flag
GET  /api/trade/account                cash, equity, realized/unrealized P&L, return
GET  /api/trade/positions              open positions w/ live unrealized P&L
GET  /api/trade/orders                 order history + resting limit orders
POST /api/trade/orders                 { symbol, side, qty, type, limit_price? }
POST /api/trade/orders/{id}/cancel     cancel a resting limit order
```

### Paper engine accounting
- Signed position quantity: `+` long, `-` short.
- Net liquidation (equity) = `cash + Σ(qty × current_price)` — correct for longs & shorts.
- Realized P&L booked when a fill reduces/closes/flips a position.
- Risk caps: buys can't exceed buying power; naked short notional is capped at the
  starting balance.

> Disclaimer: paper trading is educational simulation. Live trading via Alpaca routes
> real orders and risks real capital. VoltexAI provides technology and educational
> analysis, not investment advice.
