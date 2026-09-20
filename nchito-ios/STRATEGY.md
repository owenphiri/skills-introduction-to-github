# Nchito — Product & Growth Strategy

*"Nchito" means **work** in Nyanja/Chewa. Tagline: **Find work. Get paid. Instantly.** 🇿🇲*

## 1. The niche (and why it wins)

Research on Zambia's 2025–2026 digital economy points to one under-served gap:

- **~74% of Zambian adults** are now covered by mobile money (MTN MoMo, Airtel Money, Zamtel Kwacha) — the payment rail already exists.
- **~52% of urban Zambians** are actively looking for supplementary income online; the average Lusaka salary (K4,500–8,500) barely covers the ~K5,200 monthly food basket for a family of four.
- Micro-task earners on foreign platforms make K800–2,500/month, but cash-out to Zambian wallets is painful and nothing serves **local, in-person gigs** (deliveries, repairs, tutoring, events, beauty).
- Upwork/Fiverr skim off the top ~1% of English-fluent digital freelancers, pay in dollars via hard-to-access channels, and completely ignore the offline gig economy.

**Nchito's niche: the hyperlocal gig + micro-task marketplace with instant kwacha payouts to mobile money.** One app serves both the "I need K150 by Friday" worker and the "I need a poster designed / a parcel delivered today" poster.

## 2. The features that drive traffic

| Feature | Why it matters in Zambia |
|---|---|
| **Instant mobile-money cash-out** | The #1 trust signal. Money you can't withdraw isn't money. |
| **Escrow payments** | Solves the "will I get paid / will they do the work" problem that kills informal hiring. |
| **Quick Tasks feed** (surveys, app testing, data labelling, mystery shopping) | Zero-skill entry point — anyone earns K10–70 on day one, which drives word-of-mouth. |
| **NRC verification + ratings** | Trust layer for in-person gigs; verified users get zero cash-out fees (a strong verification incentive). |
| **Referral engine** | K20 per activated friend **+ 2% of their task rewards for 3 months** — a genuinely passive income stream that makes every user a marketer. WhatsApp-native share flow. |
| **Boosted listings** | Posters pay K25 to feature a gig for 48h — monetization that improves liquidity instead of taxing it. |
| **Low-data mode** | Data bundles are a real cost; a light app is a competitive feature, not a nice-to-have. |
| **Urgency + streaks** | Urgent badges and daily task streaks create the habit loop that keeps DAU high. |

## 3. How the app makes money (including passively for the owner)

1. **10% commission** on every escrowed gig (industry-standard 10–20%; start low to win liquidity).
2. **Boost fees** — K25/48h featured placement; later, subscription tiers for heavy posters (agencies, SMEs).
3. **B2B micro-task campaigns** — companies pay Nchito to distribute surveys, app tests, mystery shopping and data-labelling work; Nchito keeps a 30–40% margin. This is the *passive* engine: campaigns run themselves once sold.
4. **Float interest & payout spread** (later, with proper licensing) on wallet balances.
5. **Sponsored categories / local ads** once traffic justifies it.

## 4. Go-to-market

- **Phase 1 (Lusaka only):** seed supply with 200 hand-recruited workers (university WhatsApp groups, UNZA/CBU notice boards); seed demand by giving 50 SMEs free boosted posts. Density in one city beats thin national coverage.
- **Phase 2 (Copperbelt):** Kitwe + Ndola, driven by referral codes — every cash-out screen and share sheet pushes the referral loop.
- **Phase 3:** Livingstone/tourism gigs, then cross-border (Malawi, Zimbabwe — same mobile-money dynamics).
- **App Store + Play Store:** this SwiftUI codebase is the iOS flagship; note that ~90% of Zambian smartphones are Android, so the Android build (Kotlin Multiplatform or Flutter port of this exact spec) should follow within one release cycle. ASO keywords: *make money Zambia, gigs Lusaka, piece jobs, kwacha, MoMo jobs*.

## 5. Production architecture (next steps)

The app currently runs on `MockDataService` so the full product experience is demoable offline. To ship:

1. **Backend:** Supabase or Firebase for MVP (auth via phone OTP, Postgres/Firestore, push). Graduate to a small API (Node/Go) when escrow logic matures.
2. **Payments:** mobile-money aggregator (Flutterwave, Lenco, or direct MTN MoMo & Airtel Money open APIs) for collections (escrow-in) and disbursements (cash-out). Register with the Bank of Zambia as required for holding customer funds — or partner with a licensed PSP to avoid the licensing burden early.
3. **Verification:** phone OTP at signup; NRC photo + selfie match (e.g. Smile ID, which covers Zambia) for the verified tier.
4. **Trust & safety:** in-app chat with content moderation, dispute flow on escrow release, panic/report button for in-person gigs.
5. **Analytics:** PostHog/Amplitude funnels on signup → first task → first cash-out (the activation metric that predicts retention).

## 6. Legal notes (do these before launch)

- Register the business (PACRA) and check ZICTA requirements for the platform.
- Money movement must run through a licensed partner until/unless Nchito obtains its own Bank of Zambia PSP designation.
- Publish clear terms: Nchito is a marketplace, workers are independent contractors; escrow terms and dispute resolution spelled out.

## Sources

- [Make Money Online Zambia 2026: 7 Proven Methods (Beezy)](https://blog.iambeezy.app/en/making-money-online-zambia-lusaka-kitwe-2026/)
- [6 Ways to Earn Money Online in Zambia in 2025 (Spocket)](https://www.spocket.co/blogs/how-to-earn-money-online-in-zambia)
- [Best Online Jobs Zambians Can Do From Home in 2026 (ZED Gossip)](https://zedgossip.net/best-online-jobs-zambians-can-do-from-home-in-2026-legit-ways-to-earn-money/)
- [Freelancers in Zambia (Truelancer)](https://www.truelancer.com/freelancers-in-zambia)
- [Hire freelancers in Zambia (Upwork)](https://www.upwork.com/hire/zm/)
