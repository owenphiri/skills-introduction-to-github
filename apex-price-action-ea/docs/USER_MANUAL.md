# User Manual

## Operating philosophy

ApexPA is built to **survive first and profit second**. It will frequently do
nothing — that is by design. A prop evaluation is lost by drawdown, not by missed
trades. Expect low trade frequency (roughly 0–3 trades/day per symbol with default
settings), and interpret every dashboard number as a measurement, not a promise.

---

## Inputs reference

### General
| Input | Default | Notes |
|---|---|---|
| `InpMagic` | 86452301 | Unique per EA instance if your firm audits magics. |
| `InpExecutionTF` | M15 | Signal timeframe. HTF context auto-selected above it. |
| `InpShowDashboard` | true | Auto-disabled during optimisation. |
| `InpCsvLogging` | true | Exports to `MQL5/Files/ApexPA/`. |
| `InpVerboseLog` | false | DEBUG level journal output. |

### Prop firm
| Input | Notes |
|---|---|
| `InpPropFirm` | Preset: FTMO, FundedNext, FundingPips, Blue Guardian, Hola Prime, CK Capital, Blueberry, Eightcap, None (live), Custom. |
| `InpInitialBalance` | Challenge starting balance. **Set this** if the account isn't fresh. |
| `InpCustom*` | Only read when preset = Custom: daily/overall DD, trailing DD flag, target, min days, consistency %. Use these when a firm changes rules or for a firm not listed. |
| `InpSoftDailyBuffer` / `InpSoftOverallBuffer` | The EA halts this many percentage points *before* the firm's limit (default 0.8% / 1.5%). This is your seatbelt — do not set to 0. |

How the compliance engine behaves:

- **Daily anchor** = max(balance, equity) at day start (the strictest common
  definition). Remaining daily room is shown on the dashboard.
- **Overall DD** = static from initial balance, or trailing from the equity
  high-water mark (`InpCustomTrailingDD` or preset).
- When floating losses reach the *soft* limit, the EA **flattens everything** and
  stops for the day — before the firm's hard limit is touched.
- After `TargetReached` **and** `MinDaysMet`, trading halts (`DONE: Target Reached`)
  to protect the pass.

### Risk
| Input | Default | Notes |
|---|---|---|
| `InpRiskPerTradePct` | 0.5 | Use 0.25 for funded accounts, up to 1.0 on evaluations only. |
| `InpMaxOpenTrades` | 2 | Simultaneous positions across this symbol/EA. |
| `InpMaxTradesPerDay` | 3 | New entries per day. |
| `InpMaxConsecLosses` / `InpCooldownHours` | 3 / 12 | Loss-streak circuit breaker. |
| `InpDailyProfitLockPct` | 2.0 | Stop for the day after +2% — banks progress toward the target. |
| `InpEquityGuardPct` | 3.0 | Flatten all if floating DD exceeds this. Last-resort protection. |
| `InpCorrelationFilter` | true | Blocks same-direction exposure sharing a currency. |
| `InpMaxTotalRiskPct` | 1.5 | Cap on the sum of open-position risk. |
| `InpReduceRiskInDD` | true | Halves risk once overall DD passes 40% of the firm limit. |

Sizing logic: `lots = f(equity × risk%, SL distance, tick value)`, then capped so a
full stop-out can never exceed 90% of the smaller of (remaining daily room,
remaining overall room). If that produces less than the broker minimum lot, the
trade is skipped — never oversized.

### Protection
- **News**: high-impact calendar events for the symbol's currencies block entries
  ±15 min (configurable). In the tester (no calendar) fixed GMT windows around
  typical US red-news slots are used instead.
- **Weekend**: no entries after Friday `InpFridayCloseHour`; optional flatten
  (`InpCloseBeforeWeekend`) — enable it for firms that forbid weekend holding.
- **Spread**: entries blocked when spread exceeds `InpMaxSpreadPoints`
  (0 = automatic: 3× running median spread).

### Sessions
Two configurable windows in broker time; defaults approximate London and New York.
Disable entirely for crypto.

### Strategies
Enable/disable each of the five strategies; tune:
- `InpMinConfluence` (0.62): the single most important quality dial. Raise to 0.68+
  for fewer, better trades.
- `InpMinRR` (1.5): minimum reward:risk after stop buffering.
- `InpHTFConviction` (0.30): how aligned the HTF stack must be before biased
  strategies fire.

### Trade management
Break-even at +1R (locks +0.1R), 50% partial at +1.5R, structure/volatility
trailing from +2R. All distances are R- and volatility-normalised, so behaviour is
consistent from EURUSD to BTCUSD.

---

## Dashboard reference

| Row | Meaning |
|---|---|
| Status | `TRADING` or the exact reason entries are blocked (news, DD, session, cool-down…). |
| Daily/Overall DD used | Percentage consumed vs firm limit. Turns red past 60%. |
| Remaining day room | Money you can still lose today before the soft halt. |
| Target progress | % of profit target + trading days count. |
| PF / Expectancy / Avg R / Sharpe / Sortino | Rolling closed-trade statistics for this EA instance. |
| Regime / Trend | Current regime classification and execution-TF structure state. |
| MTF Bias / Strategy | Weighted HTF bias and the last strategy that fired. |
| Pass estimate\* | Gambler's-ruin style projection from observed win rate / payoff at current risk. Shows `n/a` under 20 trades. **An estimate of past-distribution behaviour, not a prediction.** |

## CSV outputs (`MQL5/Files/ApexPA/`)

- `trades_<symbol>.csv` — one row per closed position: times, prices, SL/TP, lots,
  risk %, R multiple, P/L, commission, swap, spread & slippage at entry, entry
  reason (strategy + confluence breakdown), exit reason, regime, session, duration.
- `events_<symbol>.csv` — entries, blocks (with reasons), equity-guard triggers,
  partial closes, init/deinit.
- `report_daily/weekly/monthly.csv` — periodic snapshots of the full statistics set.

## Daily operations runbook

1. **Before London open**: check dashboard status; confirm news rows for the day.
2. **If status shows a HALT**: do not override it manually — that halt exists to
   keep the account alive. Review `events_*.csv` for the trigger.
3. **Weekly**: run the validation tools on fresh CSV exports; investigate any
   regime with concentrated losses.
4. **After rule changes by your firm**: switch to `PROP_CUSTOM` and encode the new
   numbers immediately.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Symbol adapter failed` on init | Symbol has no tick value/size (synthetic symbol?) — check contract specs. |
| No trades for days | Working as intended in bad regimes; check Status row and `events_*.csv` BLOCK entries. Lower `InpMinConfluence` only with backtest evidence. |
| `below min lot - skipped` events | Risk % × equity too small for the SL distance on this instrument; raise risk or trade a smaller-contract symbol. |
| Dashboard missing | `InpShowDashboard`, chart Algo Trading enabled, not an optimisation pass. |
| News filter shows `Clear` in tester | Expected — calendar unavailable in tester; fallback windows are active instead. |
