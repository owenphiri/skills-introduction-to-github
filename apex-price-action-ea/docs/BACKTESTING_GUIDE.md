# Backtesting Guide

## Ground rules

A backtest is only as honest as its data and costs. For a system meant to keep a
prop account alive, **pessimistic assumptions are mandatory**:

- **Real ticks** (`Every tick based on real ticks`), never "Open prices only" —
  the EA's stop/partial/trailing logic is intra-bar.
- **Variable spread** — real-tick mode replays recorded spreads. If your broker's
  history lacks them, test with a fixed spread set to your symbol's *worst regular*
  spread, not its best.
- **Commission & swap** — set the tester commission to your firm's actual
  round-turn cost (e.g. $7/lot on raw accounts).
- Model slippage mentally: assume every result would be a few percent worse.

## Tester setup

1. Strategy Tester (Ctrl+R) → Expert: `ApexPriceAction`.
2. Symbol/period: the symbol you'll trade; the tester chart period is irrelevant
   (the EA uses `InpExecutionTF` internally) but set it to the execution TF for
   sane visualisation.
3. Modelling: `Every tick based on real ticks`.
4. Dates: minimum 3 years, covering distinct regimes (e.g. 2020 vol, 2021 trend,
   2022 rates, 2023-24 chop).
5. Deposit: your challenge size; leverage as per firm (1:100 typical).
6. Load the matching preset from `presets/` via the Inputs tab.

## What to record per run

The EA writes its own artifacts (in the tester these land under
`Tester/<agent>/MQL5/Files/ApexPA/`, collected into the run's Files snapshot):

- `trades_<symbol>.csv` — feed this to the validation toolkit.
- `events_<symbol>.csv` — audit why entries were blocked; a healthy run shows many
  BLOCK rows (the risk engine doing its job).

From the tester report itself record: net profit, PF, max balance & equity DD (%),
total trades, and the custom `OnTester` criterion value.

## Acceptance thresholds (evaluation-sized accounts)

| Metric | Minimum |
|---|---|
| Trades in test window | ≥ 100 |
| Profit factor | ≥ 1.3 |
| Max equity DD | < ½ of firm's overall limit (e.g. <5% for a 10% rule) |
| Worst daily loss in `report_daily.csv` | < firm daily limit minus buffer |
| Expectancy (avg R) | > +0.15R |
| Longest losing streak | survivable at your risk % (streak × risk < daily limit) |

A run that fails any row is not a candidate for live evaluation, regardless of
its net profit.

## Tick-by-tick vs faster modes

Use `1 minute OHLC` only for coarse parameter sweeps in the optimizer, then
**re-verify every surviving parameter set on real ticks**. Results that don't
survive the switch were artifacts, not edge.

## Common pitfalls

- **Testing only bull years** on indices/crypto — include 2022.
- **Fixed 1-pip spread on gold/indices** — wildly optimistic; use real ticks.
- **Judging by net profit** — a 40% return with 9% DD fails a 10%-rule challenge
  in the tail; judge by DD-adjusted metrics (`OnTester` criterion already does).
- **Changing inputs after seeing the full-period result** — that's in-sample
  contamination; follow `WALK_FORWARD_GUIDE.md`.
