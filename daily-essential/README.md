# 📶 Daily Essential

**One short message a day, for K1 — on any phone in Zambia.**

Weather for your district, the price at your market, the copper price, the fuel
price, a health reminder, a fraud warning, a word of encouragement. Delivered
over **USSD**, **SMS** and **WhatsApp**, paid for with **prepaid credit** drawn
down K1 a day.

> **Status: working reference implementation.** Every external dependency —
> telco, payment provider, Meta — has a mock adapter, so the whole service runs
> and is testable with no accounts and no airtime. What stands between this and
> a live service is in [`docs/ROADMAP.md`](docs/ROADMAP.md), and what will stop
> you is in [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md).

---

## Run it in one minute

```bash
cd daily-essential
npm install
npm run seed      # 37 districts, today's bulletin, 5 subscribers
npm start         # http://localhost:5000
npm test          # 42 tests
```

Dial the USSD menu the way a gateway would:

```bash
# New caller — opt-in screen
curl -s localhost:5000/api/ussd -d 'sessionId=1&phoneNumber=0971234567&text='

# Accept, then read today's bulletin
curl -s localhost:5000/api/ussd -d 'sessionId=2&phoneNumber=0971234567&text=1'
curl -s localhost:5000/api/ussd -d 'sessionId=3&phoneNumber=0971234567&text=1'
```

Run the morning job and see the accounting:

```bash
npm run billing
```

---

## What it does today

| Capability | |
|---|---|
| Stateless USSD menu — opt-in, bulletin, topics, top-up, district, language, STOP | ✅ |
| Every screen fits 182 characters (enforced, and tested on every path) | ✅ |
| Prepaid credit ledger, integer ngwee, append-only, idempotent | ✅ |
| Daily K1 draw-down that cannot double-bill a retried cron | ✅ |
| 7-day free trial; out of credit means suspended, never in debt | ✅ |
| Mobile-money top-up bundles (K3 / K7 / K30 / K85) via a licensed PSP | ✅ |
| PSP settlement webhook — HMAC-verified, replay-safe | ✅ |
| WhatsApp Cloud API webhook — handshake, signature, keyword commands | ✅ |
| SMS digest assembled against a real segment budget, with GSM-7 normalisation | ✅ |
| Seven verticals: farming, mining, transport, health, encouragement, money, jobs | ✅ |
| District- and language-targeted content with national fallback | ✅ |
| Editorial approval workflow; health copy that reads as medical advice is refused | ✅ |
| Consent recorded and enforced on every outbound path; STOP works on all channels | ✅ |
| Resumable daily run that survives a serverless timeout | ✅ |
| Supabase Postgres schema + Row Level Security policies | ✅ |
| Vercel deployment config with authenticated cron | ✅ |
| Public landing page driven by the live catalogue | ✅ |

---

## Three decisions worth knowing before you read the code

### 1. Nothing pops up on anyone's phone

The original brief asked for the service to "pop up on all connected
smartphones and analogue phones". That cannot be built lawfully: USSD is
user-initiated, WhatsApp requires prior opt-in and approved templates, and
unsolicited SMS breaches both the Data Protection Act and the MNOs' own terms.

So the design is **opt-in first, then push**. `messaging.send()` refuses to
send to anyone whose consent is not recorded, and the tests assert it. Opt-in
is therefore the growth constraint, which is why distribution gets its own
roadmap phase instead of a bullet point.

### 2. K1/day is the price, but not the collection

A K1 mobile-money collection costs more in fees than it earns. Charging daily
would lose money on every subscriber, every day.

Instead, subscribers **buy days in a bundle** (K7 a week, K30 a month) and a
ledger draws K1 per delivered day. That takes collections from 365 a year to
roughly 12–52, and the fee from ~K0.27 per day to ~K0.06.

The balance is deliberately **not** a wallet: it buys this service only, cannot
be transferred and cannot be cashed out. That restriction is what keeps the
service outside e-money licensing — see
[`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) §2 before relaxing it.

### 3. The delivery cost decides whether this works at all

At retail bulk-SMS rates (the €0.07–0.10 per message in the original plan), a
two-segment daily digest costs roughly **K3.00** against **K1.00** of revenue.
Every subscriber added loses money, and scale makes it worse.

The business needs a wholesale rate near **K0.10–K0.20 per segment**, or the
default channel becomes USSD pull rather than SMS push. Getting that quote is
task one in [`docs/ROADMAP.md`](docs/ROADMAP.md), ahead of registering a
company. [`docs/UNIT_ECONOMICS.md`](docs/UNIT_ECONOMICS.md) works the numbers,
including a corrected version of the original revenue projection — break-even
is around **13,000–29,000 paying subscribers**, not 2.25 million.

---

## Layout

```
daily-essential/
├── server/
│   ├── app.js         HTTP surface (no listen — same app on Vercel and in tests)
│   ├── ussd.js        stateless menu; every screen ≤182 chars
│   ├── wallet.js      subscribers, consent, credit ledger, daily charge
│   ├── payments.js    PSP adapters, webhook verification, idempotent settlement
│   ├── whatsapp.js    Cloud API handshake, signature, keyword commands
│   ├── messaging.js   outbound SMS/WhatsApp; consent and duplicate gates
│   ├── content.js     digest assembly, segment budget, editorial approval
│   ├── billing.js     resumable daily run + revenue summary
│   ├── verticals.js   the seven services
│   ├── money.js       integer ngwee, formatting, bundles
│   └── db.js          local schema (mirrors the Supabase migration)
├── supabase/migrations/
│   ├── 0001_init.sql  authoritative production schema + charge_day()
│   └── 0002_rls.sql   Row Level Security by staff role
├── api/index.js       Vercel entry
├── public/            landing page
├── test/              42 tests
└── docs/              ARCHITECTURE · COMPLIANCE · UNIT_ECONOMICS · ROADMAP
```

---

## The stack, and where each piece belongs

| Piece | Role | The rule that matters |
|---|---|---|
| **GitHub** | Source of truth, CI, secret scanning | No `.env`, no keys, no subscriber data |
| **Supabase** | Postgres, RLS, auth for staff | Service-role key is server-side only, ever |
| **Vercel** | API + landing page + cron | Paid plan — Hobby is non-commercial |
| **Lovable** | Operator console, marketing site | Anon key only; never paste a secret into a prompt |
| **WhatsApp Cloud API** | Smartphone channel | Opt-in + approved templates, or the number gets blocked |
| **USSD/SMS aggregator** | Everyone else | This is the cost line the business lives or dies on |
| **Licensed PSP** | Collections | Merchant of record. We never hold a float |

---

## Configuration

Copy `.env.example` to `.env`. Everything has a working default: with no
variables set, all three integrations use mock adapters and the service is
fully demonstrable.

The ones that change behaviour most:

| Variable | Default | |
|---|---|---|
| `DAILY_PRICE_NGWEE` | `100` | K1.00/day. The landing page and USSD copy follow it |
| `TRIAL_DAYS` | `7` | Free days before the first charge |
| `MESSAGING_PROVIDER` | `mock` | `http` for a real aggregator |
| `PSP_PROVIDER` | `mock` | `http` for a real payment provider |
| `CRON_SECRET` | — | Vercel Cron sends it as a bearer token |
| `DE_DB` | `./data/…` | **Leave unset on Vercel** — use Supabase there |

---

## Deploying

**Vercel.** `vercel.json` routes `/api/*` to `api/index.js` and schedules the
daily run at `0 4 * * *` UTC — 06:00 Central Africa Time, which is when the
bulletin should land. Set every secret as an environment variable; the cron
route authenticates with `CRON_SECRET`.

**Supabase.** Apply `supabase/migrations/` in order. RLS is enabled on every
table holding personal data, and the money tables are read-only to every human
role — credit moves through the webhook and cron paths under the service role,
or not at all.

Before going live, work through the pre-launch gate in
[`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) §6. The short version: PACRA, ZRA,
Data Protection Commission, a licensed PSP, a ZICTA position on the short
code, MoH sign-off on health copy, and a scripture source you are actually
licensed to use.

---

## Licence

MIT, as with the rest of this repository.
