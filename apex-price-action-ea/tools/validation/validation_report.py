#!/usr/bin/env python3
"""Generate a consolidated strategy validation report (Markdown) from
ApexPA trade logs across symbols / periods / parameter sets.

Combines:
  - headline statistics per file (expectancy, PF, Sharpe, max losing streak)
  - walk-forward fold consistency (via walk_forward.analyze)
  - Monte Carlo pass/bust estimates (via monte_carlo.simulate_run)
  - bias checklist reminders (look-ahead, survivorship, data snooping)

Usage:
  python validation_report.py trades_EURUSD.csv trades_XAUUSD.csv \
      --risk 0.5 --target 10 --daily-dd 5 --overall-dd 10 -o VALIDATION_RESULTS.md
"""
from __future__ import annotations

import argparse
import datetime as dt
import math
import random
import statistics

import monte_carlo as mc
import walk_forward as wf


def headline(path: str) -> dict:
    rs = wf.r_series(wf.load_rows(path))
    s = wf.fold_stats(rs)
    streak = worst = 0
    for r in rs:
        streak = streak + 1 if r < 0 else 0
        worst = max(worst, streak)
    s["max_loss_streak"] = worst
    s["total_r"] = sum(rs)
    return s


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csvs", nargs="+")
    ap.add_argument("--risk", type=float, default=0.5)
    ap.add_argument("--target", type=float, default=10.0)
    ap.add_argument("--daily-dd", type=float, default=5.0)
    ap.add_argument("--overall-dd", type=float, default=10.0)
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--runs", type=int, default=5000)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("-o", "--out", default="VALIDATION_RESULTS.md")
    args = ap.parse_args()

    random.seed(args.seed)
    lines: list[str] = []
    lines.append("# ApexPA Strategy Validation Results")
    lines.append(f"\nGenerated: {dt.datetime.now():%Y-%m-%d %H:%M} | "
                 f"risk={args.risk}%/trade, target={args.target}%, "
                 f"limits={args.daily_dd}%/{args.overall_dd}%\n")
    lines.append("| file | trades | meanR | win% | PF | Sharpe | worst streak | WF verdict | MC pass% |")
    lines.append("|---|---|---|---|---|---|---|---|---|")

    for path in args.csvs:
        h = headline(path)
        w = wf.analyze(path, args.folds)
        rs = wf.r_series(wf.load_rows(path))
        results = [mc.simulate_run(rs, args.risk, args.target, args.daily_dd,
                                   args.overall_dd, 2, 400) for _ in range(args.runs)]
        pass_pct = sum(1 for r in results if r.passed) / args.runs * 100
        pf = f"{h['pf']:.2f}" if math.isfinite(h["pf"]) else "inf"
        lines.append(f"| {path} | {h['n']} | {h['mean_r']:+.3f} | {h['win']:.1f} | {pf} | "
                     f"{h['sharpe']:.2f} | {h['max_loss_streak']} | {w['verdict']} | {pass_pct:.0f}% |")

    lines.append("""
## Interpretation gates

A configuration is considered deployable only if ALL of the following hold:

1. **Sample size** >= 100 trades in the combined test period.
2. **Walk-forward**: >= 70% of folds with positive expectancy, no severe decay.
3. **Monte Carlo pass estimate** >= 60% at the intended risk per trade.
4. **Out-of-sample** (untouched period) expectancy positive.
5. **Tick-quality data**: results reproduced on real-tick, variable-spread data.

## Bias checklist (must be re-verified for every study)

- [ ] No look-ahead: signals only use closed bars (engine-enforced, verify in tester).
- [ ] No survivorship bias: symbol list chosen before, not after, seeing results.
- [ ] No data snooping: parameters chosen on in-sample only; out-of-sample touched once.
- [ ] Costs modeled: commission, swap, variable spread, slippage included.
- [ ] Regime coverage: test window includes trending, ranging, and high-vol periods.

*All figures are measurements of historical simulations - not guarantees of
future performance.*
""")

    with open(args.out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"\nWrote {args.out}")


if __name__ == "__main__":
    main()
