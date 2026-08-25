# VoltexAI MT5 Expert Advisor

Auto-executes Voltex Signals on MetaTrader 5: pulls active signals from the API,
opens **risk-sized** trades across the **TP1–TP4 ladder**, moves the remaining
stops to break-even after TP1, and reports every fill/TP/close back to the API
(which pushes the update to your Telegram VIP channel).

## Install
1. Copy `VoltexAI_EA.mq5` into `MQL5/Experts/` (MT5 → File → **Open Data Folder**).
2. In **MetaEditor**, open it and press **Compile** (F7).
3. In MT5: **Tools → Options → Expert Advisors →** tick **“Allow WebRequest for
   listed URL”** and add your API host, e.g. `https://voltexai-api.onrender.com`.
4. Drag **VoltexAI_EA** onto any chart and set the inputs.

## Inputs
| Input | Meaning |
|---|---|
| `ApiBase` | API base URL (must be WebRequest-whitelisted) |
| `GatewayKey` | must equal the server's `MT5_GATEWAY_KEY` |
| `RiskPercent` | total % of balance risked per signal (split across TPs) |
| `TpCount` | how many of TP1–TP4 to trade (1–4) |
| `MaxSpreadPoints` | skip entries when the spread is wider than this |
| `PollSeconds` | how often to poll for new signals |
| `MagicNumber` | EA order magic |
| `MoveToBEAfterTP1` | move remaining stops to entry after TP1 hits |

## How it works
- Polls `GET /api/pro-signals/mt5/pull` (header `X-Gateway-Key`).
- For each new signal it opens up to `TpCount` positions (one per TP), each
  `RiskPercent / TpCount` of the risk, all sharing the signal's stop loss.
- Lot size = `(balance × RiskPercent%) / (SL distance × tick value)` per tranche.
- On a TP/SL close it reports `tp1..tp4` / `sl` / `closed` via
  `POST /api/pro-signals/{uuid}/events`; after TP1 it break-evens the rest.

## Safety
- Test on a **demo account** first. Never hard-code broker passwords anywhere.
- The EA only ever trusts the API over HTTPS with the gateway key; it does not
  read signals from Telegram or webhooks directly.
- Automated trading carries a high risk of loss — size responsibly.
