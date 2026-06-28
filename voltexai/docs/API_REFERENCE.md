# VoltexAI API Reference

Base URL (dev): `http://localhost:8000`
Auth: Bearer JWT in `Authorization` header (except public routes).
Interactive docs: `GET /docs` (Swagger UI) when the server is running.

---

## Auth — `/api/auth`

### `POST /register` (public)
```json
{
  "email": "owen@example.com",
  "password": "min8chars",
  "full_name": "Owen Phiri",
  "country": "Zambia",
  "phone": "+260977..."
}
```
Returns `{ access_token, refresh_token, token_type: "bearer" }`.

### `POST /login` (public)
```json
{ "email": "...", "password": "..." }
```
Returns the same token pair.

### `POST /refresh` (public)
```json
{ "refresh_token": "..." }
```
Returns a new token pair.

### `POST /logout` (auth)
Returns 204. Stateless JWT — the client discards tokens.

### `GET /me` (auth)
Returns:
```json
{
  "id": 1, "email": "...", "full_name": "...", "country": "...",
  "phone": "...", "plan": "free|trader|elite",
  "plan_status": "active|past_due|cancelled|expired",
  "is_verified": false, "created_at": "..."
}
```

### `POST /forgot` (public)
```json
{ "email": "..." }
```
Always returns 202 (anti-enumeration). In dev, the reset token is printed to the server console.

### `POST /reset` (public)
```json
{ "token": "...", "new_password": "min8chars" }
```

---

## AI — `/api/ai` (all auth-required, all rate-limited)

### `POST /chat`
```json
{
  "mode": "terminal | analysis | signals | academy",
  "message": "...",
  "conversation_id": null
}
```
Returns:
```json
{ "conversation_id": 7, "reply": "...", "tokens_in": 120,
  "tokens_out": 450, "quota_remaining": 9 }
```

### `POST /stream`
Same body. Returns `text/event-stream` with `data: {"type":"delta","text":"..."}` chunks and a final `data: {"type":"done","tokens_in":...,"tokens_out":...}`. Response header `X-Conversation-Id` carries the convo id.

### `POST /signal`
```json
{ "pair": "XAUUSD", "timeframe": "M15", "context": "" }
```
Returns:
```json
{ "signal": { ...strict JSON schema... },
  "tokens_in": 200, "tokens_out": 320 }
```

### `POST /analyze-chart`
```json
{
  "image_b64": "iVBORw0KG...",
  "media_type": "image/png",
  "instruction": "Run analysis",
  "pair": "XAUUSD",
  "conversation_id": null
}
```
Same response shape as `/chat`.

### `GET /quota`
```json
{ "used": 3, "limit": 10, "remaining": 7 }
```

### `GET /conversations`
List of `{id, title, mode, updated_at}`.

### `GET /conversations/{id}`
Full convo with messages.

### `DELETE /conversations/{id}`
Returns 204.

---

## Payments — `/api/payments`

### `GET /plans` (public)
Array of `{id, name, usd, zmw, ai_calls_per_day, features[]}`.

### `POST /stripe/checkout` (auth)
```json
{ "plan": "trader | elite" }
```
Returns `{ "checkout_url": "https://checkout.stripe.com/...", "session_id": "..." }`. Redirect the user to `checkout_url`.

### `POST /flutterwave/checkout` (auth)
```json
{ "plan": "trader | elite", "currency": "ZMW", "phone": "+260977..." }
```
Returns `{ "checkout_url": "...", "tx_ref": "VOLTX-...", "amount": 768.50, "currency": "ZMW" }`.

### `POST /stripe/webhook` (public, signature-verified)
Handles:
- `checkout.session.completed` → activate plan
- `customer.subscription.deleted | paused` → downgrade to free
- `invoice.payment_failed` → mark past_due (logged for now)

### `POST /flutterwave/webhook` (public, hash-verified)
Handles:
- `charge.completed` (status=successful) → server-side verify → activate plan
- `subscription.cancelled` → downgrade to free

### `POST /cancel` (auth)
Cancels the user's current paid subscription. Returns `{ "message": "..." }`.

---

## Error format
All errors return `{ "detail": "human readable reason" }` with appropriate HTTP status.
- 401 → expired/invalid token (frontend auto-refreshes once, then routes to `/login`)
- 402 → plan upgrade required
- 429 → daily AI quota exhausted
- 502 → upstream (Anthropic / Stripe / FLW) failure
