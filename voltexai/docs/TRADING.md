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

| Broker | What it is | Markets | Money | Default |
|---|---|---|---|---|
| `paper` | Built-in simulated broker (DB-backed). Long & short, limit orders, P&L. | All | None — simulated | ✅ |
| `alpaca` | Real [Alpaca](https://alpaca.markets) REST. | US stocks + crypto | Paper or live | opt-in |
| `oanda` | Real [OANDA v20](https://www.oanda.com) REST. | Forex + metals + major indices/energy | Practice or live | opt-in |

```bash
# .env — safe default
BROKER=paper
PAPER_STARTING_BALANCE=100000

# go real (Alpaca, stocks + crypto) — defaults to the PAPER endpoint
BROKER=alpaca
ALPACA_API_KEY=...
ALPACA_API_SECRET=...
ALPACA_BASE_URL=https://paper-api.alpaca.markets   # live: https://api.alpaca.markets

# go real (OANDA, forex + metals) — defaults to the PRACTICE (demo) account
BROKER=oanda
OANDA_API_TOKEN=...
OANDA_ACCOUNT_ID=101-001-xxxxxxx-001
OANDA_ENVIRONMENT=practice                         # live: trades real money
```

### Multi-venue routing (`BROKER=router`)

Run every venue at once and let each order go where it belongs:

```bash
BROKER=router
# OANDA handles forex/metals/indices/energy:
OANDA_API_TOKEN=...
OANDA_ACCOUNT_ID=101-001-xxxxxxx-001
# Alpaca handles stocks/crypto:
ALPACA_API_KEY=...
ALPACA_API_SECRET=...
# anything a configured live venue can't take falls back to the paper broker.
```

Routing table: `forex, metals, indices, energy → OANDA`, `stocks, crypto → Alpaca`,
everything else → paper. If a venue's keys are absent, that class falls back to paper.

`GET /api/trade/broker` returns the live `venue_map`. Aggregated views:
- `/api/trade/account` sums cash/equity/P&L across venues with a per-venue `venues`
  breakdown (an untouched paper book is omitted once a live venue is active).
- `/api/trade/positions` and `/orders` tag every row with its `venue`; order ids are
  namespaced `venue:id` so `/orders/{id}/cancel` routes back to the right venue.

`is_live` is true only if a venue points at a live host — practice/paper venues stay
simulated.

## Verifying the data-vendor key path

After setting `TWELVEDATA_API_KEY` (or `FINNHUB_API_KEY`), confirm it's live:

```bash
curl http://localhost:8000/api/markets/status
# -> { "active_primary": "twelvedata", "twelvedata_key_present": true,
#      "probe": { "ok": true, "source": "twelvedata", "price": 1.0842, "latency_ms": 180 } }
```

`active_primary` and the live `probe` tell you exactly which feed is serving prices.
The startup log prints the same summary on boot.

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
