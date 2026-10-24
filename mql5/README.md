# AXION Synthetic Reverter v2.0

Statistical mean-reversion Expert Advisor for Deriv synthetic indices (Volatility 10/25/50/75/100, Step Index, Boom 1000, Crash 1000), MT5 build 4000+.

Source: [`Experts/AXION_SyntheticReverter_v2.mq5`](Experts/AXION_SyntheticReverter_v2.mq5)

**Edge thesis:** synthetics are algorithmically generated — no institutional order flow, no sessions, no news. The only durable edge is statistical overextension (ATR range expansion + rejection wick + std-dev stretch from the rolling mean) followed by reversion, protected by fixed-fractional risk and layered halts. No ICT/SMC, no order blocks, no martingale, no grid, no averaging, no hedging. One position per symbol, risk always computed from **equity**.

---

## 1. Input parameter reference

### Identity
| Input | Default | Purpose |
|---|---|---|
| `InpMagic` | 20260710 | Magic number; namespaces positions, persisted state, and journal rows. Change per chart instance. |

### Entry Engine
| Input | Default | Purpose / safe range |
|---|---|---|
| `InpATRPeriod` | 14 | ATR baseline period (10–21). |
| `InpRangeExpansionMult` | 1.8 | Signal bar range must exceed ATR × this (1.5–2.5). |
| `InpMinWickPct` | 60.0 | Rejection wick ≥ this % of bar range at the extreme (50–75). |
| `InpMeanPeriod` | 50 | SMA of typical price — the reversion anchor (30–100). |
| `InpStdDevPeriod` | 50 | StdDev period; keep equal to `InpMeanPeriod`. |
| `InpMinStdDevs` | 2.0 | Close must be ≥ this many σ from the mean (1.5–3.0). |
| `InpVolRegimeBars` | 500 | ATR history depth for the percentile regime filter (300–1000). |
| `InpVolRegimeLowPct` | 30.0 | Skip entries when ATR percentile is below this (dead volatility). |
| `InpVolRegimeHighPct` | 70.0 | Skip entries when ATR percentile is above this (volatility explosion). |

### Risk Engine
| Input | Default | Purpose / safe range |
|---|---|---|
| `InpRiskPercent` | 0.5 | Equity % risked per trade (0.25–1.0). |
| `InpDailyLossCapPct` | 2.0 | Daily loss cap as % of day-start equity; halts new entries until midnight. |
| `InpMaxDrawdownPct` | 5.0 | Hard halt from the equity high-water mark (persisted across restarts). |
| `InpMaxConsecLosses` | 3 | Consecutive losses that trip the circuit breaker (2–5). |
| `InpCooldownHours` | 4.0 | Cooldown length after the breaker fires (persisted). |
| `InpMaxOpenTrades` | 1 | Max simultaneous positions — keep at 1. |
| `InpMaxSpreadPoints` | 50 | Skip entries when spread exceeds this. |

### Exit Engine
| Input | Default | Purpose |
|---|---|---|
| `InpSLAtrBuffer` | 0.5 | SL = beyond the signal-bar extreme + ATR × this (0.3–1.0). |
| `InpTPMode` | TP_MEAN | `TP_MEAN`: single TP at the rolling mean. `TP_TIERED`: partial ladder at 1/3, 2/3, and full distance to the mean. |
| `InpTP1Pct / InpTP2Pct / InpTP3Pct` | 50/30/20 | Tiered mode: % of original volume closed at each tier (TP3 = remainder runs to the mean). |
| `InpBETriggerPct` | 50.0 | Move SL to break-even ± spread when this % of the TP distance is covered. |
| `InpTrailMode` | TRAIL_ATR | `TRAIL_OFF` or ATR trailing; trailing only engages **after** break-even. |
| `InpTrailAtrMult` | 1.5 | Trail distance = ATR × this (1.0–2.5). |
| `InpTrailStepPoints` | 10 | Minimum SL improvement before a modify is sent. |

### Visual Engine
| Input | Default | Purpose |
|---|---|---|
| `InpShowVisuals` | true | Master toggle; forced OFF automatically during optimization. |
| `InpTradeHistoryDepth` | 20 | Closed-trade markers kept on chart (ring buffer). |
| `InpFontSize` | 9 | Label font size. |
| `InpColorText / InpColorHeader` | white / gold | Dashboard palette (brand navy `#0A1628`, gold `#C9A84C`). |

### Journal & Dashboard
| Input | Default | Purpose |
|---|---|---|
| `InpEnableJournal` | true | CSV journal in `MQL5\Files`. |
| `InpJournalFileName` | AXN_TradeJournal.csv | Journal file name. |
| `InpShowDashboard` | true | On-chart statistics panel. |

---

## 2. OnTick pipeline — plain-English walkthrough

1. **New bar?** Intrabar ticks only manage what is already open (tiers, break-even, trailing) and refresh the dashboard. All decision logic runs once per closed bar.
2. **Day rollover** — at midnight the daily P/L ledger, trade counter, and day-start equity snapshot reset.
3. **Drawdown guard** — equity is compared with the persisted high-water mark; at ≥ 5% drawdown all *new* entries are blocked (open trades keep their own SL/TP; nothing is force-closed).
4. **Daily loss cap** — realized + floating P/L for the day vs 2% of day-start equity.
5. **Cooldown** — after 3 consecutive losses, no entries for 4 hours (survives restarts via GlobalVariables).
6. **Spread gate** — entries skipped when spread > 50 points.
7. **Position cap** — with a position already open, the EA only manages it.
8. **Volatility regime** — current ATR must sit in the 30th–70th percentile of its own last 500 values: dead markets have nothing to revert, exploding markets don't revert.
9. **Signal (AND-gate, all three on the just-closed bar):**
   - **A. Range expansion:** bar range > ATR × 1.8.
   - **B. Rejection wick:** ≥ 60% of the range at the extreme, with a close on the rejection side.
   - **C. Statistical stretch:** close ≥ 2σ from the 50-period mean, direction-locked — above the mean means SELL only, below means BUY only (pure reversion, never trend-follow). On Boom only SELLs after spike-ups are allowed; on Crash only BUYs after spike-downs (spike direction is structurally one-sided on those indices).
10. **No signal → done.**
11. **Trade plan** — entry at market; SL beyond the signal-bar extreme + 0.5 ATR; TP at the rolling mean (or a 1/3–2/3–full ladder to it); lots from 0.5% of equity over the SL distance.
12. **Validation** — broker stops level, minimum lot, and free margin.
13. **Execution** — market order with one retry on requote.
14. **Bookkeeping** — journal row, chart visuals, dashboard refresh. Exits are detected in `OnTradeTransaction`, which finalizes the journal row, stats, loss streak, and closed-trade marker.

---

## 3. Installation (MT5)

1. Open MetaTrader 5 → **File → Open Data Folder**.
2. Copy `AXION_SyntheticReverter_v2.mq5` into `MQL5\Experts\`.
3. Open MetaEditor (F4), open the file, press **F7** to compile — expect 0 errors / 0 warnings on build 4000+.
4. In MT5, enable **Algo Trading** (toolbar button) and allow it in *Tools → Options → Expert Advisors*.
5. Drag the EA onto a synthetic-index chart (recommended start: Volatility 75, M5). Review inputs, press OK.
6. Confirm the navy/gold dashboard appears top-left and the Experts log prints the init summary.
7. The trade journal is written to `MQL5\Files\AXN_TradeJournal.csv`.

---

## 4. Backtest protocol (mandatory before any live deployment)

- **Data:** 2 years of Volatility 75 Index, M5, **every-tick** model (or "every tick based on real ticks" where available).
- **Split:** walk-forward with 70% in-sample / 30% out-of-sample. Optimize (if at all) only on the first ~17 months; freeze parameters; run the final ~7 months untouched.
- **Report from the OUT-OF-SAMPLE segment only:** winrate, profit factor, maximum drawdown, and Sharpe ratio.
- **Rule:** no winrate or performance figure may be claimed for this EA unless it comes from the out-of-sample segment. In-sample numbers are curve-fit by construction and are not evidence.
- Repeat per symbol before enabling the EA on it — V75 parameters are not automatically valid on Step Index or Boom/Crash.

---

## 5. Failure-mode analysis

| Losing condition | Mitigating control | Residual gap / proposed input |
|---|---|---|
| Boom/Crash spike against a held reversion position | Asymmetry rule (only fade the spike side) + ATR-buffered SL + 0.5% fixed risk | Spikes can gap through SL; slippage exceeds planned risk. *Propose `InpMaxSlippagePoints` to reject fills beyond a slippage budget.* |
| Volatility regime shift (calm → violent) mid-trade | Regime filter blocks new entries; BE + ATR trail de-risks open trade | Filter is entry-time only; an open trade rides the shift until SL/BE. Acceptable by design. |
| Extended one-way trend (mean keeps running away) | 2σ direction lock prevents trend-side entries; consecutive-loss breaker + daily cap stop repeated fading | Mitigated: losses are capped, not prevented. |
| Low-liquidity spread widening | `InpMaxSpreadPoints` entry gate | Gate is entry-time only; exits can pay a wide spread. *Propose `InpMaxSpreadForBE` to defer BE modifies while spread is abnormal.* |
| Broker requotes / off-quotes | One fresh-price retry, then abandon the signal | Fully mitigated (signal skipped, never chased). |
| Dead volatility chop (signals with no follow-through) | Lower percentile bound of the regime filter | Mitigated. |
| Restart with an open tiered position | State recovery re-attaches; tier ladder conservatively collapses to the final TP | Partial-tier geometry is lost across restarts. Acceptable: management stays safe (BE/trail intact). |

---

## 6. Degradation stress test (the math)

Assume the default geometry: risk per trade `r = 0.5%` of equity, and take reward ≈ 1R on average (mean-reversion targets are typically ≤ 1R after tiering; this is the conservative case).

At a degraded live winrate of **65%** with symmetric 1R payoffs:

- Expectancy per trade = 0.65·(+1R) + 0.35·(−1R) = **+0.30R = +0.15% equity per trade** — still positive; the equity curve grinds up, just flatter.
- The DD-halt question is streak risk. Loss probability per trade = 0.35. Probability of *k* consecutive losses = 0.35^k: 3 losses = 4.3%, 5 = 0.5%, 10 = 0.0028%.
- Reaching the 5% drawdown halt requires ≈ 10 net losses from a fresh high-water mark (10 × 0.5%, slightly fewer compounded: (1−0.005)¹⁰ ≈ −4.9%). A *pure* 10-loss streak is a ~1-in-36,000 event at 65% winrate — and the design intervenes long before: the 3-loss breaker imposes a 4-hour cooldown (at most ~3 breaker cycles fit in a day) and the 2% daily cap stops the day after ~4 net losses.
- Worst realistic path to the halt therefore spans **multiple days of sustained 35% losing**, giving the operator days — not minutes — to intervene, and the halt itself blocks new risk while leaving nothing to liquidate at the lows.

**Conclusion:** at 0.5% risk, even a degradation to 65% winrate leaves positive expectancy, and the layered halts (3-loss breaker → 2% daily cap → 5% HWM halt) make account-threatening drawdown a multi-day, multi-failure event rather than a single bad session. The design survives the degradation. (Below ~50% winrate at 1R the edge is gone — that is what the out-of-sample protocol and the halts exist to catch.)
