#!/usr/bin/env python3
"""Walk-forward / in-sample vs out-of-sample analysis of ApexPA trade logs.

Splits the chronological trade series into K contiguous folds and compares
performance across folds to detect:

  - performance decay (edge fading over time)
  - overfitting (great early folds = the ones parameters were tuned on,
    poor later folds)
  - parameter instability (if you pass multiple CSVs from different
    parameter sets, it ranks their cross-fold consistency)

Typical workflow:
  1. Optimize in MT5 on the in-sample window only (e.g. 2019-2022).
  2. Run the strategy tester on the out-of-sample window (2023-2025)
     WITHOUT re-optimizing, exporting trades_<symbol>.csv per run.
  3. python walk_forward.py trades_EURUSD.csv --folds 6

A robust strategy shows: positive expectancy in most folds, no dramatic
first-fold-to-last-fold decay, and low variance of fold Sharpe.
"""
from __future__ import annotations

import argparse
import csv
import math
import statistics
import sys


def load_rows(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        sample = f.read(4096)
        f.seek(0)
        delim = ";" if sample.count(";") >= sample.count(",") else ","
        rows = list(csv.DictReader(f, delimiter=delim))
    if not rows:
        raise SystemExit(f"{path}: empty file")
    return rows


def r_series(rows: list[dict]) -> list[float]:
    col = next((c for c in ("r_multiple", "r", "R") if c in rows[0]), None)
    if col is None:
        raise SystemExit(f"No r_multiple column. Columns: {list(rows[0])}")
    out = []
    for row in rows:
        try:
            out.append(float(row[col]))
        except (TypeError, ValueError):
            continue
    return out


def fold_stats(rs: list[float]) -> dict:
    n = len(rs)
    if n == 0:
        return {"n": 0, "mean_r": 0.0, "win": 0.0, "sharpe": 0.0, "pf": 0.0}
    mean = statistics.mean(rs)
    sd = statistics.pstdev(rs) or 1e-9
    wins = [r for r in rs if r > 0]
    losses = [-r for r in rs if r < 0]
    pf = (sum(wins) / sum(losses)) if losses and sum(losses) > 0 else math.inf
    return {
        "n": n,
        "mean_r": mean,
        "win": len(wins) / n * 100,
        "sharpe": mean / sd * math.sqrt(n),
        "pf": pf,
    }


def analyze(path: str, folds: int) -> dict:
    rs = r_series(load_rows(path))
    if len(rs) < folds * 10:
        print(f"WARNING: {path}: {len(rs)} trades over {folds} folds is thin "
              f"(<10/fold); reduce --folds or extend the test.", file=sys.stderr)
    size = max(1, len(rs) // folds)
    stats = []
    print(f"\n=== {path} | {len(rs)} trades | {folds} folds ===")
    print(f"{'fold':>4} {'trades':>7} {'meanR':>8} {'win%':>7} {'PF':>7} {'Sharpe':>8}")
    for k in range(folds):
        chunk = rs[k * size: (k + 1) * size if k < folds - 1 else len(rs)]
        s = fold_stats(chunk)
        stats.append(s)
        pf = f"{s['pf']:.2f}" if math.isfinite(s["pf"]) else "inf"
        print(f"{k + 1:>4} {s['n']:>7} {s['mean_r']:>+8.3f} {s['win']:>7.1f} {pf:>7} {s['sharpe']:>8.2f}")

    means = [s["mean_r"] for s in stats if s["n"] > 0]
    positive = sum(1 for m in means if m > 0)
    consistency = positive / len(means) if means else 0
    decay = (means[-1] - means[0]) if len(means) >= 2 else 0.0
    var = statistics.pstdev(means) if len(means) > 1 else 0.0

    print(f"\nfolds with positive expectancy : {positive}/{len(means)} ({consistency*100:.0f}%)")
    print(f"first->last fold meanR change  : {decay:+.3f}")
    print(f"cross-fold meanR stdev         : {var:.3f}")
    verdict = "ROBUST" if consistency >= 0.7 and decay > -0.15 else \
              "MARGINAL" if consistency >= 0.5 else "LIKELY OVERFIT / NO EDGE"
    print(f"verdict                        : {verdict}")
    return {"consistency": consistency, "decay": decay, "var": var, "verdict": verdict}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csvs", nargs="+", help="one or more trades CSVs (different runs/parameter sets)")
    ap.add_argument("--folds", type=int, default=5, help="number of chronological folds (default 5)")
    args = ap.parse_args()

    results = {path: analyze(path, args.folds) for path in args.csvs}

    if len(results) > 1:
        print("\n=== Parameter-set stability ranking (higher consistency, lower variance = better) ===")
        ranked = sorted(results.items(),
                        key=lambda kv: (-kv[1]["consistency"], kv[1]["var"]))
        for i, (path, r) in enumerate(ranked, 1):
            print(f"{i}. {path}: consistency={r['consistency']*100:.0f}% "
                  f"var={r['var']:.3f} -> {r['verdict']}")


if __name__ == "__main__":
    main()
