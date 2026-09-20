# Nchito 🇿🇲 — Zambia's Gig & Quick-Task App (iOS)

**Find work. Get paid. Instantly.**

Nchito ("work" in Nyanja) is a hyperlocal marketplace that connects Zambians who need work done — bricklaying, plumbing, catering, tailoring, teaching, design, deliveries, **39 services in all** — with workers who get paid **straight to MTN MoMo, Airtel Money or Zamtel Kwacha**, plus a Quick Tasks feed (surveys, app testing, data labelling) anyone can earn from on day one.

> **Try it now: https://nchito-nu.vercel.app** — the PWA runs the same demo data as this app, installs to a home screen, and works offline.
>
> Why this niche, how it monetizes, and the go-to-market plan: see **[STRATEGY.md](STRATEGY.md)**.
> What to build next so competitors can't copy us: see **[INNOVATION.md](INNOVATION.md)**.

## App tour

| Tab | What it does |
|---|---|
| **Gigs** | Searchable feed of local gigs across **39 services in 8 families**; pick a family, then the service. Boosted gigs are paid placements. Post a gig via the ➕ toolbar button (escrow pricing, urgency flag, K25 boost upsell). |
| **Quick Tasks** | Micro-tasks paying K10–K70 each — the zero-skill entry point and passive-earning feed. |
| **Chats** | In-app messaging between posters and workers, with gig context on every thread; start a chat from any gig's "Message" button. |
| **Wallet** | Live balance, transaction history, any outstanding early payment, and an instant cash-out sheet to all 3 mobile-money providers. |
| **Find cash near you** | From Wallet — which mobile-money agents actually have float right now, crowdsourced from other workers, with how fresh each report is. |
| **Early payment** | On a gig you've started — take up to half your payout now for a flat fee, repaid automatically at settlement ([why it isn't a loan](INNOVATION.md)). |
| **Profile** | Ratings, NRC verification tier, skills, the referral engine (K20/friend + 2% of their rewards), and sign-out. |
| **Phone & USSD** | Reached from Profile — set the PIN that authorises cash-out from any handset by dialling `*384*62448#`, no app and no data needed ([channel functions](supabase/functions/)). |
| **Work Record** | Reached from Profile — a signed, append-only history of every escrow-settled job, with a reliability score, opt-in share link, and one-tap **CV export as a PDF**. |

Before the tabs, users onboard and **sign in with phone + OTP** — no passwords or email. With `SupabaseConfig.swift` filled in this runs against Supabase GoTrue; left empty the app stays in demo mode (any number, code `123456`).

The web PWA at [`../nchito-web/`](../nchito-web/) is the quickest way to see all of this working — no toolchain required.

Key mechanics already modelled in code: **loyalty-decaying commission** (10% → 7% → 5% as a poster and worker build history, so going off-platform stops paying), **proof-of-work capture** gating escrow release, **fair-price bands** from comparable settled gigs, boost monetization, referral earnings, and verification tiers. See [INNOVATION.md](INNOVATION.md) for why each exists.

## Project structure

```
nchito-ios/
├── project.yml              # XcodeGen spec — generates Nchito.xcodeproj
├── STRATEGY.md              # Niche research, monetization, go-to-market
├── supabase/                # Backend: schema migrations, RLS, Edge Functions, setup guide
└── Nchito/
    ├── NchitoApp.swift      # Entry point (onboarding → auth → tabs)
    ├── Theme.swift          # Zambian-flag palette + shared components
    ├── Models/              # Gig, MicroTask, Wallet, User, Chat domain models
    │   └── ServiceCatalog.swift  # GENERATED from ../../nchito-shared/taxonomy.json
    ├── Services/
    │   ├── AppState.swift        # Observable app state, async loads, optimistic writes
    │   ├── NchitoAPI.swift       # PostgREST + RPC + Storage over URLSession
    │   ├── Repository.swift      # NchitoRepository protocol + MockRepository
    │   ├── LiveRepository.swift  # The Supabase-backed implementation
    │   ├── AuthService.swift     # Phone-OTP auth (Supabase GoTrue via URLSession)
    │   ├── SupabaseConfig.swift  # Project URL + anon key (empty = demo mode)
    │   └── MockDataService.swift # Realistic Lusaka/Kitwe/Ndola seed data
    └── Views/               # Onboarding, auth, tabs, gig detail, post, chat, wallet, profile
```

The Android port lives in [`../nchito-android/`](../nchito-android/) and the web PWA in [`../nchito-web/`](../nchito-web/) — same product spec, three platforms.

## Build & run

Requires **Xcode 15+** (iOS 17 SDK). The project file is generated with [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```bash
brew install xcodegen
cd nchito-ios
xcodegen generate
open Nchito.xcodeproj   # then ⌘R on any iPhone simulator
```

No third-party dependencies — pure SwiftUI, so it builds out of the box.

## Demo mode vs. live

The app picks its backend at runtime from `SupabaseConfig.swift`:

| | `SupabaseConfig` empty | filled in |
|---|---|---|
| Data | `MockRepository` over the seed data | `LiveRepository` over Supabase |
| Sign-in | any Zambian number, code `123456` | real phone OTP |
| Writes | in memory | PostgREST + Postgres functions |

Both go through the same `NchitoRepository` protocol, so demo mode exercises the identical code paths — it isn't a separate, rotting branch of the app. That keeps it usable for pitches, App Store screenshots and offline development while the backend is live for real users.

### Going live

1. Apply all eight migrations in [`supabase/migrations/`](supabase/migrations/) **in order and separately** — `0008` uses enum values that `0007` creates, and Postgres will not allow that inside one transaction. Then set the Work Record signing secret (see [`supabase/README.md`](supabase/README.md)).
2. Enable phone auth with an SMS provider that reaches +260.
3. Create a **`proofs`** storage bucket (private) for proof-of-work photos.
4. Paste your project URL and anon key into `SupabaseConfig.swift`.

Writes that carry rules — applying, taking an advance, setting a PIN, sharing a Work Record — go through Postgres functions rather than direct table writes, because commission tiering, proof gates and PIN checks live there and must not be re-implemented, or skippable, on the client.

## Roadmap to production

1. ~~Phone-OTP auth~~ ✅ (`AuthService` — demo mode until Supabase is configured)
2. ~~Supabase backend schema~~ ✅ (`supabase/` — apply the migration, enable phone auth, fill in `SupabaseConfig`)
3. ~~In-app chat~~ ✅ (mock transport; wire to Supabase Realtime per `supabase/README.md`)
4. ~~Android build~~ ✅ ([`../nchito-android/`](../nchito-android/))
5. ~~Phase 1 defensibility~~ ✅ — loyalty-decaying commission, proof-of-work capture, fair-price bands (`0002_phase1_defensibility.sql`)
6. ~~Work Record~~ ✅ — signed, append-only work history with CV export and opt-in sharing (`0003_work_record.sql`; set the signing secret per `supabase/README.md`)
7. ~~Live Supabase data~~ ✅ — repository layer with live and mock implementations; proof photos upload to the `proofs` bucket
8. Mobile-money escrow + disbursements via an aggregator (Flutterwave/Lenco or direct MTN & Airtel APIs) from Edge Functions.
9. ~~WhatsApp/USSD layer~~ ✅ — Edge Functions in [`supabase/functions/`](supabase/functions/); deploy and register a shortcode per that README
10. ~~Earned wage access~~ ✅ — advances against escrow, gated on proof-of-work and Work Record standing (`0005_wage_advances.sql`)
11. ~~Agent liquidity map~~ ✅ — crowdsourced agent float with time-decayed confidence (`0006_agent_liquidity.sql`)
12. ~~Service taxonomy~~ ✅ — 39 categories in 8 families, generated from [`../nchito-shared/taxonomy.json`](../nchito-shared/) into all five surfaces (`0007`, `0008`)
13. NRC verification (Smile ID), dispute flow, push notifications.
