# Strategy Validation Report — Methodology & Template

> This document defines **how** ApexPA is validated and provides the report
> template. It intentionally ships **without** filled-in performance numbers:
> results depend on your broker's data, spreads and commissions, and publishing
> canned numbers would invite exactly the kind of trust this system refuses to
> ask for. Generate your own with `tools/validation/validation_report.py`.

## Validation pipeline (summary)

1. **Reference backtests** — real ticks, variable spread, commission; ≥3 years;
   symbols: EURUSD, GBPUSD, XAUUSD, US30, BTCUSD (fixed list, chosen a priori).
2. **Walk-forward** — 24m IS / 6m OOS rolling; parameters frozen per window.
3. **Monte Carlo** — 10k bootstrap runs of OOS R-multiples at 0.25/0.5/1.0% risk.
4. **Cross-instrument consistency** — same class, same settings.
5. **Sensitivity** — ±1-step parameter perturbation, ×1.5 spread stress.
6. **Forward test** — ≥2 weeks demo, fill-quality reconciliation.

## Generalisation verdict rules

A configuration **generalises** when:

- WF verdict `ROBUST` (≥70% positive folds, no severe decay), AND
- MC p95 drawdown < 50% of firm overall limit at chosen risk, AND
- positive OOS expectancy on ≥2/3 of tested symbols in the class, AND
- criterion degradation <30% under perturbation and spread stress.

Anything less is labelled accordingly and **not deployed**.

---

## Report template

```markdown
# ApexPA Validation Report — <symbol(s)> — <date>

## 1. Setup
- Data source / broker, tick quality %:
- Period(s), IS/OOS boundaries:
- Costs modeled (spread, commission, swap):
- Preset & full parameter diff from defaults:

## 2. Headline results (OOS only)
| symbol | trades | meanR | win% | PF | Sharpe | maxDD% | worst day% |
|---|---|---|---|---|---|---|---|

## 3. Walk-forward
(paste walk_forward.py output; folds table + verdict)

## 4. Monte Carlo (risk sweep)
| risk/trade | pass% | fail daily% | fail overall% | DD p95 |
|---|---|---|---|---|

## 5. Sensitivity
- ±1-step perturbation: worst criterion change:
- ×1.5 spread: PF change:
- Neighbour symbol: expectancy:

## 6. Bias checklist
- [ ] Closed-bar signals verified (visual vs fast mode identical trades)
- [ ] Symbol list fixed before testing; all results reported, incl. failures
- [ ] OOS touched exactly once
- [ ] Costs at least as bad as live
- [ ] Trend, range and high-vol periods all covered

## 7. Verdict
GENERALISES / MARGINAL / REJECTED — with the failing gate(s) named.

*All figures are historical simulation measurements, not predictions or
guarantees. Risk of loss is entirely the operator's.*
```
