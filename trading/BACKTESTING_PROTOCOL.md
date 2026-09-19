# UPPAU — Backtesting & Forward-Testing Protocol

Validation workflow for the **Ultimate Pure Price Action Ultimatum** strategy
(`Ultimate_Pure_Price_Action_Ultimatum.pine`). The goal is not to find the
settings with the prettiest equity curve — it is to prove the edge is **robust**:
that it survives data it has never seen, symbols it was not tuned on, and the
costs and slippage of live execution. Follow the phases in order; do not skip
ahead when a phase fails — go back and fix the cause.

---

## Recommended instruments & timeframes

Trade only liquid instruments with tight spreads — price action on thin
markets is mostly noise and stop-hunts you can't model.

| Class    | Instruments                       | Timeframe | Session focus                     |
|----------|-----------------------------------|-----------|-----------------------------------|
| Forex    | EURUSD, GBPUSD, USDJPY            | M15 (M5 for experienced) | London + NY overlap (07:00–16:00 UTC) |
| Indices  | NAS100, US30, S&P500              | M5–M15    | NY cash session; avoid the first 5 minutes |
| Metals   | XAUUSD                            | M15       | London + NY; wider `volMult` (1.2–1.5) |
| Crypto   | BTCUSD, ETHUSD                    | M15–H1    | 24/7 — the daily signal cap does the session's job |
| Futures  | ES, NQ, GC (continuous contracts) | M5–M15    | RTH; roll dates distort backtests — use back-adjusted data |

Guidance:

- **M5–M15 is the intraday sweet spot** for this system: enough bars for the
  swing engine to build structure, few enough that the ~2–3 signals/day pace
  is realistic. Below M5, spread and slippage eat the edge; H1+ turns it into
  a swing system (fine, but expect a few signals per *week*).
- Pair the chart TF with an HTF bias 8–16× higher: M5→H1, M15→H4 (default),
  H1→D.
- Because every threshold is ATR-scaled **and** auto-scaled by the volatility
  percentile, the same settings file should transfer across this whole table;
  only `volMult` may need a nudge per asset class.

## Parameter budget (anti-curve-fitting contract)

You may optimise **at most four inputs** — this is a hard rule, also written
into the script header:

1. Swing pivot length (5–13, integer steps)
2. Volatility multiplier (0.8–1.5, steps of 0.1)
3. Min confluence score (4–7)
4. Strong displacement (1.2–2.0, steps of 0.1)

Everything else — RR ladder, exit percentages, regime thresholds, rejection
window, news windows, risk % — stays at defaults during optimisation. Four
parameters over a coarse grid is ~500 combinations; that is already enough to
find a false edge in random data, which is exactly why the out-of-sample and
walk-forward phases below are not optional.

---

## Phase 0 — Test-bench setup (do this before any results count)

1. **Costs on.** Keep `commission_value` and `slippage` in the declaration at
   realistic values for your broker/prop firm (e.g. forex ≈ 0.002–0.005%
   equivalent + 1–3 ticks slippage; crypto ≈ 0.02–0.06%). A strategy that only
   works at zero cost has no edge.
2. **Realistic fills.** Leave `process_orders_on_close = false` (fills happen
   on next bar open). Never flip it to true to "improve" results.
3. **Account alignment.** Set `initial_capital` equal to the *Account size*
   input so the tester's percentage metrics match the risk engine, and so the
   daily-loss / max-DD locks fire at the right equity levels.
4. **Data depth.** Use a chart with enough bars for ≥ 150–300 trades in total.
   On M15 crypto/forex that is roughly 1.5–3 years; on H1, 3–5 years. Fewer
   than ~100 trades ⇒ any statistic is noise.
5. **Bar magnifier (if available on your plan).** Enable it in Strategy Tester
   properties so intrabar TP/SL sequencing is resolved with lower-timeframe
   data. Without it, treat same-bar TP+SL bars as pessimistic (the script
   checks the stop first by design).
6. **Locks armed.** Keep "Enforce daily-loss & max-DD locks" ON during every
   test. A pretty equity curve that trips the DD lock is a failed evaluation,
   not a result.

## Phase 1 — In-sample calibration (max 60% of your data, oldest segment)

1. Pick the instrument + timeframe you actually intend to trade.
2. Tune only the four budget parameters, **one at a time**, in the order
   listed above.
3. **Coarse grid only.** If performance collapses when a parameter moves one
   step, the setting is curve-fit — prefer the flattest neighbourhood
   ("plateau"), not the single best cell.
4. Record for the chosen set: trade count, win rate, profit factor, max
   drawdown, average R per trade, longest losing streak, worst single day.
5. **Acceptance gate:** profit factor ≥ 1.3, max DD compatible with your prop
   rules (see Phase 5), ≥ 80 trades, no daily-lock or DD-lock trigger.
   Otherwise stop and rethink — do not add parameters.

## Phase 2 — Out-of-sample validation (the untouched 40%)

1. Apply the frozen Phase-1 settings to the newest 40% of data. Change
   **nothing**.
2. Pass criteria (rules of thumb):
   - Profit factor ≥ 70% of the in-sample value and still > 1.15
   - Max drawdown ≤ 1.5× in-sample drawdown
   - Win rate within ±10 percentage points of in-sample
   - Still no lock triggers
3. One failed criterion = amber (investigate the regime mix of the OOS
   window — the dashboard's trend-strength reading helps here). Two or more =
   fail: return to Phase 1 with *simpler* settings, never with more tuning.

## Phase 3 — Walk-forward optimisation & regime slicing

1. **Walk-forward:** divide the full history into 5–6 sequential folds. For
   each fold *k*: optimise (within the parameter budget) on folds 1..k-1,
   test frozen on fold k. Collect only the out-of-fold results and stitch
   them into one "walk-forward equity curve" — that curve, not the in-sample
   one, is your realistic expectation. Compute **walk-forward efficiency** =
   (stitched OOS profit per trade) ÷ (in-sample profit per trade); ≥ 0.5 is
   robust, < 0.3 is curve-fit.
2. **Parameter stability:** across folds, the chosen parameters should barely
   move (swing length drifting 8→9→8 is fine; 5→13→6 means the "edge" is an
   artifact).
3. **Regime slicing:** using the dashboard's regime + trend-strength labels,
   bucket trades into trending / ranging / high-vol / low-vol conditions.
   Trend buckets should dominate profits by design; the ranging bucket must
   not bleed more than the daily-cap and cooldown allow.
4. **Cross-market robustness:** run the frozen settings on 3–5 unrelated
   symbols from the table above. Directionally similar results expected;
   adjusting anything beyond `volMult` per asset class is a fail.

## Phase 4 — Monte Carlo & stress tests

1. **Monte Carlo (trade-order shuffle):** export the trade list (List of
   Trades → export), then shuffle the trade sequence ≥ 1,000× in a
   spreadsheet or Python script. Read off the distribution of: max drawdown,
   longest losing streak, worst day. Use the **95th-percentile drawdown** —
   not the single backtest's max DD — when checking prop limits in Phase 5.
2. **Monte Carlo (resample with replacement):** same trade list, but sample
   N trades with replacement 1,000×. If ≥ 5% of resampled equity curves end
   negative, the edge is too thin to fund.
3. **Cost doubling:** double commission and slippage. Edge should shrink, not
   invert.
4. **Entry-delay test:** if your live routing is slower than one bar, test
   `slippage` at 2–3× your measured value.
5. **Parameter perturbation:** re-run with all four tuned inputs moved ±1
   step simultaneously (both directions). Profitable → still profitable is a
   pass; a sign flip is overfit.
6. **Data perturbation (optional but strong):** re-run on a different
   broker's feed of the same symbol (e.g. OANDA vs FXCM EURUSD). Price-action
   systems should survive feed differences almost unchanged.

## Phase 5 — Prop-firm rule mapping

Before forward testing, verify against your firm's rule set (example: 10%
profit target, 5% daily / 10% overall drawdown):

- **Risk per trade:** with 0.5% risk and the default TP ladder, require
  `risk% × (Monte-Carlo 95th-percentile losing streak + 50% buffer) < overall DD limit`.
- **Daily stop:** max signals/day (default 3) × risk% must stay well under the
  daily-loss limit, and the in-code daily lock (default 3%) must sit *below*
  the firm's limit (5%) so slippage on the last loser cannot breach it.
- **The in-code locks are the audit:** a full backtest + Monte Carlo run with
  zero lock triggers is your evidence the settings live inside the firm's
  rules with margin to spare.
- **Consistency rules:** check no single backtested day exceeds the firm's
  "max % of total profit from one day" figure; the daily cap plus cooldown
  naturally flattens this distribution.

## Phase 6 — Forward testing on unseen data (demo → live)

1. **Incubation on truly unseen data:** after freezing settings, let the
   strategy run untouched for 4–8 weeks of *new* market data (demo account,
   alerts on). This data did not exist during any optimisation — it is the
   only test that cannot be curve-fit.
2. **Journal every signal:** timestamp, regime + trend strength, star rating,
   entry/SL/TP, outcome, and the difference between alert price and actual
   fill (your true slippage number — feed it back into Phase 0).
3. **Compare to walk-forward:** forward win rate and average R should sit
   inside the range of the Phase-3 fold results. A large gap usually means
   execution slippage or a repainting assumption — investigate before
   funding.
4. **Go-live ramp:** start at half risk (e.g. 0.25%) for the first 20 live
   trades; scale to target risk only after live stats match demo stats.
5. **Ongoing monitoring:** re-run the OOS check quarterly on new data. Retire
   or re-validate the settings if profit factor drops below 1.0 over a
   rolling 100-trade window. Never "hot-fix" parameters mid-drawdown — that
   is how validated systems become curve-fit ones.

## Known simulator caveats (be honest with yourself)

- **Intrabar ordering:** without bar magnifier, TradingView cannot know
  whether the high or low printed first inside a bar. The script resolves the
  ambiguity pessimistically (stop before targets), so real results may be
  slightly *better* than backtest — the safe direction.
- **Signal-bar close vs next-bar open:** visual entries are stamped at the
  signal bar's close; the broker emulator fills at next bar open. The gap
  between the two is real slippage you would also face live with alerts.
- **HTF bias & structure:** implemented with the confirmed-bar (`[1]` +
  lookahead) idiom, so they do not repaint; they are one HTF bar "late" by
  construction. Do not replace them with live HTF values — that repaints and
  inflates backtests.
- **News filter is time-based:** Pine has no calendar feed. Unscheduled
  events (flash crashes, surprise announcements) are NOT filtered — the
  volatility-percentile scaling and displacement requirements are the only
  defence, and sometimes they will not be enough. Budget for it.
