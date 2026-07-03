# Optimization Guide

## Philosophy: optimise as little as possible

Every optimised parameter is a degree of freedom the market can invalidate. ApexPA
is deliberately built so that most inputs are **structural** (volatility- and
R-normalised) and should not be optimised at all. The custom `OnTester` criterion
(`expectancy × √trades × min(PF,3) × DD-penalty`) already punishes fragile,
high-DD parameter sets — use it as the optimisation criterion (`Custom max`).

## What may be optimised (narrow ranges)

| Input | Sane range | Step |
|---|---|---|
| `InpMinConfluence` | 0.55 – 0.72 | 0.02 |
| `InpMinRR` | 1.2 – 2.5 | 0.25 |
| `InpSwingStrength` | 2 – 5 | 1 |
| `InpHTFConviction` | 0.2 – 0.5 | 0.1 |
| `InpSLBufferVol` | 0.25 – 0.6 | 0.05 |
| `InpBETriggerR` | 0.8 – 1.5 | 0.25 |
| `InpPartialTriggerR` | 1.0 – 2.0 | 0.25 |

That is ~7 dimensions; keep total combinations under ~20k and use the genetic
optimizer.

## What must NOT be optimised

- Risk percentages and DD buffers (chosen by the firm's rules, not by curve fit).
- Session hours (chosen by market microstructure knowledge, verified — not mined).
- Strategy on/off flags per symbol may be *selected* from walk-forward evidence,
  but never toggled to chase one good year.

## Procedure (parameter stability first)

1. **Split data**: e.g. 2019-2022 in-sample (IS), 2023-2025 out-of-sample (OOS).
   Do not run the OOS window until step 5.
2. Run the genetic optimisation on IS with `Custom max`.
3. **Reject sharp peaks**: for each surviving set, perturb every optimised input
   by ±1 step. If the criterion drops by more than ~30%, the set is a spike —
   discard it. Prefer plateaus over peaks, even lower ones.
4. Pick the 3–5 most *stable* sets, not the highest scoring one.
5. Run each once on OOS (real ticks). No re-tuning afterwards — if all fail,
   the concept failed; go back to strategy research, not to the optimizer.
6. Feed all runs' CSVs to `tools/validation/walk_forward.py` (it ranks parameter
   sets by cross-fold consistency) and `validation_report.py`.

## Sensitivity analysis

Beyond ±1-step perturbation, check *cross-condition* sensitivity:

- same set, different symbol of the same class (EURUSD ↔ GBPUSD);
- same set, execution TF one notch up/down;
- same set, spread multiplied ×1.5 (tester "spread" field).

Robust sets degrade gracefully in all three; overfit sets collapse in at least one.

## Frequency of re-optimisation

Quarterly at most, and only re-select among *pre-registered* candidate sets using
the newest walk-forward fold. Re-optimising after every losing week is data
snooping with extra steps and will eat the account via regime whipsaw.
