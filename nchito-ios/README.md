# Nchito 🇿🇲 — Zambia's Gig & Quick-Task App (iOS)

**Find work. Get paid. Instantly.**

Nchito ("work" in Nyanja) is a hyperlocal marketplace that connects Zambians who need everyday tasks done — deliveries, tutoring, repairs, design, events — with workers who get paid **straight to MTN MoMo, Airtel Money or Zamtel Kwacha**, plus a Quick Tasks feed (surveys, app testing, data labelling) anyone can earn from on day one.

> Why this niche, how it monetizes, and the go-to-market plan: see **[STRATEGY.md](STRATEGY.md)**.

## App tour

| Tab | What it does |
|---|---|
| **Gigs** | Searchable, filterable feed of local gigs across 8 categories; boosted gigs are paid placements. Post a gig via the ➕ toolbar button (escrow pricing, urgency flag, K25 boost upsell). |
| **Quick Tasks** | Micro-tasks paying K10–K70 each — the zero-skill entry point and passive-earning feed. |
| **Chats** | In-app messaging between posters and workers, with gig context on every thread; start a chat from any gig's "Message" button. |
| **Wallet** | Live balance, transaction history, instant cash-out sheet to any of the 3 mobile-money providers. |
| **Profile** | Ratings, NRC verification tier, skills, the referral engine (K20/friend + 2% of their rewards), and sign-out. |

Before the tabs, users onboard and **sign in with phone + OTP** — no passwords or email. With `SupabaseConfig.swift` filled in this runs against Supabase GoTrue; left empty the app stays in demo mode (any number, code `123456`).

Key mechanics already modelled in code: **10% platform commission** with escrow-protected payouts (`Gig.workerPayout`), boost monetization, referral earnings, and verification tiers.

## Project structure

```
nchito-ios/
├── project.yml              # XcodeGen spec — generates Nchito.xcodeproj
├── STRATEGY.md              # Niche research, monetization, go-to-market
├── supabase/                # Backend: schema migration, RLS, seed data, setup guide
└── Nchito/
    ├── NchitoApp.swift      # Entry point (onboarding → auth → tabs)
    ├── Theme.swift          # Zambian-flag palette + shared components
    ├── Models/              # Gig, MicroTask, Wallet, User, Chat domain models
    ├── Services/
    │   ├── AppState.swift        # Observable app state (swap for API client later)
    │   ├── AuthService.swift     # Phone-OTP auth (Supabase GoTrue via URLSession)
    │   ├── SupabaseConfig.swift  # Project URL + anon key (empty = demo mode)
    │   └── MockDataService.swift # Realistic Lusaka/Kitwe/Ndola seed data
    └── Views/               # Onboarding, auth, tabs, gig detail, post, chat, wallet, profile
```

The Android port lives in [`../nchito-android/`](../nchito-android/) — same product spec in Jetpack Compose.

## Build & run

Requires **Xcode 15+** (iOS 17 SDK). The project file is generated with [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```bash
brew install xcodegen
cd nchito-ios
xcodegen generate
open Nchito.xcodeproj   # then ⌘R on any iPhone simulator
```

No third-party dependencies — pure SwiftUI, so it builds out of the box. The app runs fully offline on mock data (`MockDataService`), which makes it perfect for demos, App Store screenshots, and investor pitches while the backend is being built.

## Roadmap to production

1. ~~Phone-OTP auth~~ ✅ (`AuthService` — demo mode until Supabase is configured)
2. ~~Supabase backend schema~~ ✅ (`supabase/` — apply the migration, enable phone auth, fill in `SupabaseConfig`)
3. ~~In-app chat~~ ✅ (mock transport; wire to Supabase Realtime per `supabase/README.md`)
4. ~~Android build~~ ✅ ([`../nchito-android/`](../nchito-android/))
5. Replace `MockDataService` reads/writes with Supabase queries (PostgREST) in `AppState`.
6. Mobile-money escrow + disbursements via an aggregator (Flutterwave/Lenco or direct MTN & Airtel APIs) from Edge Functions.
7. NRC verification (Smile ID), dispute flow, push notifications.
