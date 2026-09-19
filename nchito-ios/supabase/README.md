# Nchito Supabase backend

One migration sets up the entire MVP backend: profiles auto-created on phone-OTP signup, gigs + applications, micro-task campaigns, an append-only wallet ledger with an escrow-release RPC, and realtime chat — all locked down with Row Level Security.

## Setup (~15 minutes)

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine for MVP).
2. **Enable phone auth:** Dashboard → Authentication → Providers → Phone. Pick an SMS provider — **Twilio Verify** is the simplest that delivers to Zambian numbers (+260). Africa's Talking can be wired in later via a send-SMS hook for cheaper local rates.
3. **Apply the schema:** paste `migrations/0001_init.sql` into the SQL editor and run it, then run `seed.sql`. (Or use the CLI: `supabase db push`.)
4. **Point the apps at your project:** copy the *Project URL* and *anon public key* from Settings → API into:
   - iOS: `Nchito/Services/SupabaseConfig.swift`
   - Android: `app/src/main/java/com/owenphiri/nchito/data/SupabaseConfig.kt`

Until you fill those in, both apps run in **demo mode** (any phone number, OTP `123456`, mock data) so the full product remains demoable with zero setup.

## Required: the Work Record signing secret

Work Record entries are HMAC-signed so a shared record can be proven unaltered. Set the secret once, before applying `0003_work_record.sql`:

```sql
alter database postgres set app.settings.work_record_secret = '<random 32+ byte string>';
```

Generate one with `openssl rand -base64 48`. Keep it out of the apps and out of version control — it never leaves the database. `release_escrow()` raises rather than writing an unsigned entry if it's missing, because a record that looks verifiable but proves nothing is worse than no record at all.

Rotating this secret invalidates every signature already issued, so treat it as permanent.

## Storage bucket

Proof-of-work photos upload to a bucket named **`proofs`**. Create it as **private** — these are photos of people's homes and workplaces, and the gig parties are the only ones who should see them. The apps write objects at `<gig_id>/<before|after>.jpg`.

## Offline channels

USSD and WhatsApp run as Edge Functions in [`functions/`](functions/) — deployment, secrets and the security model are documented there. They use the service role and therefore bypass RLS, so they go through the `channel_*` RPCs in `0004_offline_channels.sql`, which authorise by phone number themselves.

## How the pieces map

| Table / function | Used by |
|---|---|
| `profiles` (+ signup trigger) | Auth, profile screen, ratings, referral codes |
| `gigs`, `gig_applications` | Gig feed, apply flow, poster's applicant review |
| `micro_tasks`, `task_completions` | Quick Tasks feed; `campaign_sponsor` is the B2B revenue line |
| `wallet_transactions`, `wallet_balance()` | Wallet screen (append-only ledger — never update balances in place) |
| `release_escrow(gig_id)` | Poster confirms job done → proof checked, commission tiered, worker paid, Work Record entry written |
| `work_records`, `verify_work_record()` | The Work Record — append-only, signed, one entry per settled gig |
| `public_work_record(slug)` | What a verifier sees at `nchito.zm/w/<slug>`; granted to `anon` so the table itself stays closed |
| `set_work_record_sharing()` | Opt in/out of sharing, or rotate the slug to revoke a link |
| `proof_of_work`, `price_band()` | Proof capture gating release; comparable-gig pricing |
| `conversations`, `messages` (realtime) | In-app chat; clients subscribe to `postgres_changes` on `messages` |

## Money movement (important)

The wallet ledger tracks *entitlements*. Actual kwacha moves through a licensed mobile-money aggregator (Flutterwave, Lenco, or direct MTN MoMo / Airtel Money APIs) called from a Supabase Edge Function:

- **Escrow-in:** poster pays → aggregator webhook → insert `escrow_in` transaction.
- **Cash-out:** worker requests → Edge Function calls aggregator disbursement → insert negative `cash_out` transaction on success.

Never call aggregator APIs from the app with secret keys; keep them in Edge Function secrets.
