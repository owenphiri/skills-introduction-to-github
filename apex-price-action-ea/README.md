# ApexPA — Pure Price Action Expert Advisor for MetaTrader 5

Production-grade, modular MQL5 Expert Advisor that trades **pure price action** —
market structure, liquidity, supply/demand, levels and candle behaviour — with an
institutional risk engine designed for **prop-firm evaluations and funded accounts**
(FTMO, FundedNext, FundingPips, Blue Guardian, Hola Prime, CK Capital, Blueberry
Funded, Eightcap, or any custom firm).

**No lagging indicators are used for entries.** No moving averages, MACD, RSI,
stochastic or Bollinger signals. The only derived quantity in the system is a raw
true-range volatility unit, used exclusively for risk normalisation, stop buffers
and regime measurement — never as an entry trigger.

> ⚠️ **Honest framing.** Nothing here guarantees profits or a passed challenge.
> Every performance number this system shows is a *measurement of historical
> simulation*. Validate on your broker's data, out-of-sample, before risking a fee
> or an account. Verify each firm's current rules yourself — presets encode
> commonly published rules that firms change without notice.

---

## Feature map

| Layer | Module | What it does |
|---|---|---|
| Core | `SymbolAdapter` | Auto-adapts to Forex/Gold/Indices/Oil/Crypto: pip maths, tick values, lot rules, round-number grids. No hardcoded pip values anywhere. |
| Core | `Logger` | Levelled journal + daily log files for VPS forensics. |
| Price Action | `SwingEngine` | Non-repainting fractal swings, HH/HL/LH/LL labelling, liquidity pool tracking. |
| Price Action | `StructureEngine` | Trend state machine, BOS / CHoCH detection, premium/discount range position. |
| Price Action | `CandleEngine` | Pin bars, engulfing, inside/outside bars — scored, not binary. |
| Price Action | `LevelEngine` | S/R clusters, daily/weekly/monthly H/L, session extremes, round & psychological numbers. |
| Price Action | `ZoneEngine` | Supply/demand zones, order blocks (optional), fair value gaps (optional). |
| Price Action | `LiquidityEngine` | Liquidity sweeps, false breakouts, breakout-retest confirmation. |
| Price Action | `RegimeEngine` | Trending / ranging / expansion / compression / high-low vol classification from price efficiency + vol percentiles. |
| Analysis | `MTFAnalyzer` | Weighted multi-timeframe bias (MN1→M1); HTF context gates LTF entries. |
| Risk | `RiskManager` | Fixed-fractional sizing capped by remaining DD room, daily/weekly/overall breakers, correlation & exposure limits, loss-streak cool-down, profit lock, equity guard. |
| Risk | `PropFirmManager` | Firm presets + live compliance: remaining daily/overall room, target progress, trading days, consistency rule. Halts *before* firm limits via safety buffers. |
| Risk | `NewsFilter` | MT5 economic calendar (high-impact) with tester-safe fallback windows. |
| Execution | `ExecutionEngine` | Spread/slippage gating, retry with backoff, partial-fill handling, duplicate-trade prevention, latency measurement. |
| Execution | `TradeManager` | Auto break-even, partial profit, structure + volatility trailing. All in R-multiples. |
| Strategy | `SignalEngine` | 5 regime-gated strategies with confluence scoring (see below). |
| Analytics | `Statistics`, `Dashboard` | Full on-chart dashboard: equity, DD room, PF, expectancy, Sharpe/Sortino, streaks, regime, news, latency, pass estimate (clearly labelled estimate). |
| Data | `CsvLogger` | Per-trade CSV with entry/exit reasons, regime, session, slippage; daily/weekly/monthly report files. |
| Validation | `tools/validation/` | Monte Carlo, walk-forward, and consolidated validation report generators (Python, stdlib only). |

## Strategies (all pure price action, regime-gated)

1. **Trend Pullback** — HTF bias + pullback into demand/supply/level confluence in
   discount (longs) or premium (shorts) + candle confirmation.
2. **Liquidity Sweep** — stop-hunt through a resting swing at a key level with a
   rejection close; trade the reversal.
3. **Breakout + Retest** — break of structure, then a retest that holds; continuation.
4. **False Breakout Fade** — failed break of a strong level in a range; fade it.
5. **Compression Breakout** — inside-bar coil in a compression regime; trade the expansion.

Every candidate gets a confluence score in [0,1]; only signals above the threshold
(default 0.62) with reward:risk ≥ 1.5 are traded. **Quality over quantity** — the EA
is designed to skip days, not to chase.

## Repository layout

```
apex-price-action-ea/
├── MQL5/
│   ├── Experts/ApexPriceAction/ApexPriceAction.mq5   # main EA
│   └── Include/ApexPA/                               # modular engine (17 files)
├── presets/                                          # firm + instrument .set files
├── tools/validation/                                 # Monte Carlo / walk-forward / report
└── docs/                                             # installation, manual, guides
```

## Quick start

1. Copy `MQL5/` into your terminal's data folder (see `docs/INSTALLATION.md`).
2. Compile `ApexPriceAction.mq5` in MetaEditor (F7) — zero errors expected.
3. Load a preset from `presets/` matching your firm, attach to a chart
   (M15 EURUSD or XAUUSD are the reference configurations).
4. Backtest first: `docs/BACKTESTING_GUIDE.md`, then validate:
   `docs/WALK_FORWARD_GUIDE.md`.
5. Run on demo alongside the challenge rules for at least two weeks before
   deploying on a paid evaluation.

## Documentation

| Doc | Contents |
|---|---|
| `docs/INSTALLATION.md` | Install, compile, permissions, VPS notes |
| `docs/USER_MANUAL.md` | Every input explained, dashboard reference, ops runbook |
| `docs/ARCHITECTURE.md` | Module design, data flow, extension points (AI/ML roadmap) |
| `docs/BACKTESTING_GUIDE.md` | Tick data, spreads, tester setup, CSV outputs |
| `docs/OPTIMIZATION_GUIDE.md` | What to optimise (little), custom criterion, overfit defence |
| `docs/WALK_FORWARD_GUIDE.md` | IS/OOS splits, folds, Monte Carlo, acceptance gates |
| `docs/VALIDATION_REPORT.md` | Validation methodology + report template |
| `docs/DEFAULT_SETTINGS.md` | Suggested defaults for Gold, Forex, Indices, Oil, Crypto |

## License / disclaimer

For educational and research use. Trading leveraged products carries substantial
risk of loss. Past performance — simulated or live — does not guarantee future
results. You are solely responsible for compliance with your broker's and prop
firm's terms.
