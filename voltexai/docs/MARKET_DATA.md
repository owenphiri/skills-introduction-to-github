# VoltexAI — Market Data Providers

VoltexAI runs a **layered, fail-open** data stack. Every provider call returns
`None` on any failure (no key, rate-limit, network error, unsupported symbol), so
the app always degrades to the next source and finally the built-in synthetic
feed. Nothing breaks if a key is missing — features light up as keys are added.

## Provider order

**Prices & candles** (`market_service`)

```
Twelve Data  →  Alpha Vantage  →  Finnhub (stocks)  →  Binance (crypto)  →  synthetic
  PRIMARY         FALLBACK          fallback             fallback            always-on
```

- **Twelve Data — primary.** Forex, metals, crypto, indices, stocks; broad
  coverage and 100+ technical indicators. `td_symbol()` maps our catalog to TD
  notation (`XAUUSD → XAU/USD`, `US30 → DJI`).
- **Alpha Vantage — secondary / fallback** for quotes and candles, and the
  **news-sentiment intelligence layer** (see below).
- **Finnhub** — US-stock quote fallback. **Binance** — keyless crypto spot.
- **Synthetic** — deterministic GBM feed so the whole product works with zero
  configuration and tests stay hermetic.

**News & sentiment** (`sentiment_service.news_layer`)

```
Alpha Vantage NEWS_SENTIMENT  →  "unavailable" block (no error)
```

The `/api/sentiment` response now carries a `news` block: the technical Fear &
Greed gauge (from the live/Twelve Data feed) plus Alpha Vantage's aggregated
headline sentiment (average score, label, recent stories). Without a key the
block is `{"available": false, …}` and the page shows a tasteful placeholder.

## Environment variables (set on the server — Render → Environment)

| Var | Purpose | Required |
|---|---|---|
| `MARKET_DATA_PROVIDER` | `auto` (default) uses the chain above; `synthetic` forces the offline feed | no |
| `TWELVEDATA_API_KEY` | Primary prices / candles / indicators | recommended |
| `ALPHAVANTAGE_API_KEY` | Fallback prices + **news & sentiment** | recommended |
| `FINNHUB_API_KEY` | US-stock quote fallback | optional |
| `MARKET_CACHE_TTL` | Quote cache seconds (default 12) | no |

## Security

- **Keys live only on the server.** The browser calls the VoltexAI backend; the
  backend calls the vendors. No API key is ever shipped in frontend JavaScript or
  committed to the repo.
- Respect each vendor's **display / redistribution licensing** for a public,
  client-facing app (Twelve Data business plans distinguish internal use from
  external display).
- **Execution price authority is the broker/MT5 feed**, never Twelve Data or
  Alpha Vantage — these power analysis and signals, not fills.

## Health

`GET /api/markets/status` (via `data_providers.provider_status()` + `probe()`)
reports which key is present and the active primary, and runs a live connectivity
check — without ever echoing the keys.
