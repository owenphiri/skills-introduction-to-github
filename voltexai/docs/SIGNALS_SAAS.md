# Voltex Signals SaaS — setup

The managed pipeline: **TradingView → Voltex Signal Engine → Free/VIP + MT5**.
Everything works with no config (signals just log instead of posting to Telegram).
Add these in **Render → voltexai-api → Environment** to go live:

| Variable | Purpose |
|---|---|
| `TRADINGVIEW_WEBHOOK_SECRET` | shared secret TradingView must include in the alert body |
| `SIGNAL_MIN_SCORE` | minimum Voltex Quality Score to accept/publish (default 70) |
| `TELEGRAM_BOT_TOKEN` | BotFather token for `@VoltexAIForexBot` |
| `TELEGRAM_FREE_CHANNEL` | free channel `@handle` or `-100…` id |
| `TELEGRAM_VIP_CHANNEL` | VIP channel `@handle` or `-100…` id |
| `MT5_GATEWAY_KEY` | shared key the MT5 EA uses to pull signals / post events |

## TradingView alert
Webhook URL: `https://voltexai-api.onrender.com/api/pro-signals/webhook`
(TradingView needs ports 80/443 and a <3s response — the engine acks fast.)

Alert message (JSON):
```json
{
  "secret": "YOUR_TRADINGVIEW_WEBHOOK_SECRET",
  "symbol": "XAUUSD",
  "direction": "BUY",
  "timeframe": "15",
  "entry": 3385.50,
  "sl": 3378.50,
  "strategy": "Voltex AI SwingMaster",
  "session": "London",
  "signal_id": "XAUUSD-20260825-001",
  "htf": true, "liquidity": true, "ob": true, "fvg": true,
  "trend": true, "momentum": true
}
```
The engine computes TP1–TP4 (1:R ladder), the Voltex Quality Score + grade,
rejects setups below `SIGNAL_MIN_SCORE`, dedupes by `signal_id`, stores the
signal, and posts the basic card to Free and the full setup to VIP.
**Never put broker/MT5 credentials in the webhook.**

## MT5 EA (gateway key)
- Pull active signals: `GET /api/pro-signals/mt5/pull` with header `X-Gateway-Key: <key>`
- Report a lifecycle event: `POST /api/pro-signals/{uuid}/events` with `X-Gateway-Key`
  body `{ "event": "filled|tp1|tp2|tp3|tp4|be|closed|cancelled", "price": …, "result_r": … }`
- Report an execution: `POST /api/pro-signals/mt5/execution` with `X-Gateway-Key`

## Feed & VIP gating
- `GET /api/pro-signals/feed` — free users get a preview (entry + TP1); VIP
  (Trader/Elite plan) or admins get the full entry zone, SL and TP2–TP4.
- `GET /api/pro-signals/performance` — win rate, profit factor, total R, weekly report.
- Admin can post a manual signal: `POST /api/pro-signals` (JWT, admin role).
