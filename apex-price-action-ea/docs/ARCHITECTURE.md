# Architecture

## Design principles

1. **Separation of concerns** — perception (price action engines), judgement
   (strategy/confluence), permission (risk/compliance), and action (execution) are
   isolated modules with narrow interfaces. The risk layer can only veto or shrink;
   it can never create a trade. The execution layer never decides.
2. **Non-repainting by construction** — every detector consumes closed bars only;
   swings require N confirming bars; signals are evaluated once per closed
   execution bar. What the backtest sees is what live sees.
3. **Instrument neutrality** — all thresholds are expressed in volatility units
   (raw true-range average) or R-multiples. `CSymbolAdapter` is the only place that
   knows about pips, ticks and contract specs.
4. **Fail-closed** — on any ambiguity (missing data, adapter failure, spread spike,
   unknown regime) the EA stands aside rather than trading.
5. **MQL5 pragmatics** — MQL5 has no namespaces; the `Apex`/`CApex*` prefix and the
   `ApexPA/` include tree serve that role. Interfaces are kept implicit (plain
   classes with documented contracts) because MQL5 `interface` types cost vtable
   indirection in tick-hot paths; the module boundaries in this doc are the real
   contract. MQL5 EAs are single-threaded — "thread safety" reduces to reentrancy
   discipline: no module mutates another's state outside `Update()` calls.

## Data flow (per tick)

```
OnTick
 ├─ StructureEngine.Update ──> SwingEngine.Update      (bar-gated)
 ├─ LevelEngine / ZoneEngine / LiquidityEngine / RegimeEngine.Update
 ├─ MTFAnalyzer.Update      (per-TF structure stacks)
 ├─ Equity guard  ──────────> ExecutionEngine.CloseAll (if breached)
 ├─ Soft-DD flatten ────────> ExecutionEngine.CloseAll (if breached)
 ├─ TradeManager.Manage     (BE / partial / trail, every tick)
 └─ new closed bar?
     ├─ Session / News / Spread gates
     ├─ SignalEngine.Evaluate
     │    ├─ regime gate per strategy (RegimeEngine.AllowsStrategy)
     │    ├─ confluence scoring (zones + levels + candles + MTF bias)
     │    └─ stop/target construction (structure + vol buffer, RR floor)
     ├─ RiskManager.CanTrade  (13 independent gates)
     ├─ RiskManager.ComputeLots (DD-room-capped fixed fractional)
     └─ ExecutionEngine.OpenMarket (spread/slippage/retry/partial-fill)

OnTradeTransaction ──> trade record reconstruction ──> Statistics / CsvLogger /
                                                        RiskManager.OnTradeClosed
OnTimer(1s) ──> Dashboard.Update, CsvLogger.MaybeWriteReports
```

## Module inventory

| File | Class | Responsibility |
|---|---|---|
| `Core/Definitions.mqh` | — | Enums, structs, constants, enum→string helpers. Zero dependencies. |
| `Core/SymbolAdapter.mqh` | `CSymbolAdapter` | Asset-class detection, pip/tick/lot maths, volatility unit, round-number grid, broker stop constraints. |
| `Core/Logger.mqh` | `CLogger` | Levelled journal + daily file logs. |
| `PriceAction/SwingEngine.mqh` | `CSwingEngine` | Confirmed fractal swings, HH/HL/LH/LL labels, unswept-liquidity queries. |
| `PriceAction/StructureEngine.mqh` | `CStructureEngine` | Trend state, BOS/CHoCH events, premium/discount position. |
| `PriceAction/CandleEngine.mqh` | `CCandleEngine` | Scored pin/engulf/inside/outside/momentum detection. |
| `PriceAction/LevelEngine.mqh` | `CLevelEngine` | S/R clusters, period extremes, round numbers; proximity + next-level queries. |
| `PriceAction/ZoneEngine.mqh` | `CZoneEngine` | Supply/demand, order blocks, FVGs; touch counting and invalidation. |
| `PriceAction/LiquidityEngine.mqh` | `CLiquidityEngine` | Sweeps, false breakouts, retest confirmation. |
| `PriceAction/RegimeEngine.mqh` | `CRegimeEngine` | Efficiency-ratio + vol-percentile regime classification; strategy gating. |
| `Analysis/MTFAnalyzer.mqh` | `CMTFAnalyzer` | Per-TF structure stacks, weighted bias vote. |
| `Risk/PropFirmManager.mqh` | `CPropFirmManager` | Firm presets, DD anchors, target/days/consistency compliance. |
| `Risk/RiskManager.mqh` | `CRiskManager` | Sizing, 13 entry gates, streak cool-down, profit lock, equity guard. |
| `Risk/NewsFilter.mqh` | `CNewsFilter` | Calendar polling with tester fallback. |
| `Execution/ExecutionEngine.mqh` | `CExecutionEngine` | Order routing: retries, filling modes, partial fills, latency/slippage capture. |
| `Execution/TradeManager.mqh` | `CTradeManager` | R-based BE/partial/trailing lifecycle. |
| `Strategy/SignalEngine.mqh` | `CSignalEngine` | Five strategies, confluence scoring, stop construction. |
| `Analytics/Statistics.mqh` | `CStatistics` | Trade series, PF/expectancy/Sharpe/Sortino/streaks, pass estimate. |
| `Analytics/Dashboard.mqh` | `CDashboard` | On-chart panel. |
| `Data/CsvLogger.mqh` | `CCsvLogger` | Trade/event CSVs, periodic report rows. |

## Memory & performance

- Bounded arrays everywhere (`APEX_MAX_SWINGS/ZONES/LEVELS`) with recycling — no
  unbounded growth over months of uptime.
- Heavy computation (swing scans, level clustering, vol percentiles) is bar-gated;
  the per-tick path is: position management + a handful of comparisons.
- Volatility unit is cached per bar. Dashboard renders on a 1s timer, never on tick.
- No dynamic object churn in the tick path; module instances are globals
  constructed once.

## Testability

Modules take plain inputs and expose deterministic queries, so they can be driven
by scripted candles in an MQL5 test script (attach engines to offline charts or a
custom-symbol feed). The Python toolkit provides the statistical test harness
(`tools/validation/`). `OnTester` implements a DD-penalised robustness criterion so
the built-in optimizer ranks by durability rather than raw profit.

## Extension points (future AI module roadmap)

The seams are already in place:

- **Adaptive parameters / Bayesian optimisation** — `ApexStrategyConfig` and
  `ApexRiskConfig` are plain structs; an optimizer module can rewrite them between
  bars (e.g. from `OnTimer`) without touching engines.
- **ML signal filter** — wrap `CSignalEngine.Evaluate` and veto/re-weight
  `ApexSignal.confidence` with a learned model. The CSV logs already emit the
  feature vector (regime, bias, confluence components, session) and the label
  (R outcome) needed for supervised training.
- **Python / REST integration** — the CSV event stream is the wire format; a
  sidecar process can tail `MQL5/Files/ApexPA/` and serve a web/mobile dashboard.
  For live control, add a `Files`-based command inbox polled in `OnTimer` (safer
  than DLLs and allowed by most firms) — the polling loop already exists.
- **Reinforcement learning / online learning** — the R-multiple stream plus
  regime tags form the reward/state channels; keep the risk layer's veto authority
  untouched so learned policies remain bounded by compliance.
- **Trade copier** — `OnTradeTransaction` is the single choke point where every
  fill is observed; emit to a copier channel there.
