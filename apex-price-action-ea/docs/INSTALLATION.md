# Installation Guide

## Requirements

- MetaTrader 5 build 3800+ (economic calendar API used by the news filter)
- Windows, or Linux/macOS via the official MT5 under Wine (prop firms usually hand
  you Windows credentials; a Windows VPS is the standard deployment)
- Python 3.10+ (optional, only for the validation toolkit — stdlib only, no pip installs)

## 1. Copy the source

Open your terminal's data folder (MT5 → `File → Open Data Folder`) and merge this
repository's `MQL5/` tree into it:

```
<DataFolder>/MQL5/Experts/ApexPriceAction/ApexPriceAction.mq5
<DataFolder>/MQL5/Include/ApexPA/**            (all 17 .mqh files)
```

The include path must be exactly `MQL5/Include/ApexPA/...` — the EA includes files
with angle brackets (`#include <ApexPA/Core/Definitions.mqh>`).

## 2. Compile

1. Open MetaEditor (F4 from the terminal).
2. Open `Experts/ApexPriceAction/ApexPriceAction.mq5`.
3. Press **F7**. Expected result: `0 errors, 0 warnings`.

## 3. Terminal permissions

- `Tools → Options → Expert Advisors`:
  - ✅ Allow algorithmic trading
  - ❌ Allow WebRequest — **not needed**; the EA makes no web calls.
- The chart's Algo Trading button must be enabled (green).

## 4. Attach to a chart

1. Open the instrument you want to trade (reference configs: **EURUSD M15**,
   **XAUUSD M15**, **US30 M5**).
2. Drag `ApexPriceAction` onto the chart.
3. Click **Load** in the inputs tab and select a preset from `presets/`:
   - firm presets (e.g. `FTMO_100k_Challenge.set`) set the compliance rules;
   - instrument presets (e.g. `Instrument_Gold_XAUUSD.set`) set trading behaviour.
   Load the instrument preset first, then set `InpPropFirm` to your firm.
4. Set `InpInitialBalance` to your **challenge starting balance** if the account
   traded before the EA was attached (otherwise leave 0 = current balance).
5. Confirm the dashboard appears top-left and shows `TRADING` (or a labelled
   pause reason).

## 5. Chart & timeframe

The chart timeframe does **not** matter — the EA reads all timeframes it needs via
its multi-timeframe stack. `InpExecutionTF` controls the actual signal timeframe.
Keep the chart on the execution TF anyway so the dashboard context matches what
you see.

## 6. VPS deployment checklist

- One chart per symbol; same magic number is fine (positions are symbol-scoped),
  but use distinct magics per symbol if your firm audits by magic.
- Terminal auto-restart: ApexPA reconstructs closed-trade history gracefully, but
  open-position metadata (entry reason) is memory-held — after a restart, exits
  still log with `n/a (restarted)` reasons. Statistics remain correct.
- Logs: `MQL5/Files/ApexPA/logs/` (daily files) and CSVs in `MQL5/Files/ApexPA/`.
- Sync VPS clock; session filters use broker time, the fallback news windows use GMT.

## 7. Uninstall

Remove the EA from the chart (dashboard objects clean themselves up), then delete
the `Experts/ApexPriceAction` and `Include/ApexPA` folders. CSV/log exports stay in
`MQL5/Files/ApexPA/` until you delete them.
