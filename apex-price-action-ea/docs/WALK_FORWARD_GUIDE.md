# Walk-Forward & Validation Guide

The tooling lives in `tools/validation/` (Python 3.10+, stdlib only).

## 1. Walk-forward analysis

**Goal:** show the edge persists on data the parameters never saw.

### Rolling scheme

```
|---- IS window (optimize) ----|-- OOS (trade) --|
        |---- IS window (optimize) ----|-- OOS --|
                |---- IS window (optimize) ----|-- OOS --|
```

Suggested: 24-month IS, 6-month OOS, rolled every 6 months across ≥4 windows.

### Procedure

1. For each window, optimise on IS only (see `OPTIMIZATION_GUIDE.md`), freeze the
   chosen set, run the tester on the OOS segment, and keep the exported
   `trades_<symbol>.csv` (rename per window, e.g. `wf1_trades_EURUSD.csv`).
2. Concatenate the OOS trade files chronologically — this *stitched OOS curve* is
   the only honest estimate of live behaviour.
3. Analyse:

```bash
python tools/validation/walk_forward.py wf_all_EURUSD.csv --folds 6
```

Output: per-fold expectancy/win%/PF/Sharpe, consistency score, decay measure and a
verdict (`ROBUST` / `MARGINAL` / `LIKELY OVERFIT`).

### Pass criteria

- ≥ 70% of folds with positive expectancy;
- no catastrophic first→last decay (edge should not exist only in the early data);
- every individual OOS window's max DD inside the firm's limits.

## 2. Monte Carlo simulation

**Goal:** turn one realized sequence into a distribution — the single backtest
ordering of wins/losses is luck; the distribution isn't.

```bash
python tools/validation/monte_carlo.py trades_EURUSD.csv \
    --risk 0.5 --target 10 --daily-dd 5 --overall-dd 10 --runs 10000
```

Reports: estimated challenge pass rate, daily-vs-overall bust split, drawdown
median/p95/worst, gain percentiles. Use it to choose risk per trade: pick the
highest risk whose **p95 drawdown stays under half the firm's overall limit**.

## 3. Cross-validation across instruments

Run identical settings on 3+ symbols of the class you trade. An edge that only
exists on one symbol of a correlated set is more likely noise. Use
`validation_report.py` to consolidate:

```bash
python tools/validation/validation_report.py trades_EURUSD.csv trades_GBPUSD.csv \
    trades_XAUUSD.csv --risk 0.5 -o VALIDATION_RESULTS.md
```

## 4. Bias defences built into the process

| Bias | Defence |
|---|---|
| Look-ahead | Engines use closed bars only; swings need N right-side bars; verify by comparing visual-mode and fast-mode results. |
| Curve fitting | Plateau selection + perturbation test + WF consistency verdict. |
| Data snooping | OOS windows touched exactly once; candidate sets pre-registered. |
| Survivorship | Symbol list fixed before testing; report *all* tested symbols in the validation report, including failures. |
| Regime luck | Folds span trend/range/high-vol years; regime tags in the CSV let you audit per-regime expectancy. |

## 5. Forward test (demo)

Before any paid evaluation: **≥ 2 weeks demo forward test** with the exact preset.
Compare demo fills, spread and slippage columns against backtest assumptions; if
live costs are >30% worse than modeled, re-run Monte Carlo with the observed
distribution before proceeding.
