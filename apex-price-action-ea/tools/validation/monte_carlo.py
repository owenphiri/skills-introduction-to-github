#!/usr/bin/env python3
"""Monte Carlo simulation over an ApexPA trade log.

Resamples the observed per-trade R-multiples (bootstrap with replacement,
plus optional trade-order shuffling) to estimate the DISTRIBUTION of
outcomes rather than the single realized equity curve:

  - probability of hitting the profit target before the max-drawdown limit
    (i.e. estimated challenge pass rate)
  - drawdown distribution (median / p95 / worst)
  - profit distribution over N trades

Usage:
  python monte_carlo.py trades_EURUSD.csv --risk 0.5 --target 10 --daily-dd 5 \
      --overall-dd 10 --runs 10000 --trades-per-day 2

The input CSV is the trades_<symbol>.csv exported by the EA
(semicolon-separated, column `r_multiple`), or any CSV with an
`r_multiple` (or `r`) column.
"""
from __future__ import annotations

import argparse
import csv
import random
import statistics
import sys
from dataclasses import dataclass


def load_r_multiples(path: str) -> list[float]:
    rs: list[float] = []
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        sample = f.read(4096)
        f.seek(0)
        delim = ";" if sample.count(";") >= sample.count(",") else ","
        reader = csv.DictReader(f, delimiter=delim)
        col = None
        for candidate in ("r_multiple", "r", "R", "r_mult"):
            if reader.fieldnames and candidate in reader.fieldnames:
                col = candidate
                break
        if col is None:
            raise SystemExit(f"No r_multiple column found in {path}. Columns: {reader.fieldnames}")
        for row in reader:
            try:
                rs.append(float(row[col]))
            except (TypeError, ValueError):
                continue
    if len(rs) < 20:
        print(f"WARNING: only {len(rs)} trades - results will be statistically weak (need 100+).",
              file=sys.stderr)
    return rs


@dataclass
class RunResult:
    passed: bool
    busted_daily: bool
    busted_overall: bool
    final_gain_pct: float
    max_dd_pct: float
    trades_used: int


def simulate_run(rs: list[float], risk_pct: float, target_pct: float,
                 daily_dd_pct: float, overall_dd_pct: float,
                 trades_per_day: int, max_trades: int) -> RunResult:
    equity = 100.0
    hwm = equity
    day_anchor = equity
    max_dd = 0.0
    trades = 0
    day_trades = 0

    while trades < max_trades:
        r = random.choice(rs)
        equity += risk_pct * r  # risk_pct of (initial-normalized) equity per unit R
        trades += 1
        day_trades += 1

        hwm = max(hwm, equity)
        max_dd = max(max_dd, (hwm - equity) / hwm * 100.0)

        # daily limit check
        if day_anchor - equity >= daily_dd_pct:
            return RunResult(False, True, False, equity - 100.0, max_dd, trades)
        # overall limit (static from initial)
        if 100.0 - equity >= overall_dd_pct:
            return RunResult(False, False, True, equity - 100.0, max_dd, trades)
        # target
        if equity - 100.0 >= target_pct:
            return RunResult(True, False, False, equity - 100.0, max_dd, trades)

        if day_trades >= trades_per_day:
            day_trades = 0
            day_anchor = equity  # new trading day: anchor resets to current equity

    return RunResult(False, False, False, equity - 100.0, max_dd, trades)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", help="trades CSV exported by ApexPA")
    ap.add_argument("--risk", type=float, default=0.5, help="risk %% per trade (default 0.5)")
    ap.add_argument("--target", type=float, default=10.0, help="profit target %% (default 10)")
    ap.add_argument("--daily-dd", type=float, default=5.0, help="max daily DD %% (default 5)")
    ap.add_argument("--overall-dd", type=float, default=10.0, help="max overall DD %% (default 10)")
    ap.add_argument("--runs", type=int, default=10000, help="simulation runs (default 10000)")
    ap.add_argument("--trades-per-day", type=int, default=2, help="assumed trades per day (default 2)")
    ap.add_argument("--max-trades", type=int, default=400, help="max trades per run (default 400)")
    ap.add_argument("--seed", type=int, default=None, help="RNG seed for reproducibility")
    args = ap.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    rs = load_r_multiples(args.csv)
    print(f"Loaded {len(rs)} trades | mean R = {statistics.mean(rs):+.3f} | "
          f"stdev = {statistics.pstdev(rs):.3f} | win rate = "
          f"{sum(1 for r in rs if r > 0) / len(rs) * 100:.1f}%")

    results = [simulate_run(rs, args.risk, args.target, args.daily_dd,
                            args.overall_dd, args.trades_per_day, args.max_trades)
               for _ in range(args.runs)]

    passed = sum(1 for r in results if r.passed)
    busted_d = sum(1 for r in results if r.busted_daily)
    busted_o = sum(1 for r in results if r.busted_overall)
    timeout = args.runs - passed - busted_d - busted_o
    dds = sorted(r.max_dd_pct for r in results)
    gains = sorted(r.final_gain_pct for r in results)
    t_used = statistics.mean(r.trades_used for r in results)

    print()
    print("=== Monte Carlo (bootstrap of observed R distribution) ===")
    print(f"runs: {args.runs} | risk/trade: {args.risk}% | target: {args.target}% | "
          f"limits: {args.daily_dd}% daily / {args.overall_dd}% overall")
    print(f"PASS (target reached first) : {passed / args.runs * 100:6.1f}%")
    print(f"FAIL daily DD               : {busted_d / args.runs * 100:6.1f}%")
    print(f"FAIL overall DD             : {busted_o / args.runs * 100:6.1f}%")
    print(f"UNRESOLVED within {args.max_trades} trades: {timeout / args.runs * 100:6.1f}%")
    print(f"avg trades to resolution    : {t_used:.0f}")
    print(f"max DD  median / p95 / worst: {dds[len(dds)//2]:.1f}% / "
          f"{dds[int(len(dds)*0.95)]:.1f}% / {dds[-1]:.1f}%")
    print(f"gain    p5 / median / p95   : {gains[int(len(gains)*0.05)]:+.1f}% / "
          f"{gains[len(gains)//2]:+.1f}% / {gains[int(len(gains)*0.95)]:+.1f}%")
    print()
    print("NOTE: these are resampled projections of PAST results, not predictions.")


if __name__ == "__main__":
    main()
