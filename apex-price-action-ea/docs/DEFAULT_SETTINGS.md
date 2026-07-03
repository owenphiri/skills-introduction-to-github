# Suggested Default Settings per Asset Class

These are conservative starting points, shipped as `.set` files in `presets/`.
They are **starting points for your own validation**, not tuned money-printers.
Always layer your firm's preset (`InpPropFirm`) on top.

## Gold (XAUUSD) — `Instrument_Gold_XAUUSD.set`

Gold trends hard but sweeps liquidity violently around London/NY opens.

| Input | Value | Why |
|---|---|---|
| `InpExecutionTF` | M15 | Enough structure, filters M1/M5 noise. |
| `InpRiskPerTradePct` | 0.4 | Slippage on gold stops is real; leave margin. |
| `InpMinConfluence` | 0.65 | Demand extra confirmation in a sweep-heavy symbol. |
| `InpMaxSLVol` | 2.5 | Reject bloated stops during vol spikes. |
| `InpTrailATRMult` | 1.8 | Wider trail — gold retraces deep before continuing. |
| Sessions | 07–11, 13–20 | London + NY; Asia gold is spread-hostile chop. |
| Best strategies | Liquidity Sweep, Trend Pullback, Breakout Retest | |

## Forex majors (EURUSD, GBPUSD, ...) — `Instrument_Forex_Majors.set`

The reference configuration — defaults were designed around majors.

| Input | Value |
|---|---|
| `InpExecutionTF` | M15 |
| `InpRiskPerTradePct` | 0.5 |
| `InpMinConfluence` | 0.62 |
| Sessions | 07–12, 13–20 (broker ≈ server time; verify offset) |
| All five strategies | enabled |

Correlation filter matters most here — keep `InpCorrelationFilter=true` when
running multiple pairs.

## Indices (US30, NAS100, SPX500, GER40, UK100) — `Instrument_Indices_US30_NAS100.set`

Index CFDs gap, re-price at cash opens, and die outside cash hours.

| Input | Value | Why |
|---|---|---|
| `InpExecutionTF` | M5 | Index moves resolve faster. |
| `InpRiskPerTradePct` | 0.4 | Gap risk. |
| `InpMinConfluence` | 0.65 | |
| Sessions | 14–20 broker time only (≈ US cash session; adjust to your broker) | Spreads outside cash hours are punitive. |
| `InpCloseBeforeWeekend` | consider `true` | Weekend gap through a stop can breach a daily limit on its own. |
| Best strategies | Breakout Retest, Compression Break, Trend Pullback | Opening-range dynamics. |
| GER40/UK100 | shift session to 08–16 broker time | European cash hours. |

## Commodities (WTI/Brent, NatGas) — `Instrument_Oil_Commodities.set`

| Input | Value | Why |
|---|---|---|
| `InpExecutionTF` | M15 | |
| `InpRiskPerTradePct` | 0.4 | Inventory-report candles are brutal. |
| Sessions | 13–20 | US pit hours carry the volume. |
| News filter | ON — non-negotiable | EIA Wednesdays / OPEC headlines. |
| NatGas | halve risk again (0.2) or skip | Distribution tails are extreme. |

## Crypto (BTCUSD, ETHUSD) — `Instrument_Crypto_BTC_ETH.set`

| Input | Value | Why |
|---|---|---|
| `InpExecutionTF` | M30 | Filters exchange micro-noise. |
| `InpRiskPerTradePct` | 0.25 | Fat tails; weekend books are thin. |
| `InpMinConfluence` | 0.68 | Highest bar in the suite. |
| `InpUseSessionFilter` | false | 24/7 market. |
| `InpBlockWeekend` | false (but see firm rules) | Many firms *do* restrict weekend crypto — check. |
| `InpMaxSLVol` | 2.0 | Cap stop width in vol explosions. |
| `InpMaxTradesPerDay` | 2 | |
| Best strategies | Liquidity Sweep, Trend Pullback | Crypto's stop-hunt behaviour is textbook. |

## Universal guidance

- **Funded (post-challenge) accounts**: load `Funded_Conservative_AnyFirm.set` —
  0.25% risk, trailing-DD assumption, profit lock 1.5%, 2 trades/day. The goal
  changes from "reach target" to "never give the account back".
- One symbol per chart; 2–4 uncorrelated symbols max per account.
- Re-verify session hours against **your broker's server-time offset** — the
  defaults assume server ≈ UTC+2/+3 (common for FX brokers).
