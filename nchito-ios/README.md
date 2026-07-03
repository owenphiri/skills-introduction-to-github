# Nchito 🇿🇲 — Zambia's Gig & Quick-Task App (iOS)

**Find work. Get paid. Instantly.**

Nchito ("work" in Nyanja) is a hyperlocal marketplace that connects Zambians who need everyday tasks done — deliveries, tutoring, repairs, design, events — with workers who get paid **straight to MTN MoMo, Airtel Money or Zamtel Kwacha**, plus a Quick Tasks feed (surveys, app testing, data labelling) anyone can earn from on day one.

> Why this niche, how it monetizes, and the go-to-market plan: see **[STRATEGY.md](STRATEGY.md)**.

## App tour

| Tab | What it does |
|---|---|
| **Gigs** | Searchable, filterable feed of local gigs across 8 categories; boosted gigs are paid placements. |
| **Quick Tasks** | Micro-tasks paying K10–K70 each — the zero-skill entry point and passive-earning feed. |
| **Post** | Post a gig with escrow pricing, urgency flag and a K25 "boost to top" upsell. |
| **Wallet** | Live balance, transaction history, instant cash-out sheet to any of the 3 mobile-money providers. |
| **Profile** | Ratings, NRC verification tier, skills, and the referral engine (K20/friend + 2% of their rewards). |

Key mechanics already modelled in code: **10% platform commission** with escrow-protected payouts (`Gig.workerPayout`), boost monetization, referral earnings, and verification tiers.

## Project structure

```
nchito-ios/
├── project.yml              # XcodeGen spec — generates Nchito.xcodeproj
├── STRATEGY.md              # Niche research, monetization, go-to-market
└── Nchito/
    ├── NchitoApp.swift      # Entry point (onboarding gate)
    ├── Theme.swift          # Zambian-flag palette + shared components
    ├── Models/Models.swift  # Gig, MicroTask, Wallet, User domain models
    ├── Services/
    │   ├── AppState.swift        # Observable app state (swap for API client later)
    │   └── MockDataService.swift # Realistic Lusaka/Kitwe/Ndola seed data
    └── Views/               # Onboarding, tabs, gig detail, post, wallet, profile
```

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

1. Phone-OTP auth + backend (Supabase/Firebase MVP) — replace `MockDataService`.
2. Mobile-money escrow + disbursements via an aggregator (Flutterwave/Lenco or direct MTN & Airtel APIs).
3. NRC verification (Smile ID), in-app chat, dispute flow.
4. Push notifications for applications, awards and escrow releases.
5. Android build (this spec, in Kotlin/Flutter) — ~90% of Zambian smartphones are Android.
