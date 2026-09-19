# Nchito Android 🇿🇲

Jetpack Compose port of the [Nchito iOS app](../nchito-ios/) — same product spec, same Zambian-flag design language, same mock data, targeting the ~90% of Zambian smartphones that run Android.

## What's included

- **Phone-OTP sign-in** (demo mode: any Zambian number, code `123456`; goes live by filling in `data/SupabaseConfig.kt`)
- **Gig feed** with search, category chips, featured/urgent badges, and gig detail with escrow explainer
- **Post a gig** bottom sheet with the K25 boost upsell
- **Quick Tasks** micro-earning feed with wallet-credited rewards
- **Wallet** with balance card, provider picker (MTN MoMo / Airtel Money / Zamtel Kwacha) and cash-out sheet
- **In-app chat** — conversation list + message thread, reachable from any gig's "Message" button
- **Profile** with referral share sheet (Android share intent → WhatsApp etc.) and sign-out
- **Phone & USSD access** — set the PIN that authorises cash-out from any handset via `*384*62448#`, no data needed
- **Find cash near you** — which agents actually have float now, crowdsourced, with report counts and freshness shown so uncertainty is never hidden
- **Early payment** — on a gig you've started, take up to half your payout now for a flat fee, repaid automatically at settlement
- **Work Record** — signed, append-only history of every escrow-settled job, with reliability score, opt-in share link and PDF CV export (shared via FileProvider)
- **Loyalty-decaying commission** (10% → 7% → 5% as a pair builds history), **proof-of-work capture** gating escrow release, and **fair-price bands** on the post form — see [INNOVATION.md](../nchito-ios/INNOVATION.md)

## Build & run

Open `nchito-android/` in **Android Studio** (Hedgehog or newer). It will provision the Gradle wrapper automatically; then just Run ▶ on any device/emulator (minSdk 24).

From the command line (with Gradle 8.7+ installed): `gradle :app:assembleDebug`.

## Demo mode vs. live

The app picks its backend at runtime from `data/SupabaseConfig.kt`: empty means `MockRepository` over the seed data and OTP `123456`; filled in means `LiveRepository` over Supabase with real phone OTP. Both sit behind the same `NchitoRepository` interface, so demo mode exercises the identical code paths rather than being a separate branch that rots.

Going live needs the same four steps as iOS — see [that README](../nchito-ios/README.md#going-live).

## Architecture

Single-module Compose app. `AppViewModel` holds UI state and delegates all I/O to a `NchitoRepository`; `NchitoApi` speaks PostgREST over `HttpURLConnection` with kotlinx-serialization for JSON. Mirrors the iOS layering:

- Auth → Supabase GoTrue phone OTP (`POST /auth/v1/otp`, `/auth/v1/verify`)
- Data → the schema in [`../nchito-ios/supabase/migrations/0001_init.sql`](../nchito-ios/supabase/migrations/0001_init.sql)
- Chat → insert into `messages`, subscribe via Supabase Realtime
- Cash-out → Edge Function calling a mobile-money aggregator (see [`../nchito-ios/supabase/README.md`](../nchito-ios/supabase/README.md))
