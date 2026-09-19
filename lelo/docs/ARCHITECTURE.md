# Architecture

## The shape of the problem

Lelo sells one short message a day for K1. Three constraints follow
from that sentence, and everything below is a consequence of them.

1. **Revenue per user per day is K1.** Anything that costs more than a few
   ngwee per subscriber per day has to be designed out, not optimised later.
2. **Most of the audience is not on a smartphone.** The primary channel has to
   be USSD and SMS. WhatsApp is an upgrade for the subset who have it, not the
   foundation.
3. **Trust is the product.** A service that debits people unexpectedly, or
   messages them without asking, dies in a week in a market where word of
   mouth is the distribution channel.

## Two data layers, one schema

| | Local / CI | Production |
|---|---|---|
| Engine | `node:sqlite` (built into Node 22.5+) | Supabase Postgres |
| Defined in | `server/db.js` | `supabase/migrations/0001_init.sql` |
| Purpose | run and test with no accounts | the real thing |

Table and column names are identical on both sides. `0001_init.sql` is
authoritative; when the two disagree, the migration wins and `db.js` is the
one that gets fixed.

The local layer exists so the service is runnable — `npm install && npm run
seed && npm start` gives you a working USSD menu, billing engine and daily run
with no Supabase project, no telco contract and no Meta app. That property is
worth protecting: it is what lets someone evaluate the system in five minutes.

**On Vercel, do not point `LELO_DB` anywhere.** The serverless filesystem is
ephemeral and per-invocation; a SQLite file written there vanishes and is not
shared between concurrent invocations. A Vercel deployment must run against
Supabase.

## Request paths

```
                    ┌──────────────────────────────┐
   any handset ───▶ │ USSD aggregator              │──▶ POST /api/ussd
                    └──────────────────────────────┘      (stateless menu)

                    ┌──────────────────────────────┐
   any handset ◀─── │ SMS aggregator               │◀── daily run
                    └──────────────────────────────┘──▶ POST /api/sms/inbound
                                                        POST /api/sms/dlr

                    ┌──────────────────────────────┐
   smartphone  ◀──▶ │ WhatsApp Cloud API (Meta)    │──▶ GET|POST /api/whatsapp/webhook
                    └──────────────────────────────┘

                    ┌──────────────────────────────┐
   mobile money ──▶ │ licensed PSP                 │──▶ POST /api/payments/webhook
                    └──────────────────────────────┘

   Vercel Cron 04:00 UTC (06:00 CAT) ─────────────────▶ GET /api/cron/daily
```

## The USSD menu is stateless

Gateways resend the full accumulated input on every step (`"3*2*1"`), so the
menu in `server/ussd.js` is a pure function of that path. Nothing is read back
from a session store.

This is not a micro-optimisation. It means a dropped gateway session, a
failover between instances, a cold start, or a redeploy mid-menu all behave
identically — the next step resolves correctly because there is no state to
have lost. `ussd_sessions` rows are written for analytics and nothing reads
them.

The cost is that every screen must be self-contained, and every screen must fit
**182 characters**. `respond()` enforces the limit rather than trusting the
copy, and a test walks every menu path asserting it.

## Money

Amounts are **integer ngwee** (1 ZMW = 100 ngwee) in the database, in the
ledger, and in API payloads. Kwacha appear only when a human reads them.
Floating-point rounding spread across a million daily K1 charges is a
reconciliation problem with no clean way back.

`ledger_entries` is append-only and carries a unique `ref` that doubles as the
idempotency key:

| Movement | `ref` |
|---|---|
| Daily charge | `day:<subscriber>:<date>` |
| Top-up | `pay:<psp_ref>` |
| Give-back | `rev:<subscriber>:<date>` |

So a cron that fires twice bills once, and a PSP that retries its webhook five
times credits once. Both are covered by tests, because both *will* happen.

`wallet_accounts.balance_ngwee` is a cache of the ledger, written in the same
transaction. If they ever disagree, the ledger is right.

### Charge first, deliver second

`server/billing.js` charges before it sends. If delivery then fails, the day is
given back with a `reversal` entry. The other order — deliver, then charge —
loses the money whenever the second step fails, and there is no way to
un-deliver an SMS.

The same reversal runs when nothing was published for a subscriber's topics
that day. They paid for a bulletin; no bulletin, no charge.

## The digest fits a budget

The daily SMS is assembled against an explicit character budget in
`server/content.js`, not hoped to be short enough. Two details earn their
place:

- **GSM-7 normalisation.** One em dash or curly apostrophe — the kind a paste
  from a press release carries in invisibly — forces the whole message to
  UCS-2 and cuts the payload from 306 characters to 134. Content is normalised
  on ingest. Characters with no safe equivalent (Bemba `ŋ`) are left alone and
  correctly force UCS-2, because mangling a word to save a segment is not a
  trade worth making.
- **Drop rather than stub.** An item that cannot keep ~70% of itself is
  dropped and named in `dropped`, because "licence renewals close end of."
  tells a miner nothing and still costs a segment.

A third segment is a 50% cost increase per subscriber per day, forever. That
is the whole margin.

## The daily run is resumable

`runDaily()` takes `afterId` and returns `lastId` and `done`. A serverless
invocation has a wall-clock limit measured in seconds; a subscriber base
measured in hundreds of thousands does not fit inside one. The caller loops
until `done`, and a timeout mid-run costs nothing because the ledger's
idempotency keys make the next attempt safe.

At real scale this moves off Vercel Cron onto a queue with a worker pool —
the batch interface is already the right shape for that.

## Consent is a gate, not a field

`messaging.send()` refuses to send to any subscriber whose `consent_at` is
null or whose status is `stopped`, whatever the caller asked for. WhatsApp
needs a second, separate opt-in on top. There is no code path that pushes to a
number that has not asked, and the tests assert it.

This is also why the USSD menu shows un-consented callers the opt-in screen and
nothing else: consent is the front door, not a checkbox further down the
funnel.

## Where the front end fits

The marketing page in `public/` is static and reads `/api/catalog`, so price,
topics and bundles are never duplicated in markup.

A richer operator console (content calendar, approval queue, subscriber
lookup, revenue dashboard) is a good fit for **Lovable** building against
Supabase directly, with RLS doing the authorisation — see
`supabase/migrations/0002_rls.sql`. Keep two rules:

- The Lovable front end uses the **anon key only**. The service-role key
  bypasses RLS and must never reach a browser bundle.
- Balances move through the webhook and cron paths under the service role, or
  not at all. A console that can hand out credit by hand is a fraud exposure
  and an audit finding — the RLS policies make the money tables read-only to
  every human role.
