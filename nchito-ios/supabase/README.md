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

## How the pieces map

| Table / function | Used by |
|---|---|
| `profiles` (+ signup trigger) | Auth, profile screen, ratings, referral codes |
| `gigs`, `gig_applications` | Gig feed, apply flow, poster's applicant review |
| `micro_tasks`, `task_completions` | Quick Tasks feed; `campaign_sponsor` is the B2B revenue line |
| `wallet_transactions`, `wallet_balance()` | Wallet screen (append-only ledger — never update balances in place) |
| `release_escrow(gig_id)` | Poster confirms job done → worker paid `pay × 0.90` via RPC |
| `conversations`, `messages` (realtime) | In-app chat; clients subscribe to `postgres_changes` on `messages` |

## Money movement (important)

The wallet ledger tracks *entitlements*. Actual kwacha moves through a licensed mobile-money aggregator (Flutterwave, Lenco, or direct MTN MoMo / Airtel Money APIs) called from a Supabase Edge Function:

- **Escrow-in:** poster pays → aggregator webhook → insert `escrow_in` transaction.
- **Cash-out:** worker requests → Edge Function calls aggregator disbursement → insert negative `cash_out` transaction on success.

Never call aggregator APIs from the app with secret keys; keep them in Edge Function secrets.
