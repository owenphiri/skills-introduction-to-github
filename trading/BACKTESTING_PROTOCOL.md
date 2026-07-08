# UPPAU — Backtesting & Forward-Testing Protocol

Validation workflow for the **Ultimate Pure Price Action Ultimatum** strategy
(`Ultimate_Pure_Price_Action_Ultimatum.pine`). The goal is not to find the
settings with the prettiest equity curve — it is to prove the edge is **robust**:
that it survives data it has never seen, symbols it was not tuned on, and the
costs and slippage of live execution. Follow the phases in order; do not skip
ahead when a phase fails — go back and fix the cause.

---

## Phase 0 — Test-bench setup (do this before any results count)

1. **Costs on.** Keep `commission_value` and `slippage` in the declaration at
   realistic values for your broker/prop firm (e.g. forex ≈ 0.002–0.005%
   equivalent + 1–3 ticks slippage; crypto ≈ 0.02–0.06%). A strategy that only
   works at zero cost has no edge.
2. **Realistic fills.** Leave `process_orders_on_close = false` (fills happen
   on next bar open). Never flip it to true to "improve" results.
3. **Account alignment.** Set `initial_capital` equal to the *Account size*
   input so the tester's percentage metrics match the risk engine.
4. **Data depth.** Use a chart with enough bars for ≥ 150–300 trades in total.
   On M15 crypto/forex that is roughly 1.5–3 years; on H1, 3–5 years. Fewer
   than ~100 trades ⇒ any statistic is noise.
5. **Bar magnifier (if available on your plan).** Enable it in Strategy Tester
   properties so intrabar TP/SL sequencing is resolved with lower-timeframe
   data. Without it, treat same-bar TP+SL bars as pessimistic (the script
   checks the stop first by design).

## Phase 1 — In-sample calibration (max 60% of your data, oldest segment)

1. Pick the instrument + timeframe you actually intend to trade.
2. Only tune the **structural** inputs, in this order, one at a time:
   - Swing pivot length (5–13)
   - Volatility multiplier (0.8–1.5)
   - Min confluence score (4–6)
   - HTF timeframe (one step: e.g. M15 chart → H4 bias)
3. **Coarse grid only.** Steps of whole numbers / 0.25s. If performance
   collapses when a parameter moves one step, the setting is curve-fit —
   prefer the flattest neighbourhood ("plateau"), not the single best cell.
4. Record for the chosen set: trade count, win rate, profit factor, max
   drawdown, average R per trade, longest losing streak.
5. **Acceptance gate:** profit factor ≥ 1.3, max DD compatible with your prop
   rules (see Phase 5), ≥ 80 trades. Otherwise stop and rethink — do not add
   parameters.

## Phase 2 — Out-of-sample validation (the untouched 40%)

1. Apply the frozen Phase-1 settings to the newest 40% of data. Change
   **nothing**.
2. Pass criteria (rules of thumb):
   - Profit factor ≥ 70% of the in-sample value and still > 1.15
   - Max drawdown ≤ 1.5× in-sample drawdown
   - Win rate within ±10 percentage points of in-sample
3. One failed criterion = amber (investigate the regime mix of the OOS
   window). Two or more = fail: return to Phase 1 with *simpler* settings,
   never with more tuning.

## Phase 3 — Walk-forward & regime slicing

1. **Walk-forward:** split the whole history into 4–6 sequential windows,
   re-run the frozen settings on each. The strategy must be profitable (or
   near-flat) in most windows; one great window carrying five bad ones is a
   regime bet, not an edge.
2. **Regime slicing:** using the dashboard's regime label, note performance
   separately in trending vs ranging vs high-vol periods (the tester's list of
   trades + chart regime changes makes this practical). Expect trend windows
   to dominate profits — that is by design — but ranging windows must not
   bleed more than the daily-cap/cooldown allows.
3. **Cross-market robustness:** run the same frozen settings on 3–5 unrelated
   symbols (e.g. EURUSD, XAUUSD, NAS100, BTCUSD, a large-cap stock). Because
   every threshold is ATR-normalised, results should be *directionally*
   similar. It is fine to adjust only the volatility multiplier per asset
   class; it is NOT fine to re-tune structure per symbol.

## Phase 4 — Stress tests

1. **Cost doubling:** double commission and slippage. Edge should shrink, not
   invert.
2. **Entry-delay test:** in the tester, note whether performance survives the
   one-bar fill delay already built in. If your live routing is slower, test
   `slippage` at 2–3× your measured value.
3. **Monte-Carlo (manual):** export the trade list, shuffle trade order
   1,000× in a spreadsheet/script, and read the 95th-percentile drawdown.
   That number — not the backtest max DD — is what you compare against prop
   limits.
4. **Parameter perturbation:** re-run with every tuned input moved ±1 step
   simultaneously. If the system flips from profitable to losing, it is
   overfit.

## Phase 5 — Prop-firm rule mapping

Before forward testing, verify against your firm's rule set (example: 10%
profit target, 5% daily / 10% overall drawdown):

- **Risk per trade:** with 0.5% risk and the default TP ladder, a worst-case
  losing streak of 10 costs ≈ 5% — set risk so that
  `risk% × (longest backtested losing streak + 50% buffer) < overall DD limit`.
- **Daily stop:** max signals/day (default 3) × risk% must stay well under the
  daily-loss limit; 3 × 0.5% = 1.5% worst day vs a 5% limit is a comfortable
  margin.
- **Consistency rules:** the daily cap plus cooldown naturally flattens the
  profit distribution; check no single backtested day exceeds the firm's
  "max % of total profit from one day" rule.

## Phase 6 — Forward testing (demo → live)

1. **Paper/demo phase (4–8 weeks or ≥ 30 trades, whichever is longer):** run
   the script live on a demo account using the alerts. Log every signal in a
   journal: timestamp, regime, star rating, entry/SL/TP, outcome, and — most
   importantly — the difference between the alert price and your actual fill.
2. **Compare to backtest:** forward win rate and average R should sit inside
   the range seen across Phase-3 walk-forward windows. A large gap usually
   means execution slippage or a repainting assumption — investigate before
   funding.
3. **Go-live ramp:** start at half risk (e.g. 0.25%) for the first 20 live
   trades; scale to target risk only after live stats match demo stats.
4. **Ongoing monitoring:** re-run the OOS check quarterly on new data. Retire
   or re-validate the settings if profit factor drops below 1.0 over a rolling
   100-trade window. Never "hot-fix" parameters mid-drawdown — that is how
   validated systems become curve-fit ones.

## Known simulator caveats (be honest with yourself)

- **Intrabar ordering:** without bar magnifier, TradingView cannot know
  whether the high or low printed first inside a bar. The script resolves the
  ambiguity pessimistically (stop before targets), so real results may be
  slightly *better* than backtest — the safe direction.
- **Signal-bar close vs next-bar open:** visual entries are stamped at the
  signal bar's close; the broker emulator fills at next bar open. The gap
  between the two is real slippage you would also face live with alerts.
- **HTF bias:** implemented with the confirmed-bar (`[1]` + lookahead) idiom,
  so it does not repaint; it is one HTF bar "late" by construction. Do not
  replace it with a live HTF value — that repaints and inflates backtests.
