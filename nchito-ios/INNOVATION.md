# Nchito — Innovation Roadmap

*How Nchito stops being "another gig app" and becomes infrastructure Zambians can't work without.*

This document is the strategic layer above [STRATEGY.md](STRATEGY.md). Strategy says *which market*; this says *what to build so nobody can copy us.*

---

## 0. The one number that should scare us

A Harvard case study found roughly **90% of freelance jobs initiated on a platform were completed off-platform**, and documented research puts disintermediation at up to 18% of transactions on mature marketplaces.

Nchito's entire revenue model is a 10% commission on escrowed gigs. If a poster and worker meet through us, swap numbers, and settle in cash, **we earn zero and never find out.** In Zambia this is the default behaviour, not the exception — cash is culturally normal and MoMo has a per-transaction fee that makes cash feel cheaper.

Everything in Tier 1 below exists to make staying on Nchito *more valuable than leaving*. Policing doesn't work; economics does.

---

## Tier 1 — Existential. Build these or the business leaks to death.

### 1.1 Loyalty-decaying commission ("the longer you stay, the less we take")

Flat 10% forever is an ever-growing incentive to defect. Instead, the rate falls as a poster–worker pair builds history:

| Completed gigs (same pair) | Commission |
|---|---|
| 1–2 | 10% |
| 3–9 | 7% |
| 10+ | 5% |

At 5%, the hassle of going off-platform (no escrow, no recourse, no record) stops being worth the saving. We trade headline rate for retained volume — and volume is what makes a marketplace defensible.

*Implementation:* a `pair_completions` count on `gig_applications`; `release_escrow()` reads it to compute the rate instead of the hardcoded `0.90`.

### 1.2 The Nchito Work Record — our real moat

**The insight:** Zambia's informal workers have no verifiable work history. A domestic cleaner with eight years of excellent service has nothing to show a new employer, a bank, or a landlord. Nothing.

Nchito can mint that. Every completed, escrow-released gig writes an immutable, cryptographically-signed entry: what was done, for whom, when, rated how, paid how much, on time or not. The worker can then:

- Export it as a **PDF CV** for formal job applications
- Share a **public verification link or QR code** (`nchito.zm/w/OWEN260`) that an employer can check
- Use it as **collateral for credit** — a thin-file borrower with 200 verified gigs is not thin-file any more

This is the anti-leakage weapon that needs no enforcement: *work done off-platform doesn't count.* Leave, and you stop building the only asset that compounds. It's also the thing no foreign competitor can replicate — it requires local density and local trust.

It is, in the long run, worth more than the commission. A verified-work-history rail for the informal economy is a data business banks will pay for.

### 1.3 Guarantees that only exist on-platform

Off-platform has no recourse. Make that asymmetry loud:
- **No-show protection** — worker doesn't arrive, we refund and re-match free within 24h
- **Payment guarantee** — poster vanishes, Nchito still pays the worker from escrow
- **Free micro-accident cover** on in-person gigs (partner with a local insurer; costs pennies per gig, enormous trust signal)

Surface these as a "🛡 Protected by Nchito" badge on every escrowed gig, with the exact kwacha amount at risk if they go around us.

---

## Tier 2 — Reach. These multiply the addressable market.

### 2.1 USSD + WhatsApp shadow interface — *the biggest single unlock*

Smartphone ownership is a fraction of mobile ownership, and research on African super-apps is blunt: many users still rely on **USSD and feature phones**, so platforms need offline or low-data paths.

Nchito should not require the app:
- **USSD** (`*384*NCHITO#`) — browse gigs near you, apply, check wallet balance, cash out. Works on a K150 feature phone with no data.
- **WhatsApp bot** — the channel Zambians actually coordinate work in. Post a gig by messaging the bot; get matched gigs pushed to you; apply with one reply.

This roughly triples the reachable user base and makes gigs shareable into the WhatsApp groups where hustles already circulate. **This is the growth channel, not paid ads.**

### 2.2 Voice-first and vernacular (Nyanja, Bemba, Tonga, Lozi)

Typing a gig description in English excludes a huge share of the market. Let a poster **speak** their gig — AI transcribes, translates, categorises and price-bands it. Let workers hear gig listings read aloud in their language.

Beyond access, this is a moat: a competitor entering Zambia has to rebuild vernacular voice handling from scratch.

### 2.3 Offline-first everything

Queue applications, messages and task submissions locally; sync when signal returns. Show honest "will send when you're back online" state. Zambian connectivity is intermittent — an app that dies without bars loses to cash.

---

## Tier 3 — Money. Deepen the wallet until leaving is unthinkable.

### 3.1 Agent liquidity map — *solves a problem nobody else touches*

Field reporting on Zambian mobile money puts it perfectly: **"a wallet credit you cannot convert is not the same thing as money."** Agents run out of float, especially month-end and rurally. A worker who can't cash out doesn't trust the wallet — and goes back to cash gigs.

Build a **live map of nearby MoMo/Airtel/Zamtel agents with actual cash availability**, crowdsourced from every Nchito cash-out (success/failure, amount, time) and enriched by operator APIs. Users check it daily even when they aren't working — that's free retention, and it's genuinely useful to people who've never posted a gig.

### 3.2 Earned Wage Access on escrow

Earned Wage Access is the fastest-growing gig-fintech category globally. Nchito has something lenders don't: **we can see the escrow**. Once a gig is assigned and work is verifiably underway (proof-of-work photo, §4.1), advance up to 50% of the worker's payout for a small flat fee.

This kills the main reason workers take cash jobs: *cash pays today.* Risk is near-zero because the money is already locked in escrow.

### 3.3 Digital Chilimba (rotating savings circles)

*Chilimba* — rotating savings groups — is deeply embedded Zambian financial culture. Let a crew of workers auto-contribute a slice of each payout into a digital chilimba and take turns receiving the pot.

Culturally native, no foreign competitor will think of it, and it creates the strongest lock-in in the product: **you cannot leave mid-cycle without letting your friends down.** Social obligation beats any switching cost we could engineer.

### 3.4 Self-serve B2B micro-task campaigns — the passive engine

Today micro-tasks are seeded by hand. Make it a **self-serve console**: a company uploads a survey, app test, mystery-shop brief or data-labelling batch, pays by card or MoMo, sets slots and targeting, and Nchito distributes it to matching workers. We keep 30–40%.

The highest-value variant: **African-language and local-context data labelling.** Global AI labs need Bemba/Nyanja/Tonga speech, Zambian road and retail imagery, and local-context annotation — supply that is scarce worldwide and abundant here. This can plausibly become the largest revenue line in the business, and it runs without you once sold.

---

## Tier 4 — Trust & safety. The permission to scale.

- **4.1 Proof-of-work capture** — timestamped, geotagged before/after photos attached to the gig; escrow release requires them. Ends most disputes before they start and is the underwriting signal for EWA (§3.2).
- **4.2 SOS and live-share** — one-tap emergency button and live location sharing with a trusted contact during in-person gigs. Safety concerns are a primary barrier to **women's participation**; fixing it opens up half the market properly.
- **4.3 Milestone escrow** — split multi-day gigs into staged releases so neither side carries the whole risk.
- **4.4 Dispute resolution with evidence trail** — chat, photos and timestamps in one reviewable case file. Resolve in-app within 48h.
- **4.5 Graduated trust tiers** — NRC verification unlocks higher-value gigs; a police-clearance tier unlocks childcare and in-home work.

---

## Tier 5 — Distribution. What makes it trend.

- **5.1 Fair-price AI band** — when posting, suggest "similar gigs in Kabulonga paid K180–K250." Stops lowballing, speeds up posting, and makes the marketplace feel fair to both sides.
- **5.2 Shareable earnings cards** — a beautiful, branded "I earned K1,240 on Nchito this month 🇿🇲" card built for TikTok and WhatsApp status. Zambian money-making content already performs enormously; give it a native asset.
- **5.3 Leaderboards and streaks** — "Top earners in Lusaka this week," daily task streaks that unlock higher-paying tiers. Habit loop, already partly modelled in the Quick Tasks feed.
- **5.4 Community hustle hubs** — category groups (delivery riders, hairdressers, tutors) where workers trade tips. Turns a transactional tool into a community people defend.

---

## Sequencing — what to build first

Ruthless order, assuming limited engineering:

| Phase | Ship | Why now |
|---|---|---|
| **1** ✅ | Loyalty-decaying commission (1.1) · Proof-of-work (4.1) · Fair-price band (5.1) | Cheap, mostly server-side, immediately defends revenue |
| **2** 🔨 | ~~Work Record (1.2)~~ ✅ · Guarantees (1.3) · Offline-first (2.3) | The moat. Start accumulating the data asset early — it compounds |
| **3** 🔨 | ~~WhatsApp bot then USSD (2.1)~~ ✅ · Shareable earnings cards (5.2) | Growth phase; WhatsApp first (far cheaper than USSD shortcode licensing) |
| **4** ✅ | ~~Agent liquidity map (3.1)~~ ✅ · ~~EWA (3.2)~~ ✅ | Retention and the second revenue line, once transaction volume justifies it |
| **5** | ~~Digital Chilimba (3.3)~~ ✅ · ~~Vernacular voice (2.2)~~ ✅ · Self-serve B2B console (3.4) | Scale plays that need a real user base behind them |

**The two that matter most:** the *Work Record* (§1.2) is the thing that makes Nchito infrastructure rather than an app, and the *WhatsApp/USSD layer* (§2.1) is the thing that makes it reach everyone rather than the smartphone minority. If only two things get built this year, build those.

---

## Phase 1 — shipped

Migration `supabase/migrations/0002_phase1_defensibility.sql` plus matching iOS and Android implementations.

**Loyalty-decaying commission.** `commission_rate()` reads `pair_completed_count()` and returns 10% / 7% / 5% at 0–2, 3–9 and 10+ settled gigs between the same poster and worker. Only gigs that reached `paid` count, so the discount is earned through completed work rather than through gigs merely posted. `release_escrow()` computes the rate from history *before* the current gig settles, so the tier shown in the app while the gig was open is the tier actually charged. Both apps surface the current tier, progress toward the next, and what the next tier is worth in kwacha on a gig that size — the point is to make the discount visible enough to be worth staying for.

**Proof of work.** A `proof_of_work` table holds one before and one after photo per gig with device capture time and coordinates (upload time is deliberately not trusted). `has_complete_proof()` gates `release_escrow()`, so payment cannot move without both halves. RLS lets only the assigned worker upload and only the two gig parties read. The apps show a two-slot capture card on gigs the user has taken, with the release state spelled out.

**Fair-price bands.** `price_band()` returns p25/median/p75 over settled gigs in the same category, preferring the same city and widening to nationwide when the local sample is under five. Below five comparables it returns nothing rather than advising from noise. The post-gig form shows the range, the median as a one-tap fill, and — once an amount is typed — whether it reads low, fair or high. All three implementations use linear-interpolation percentiles so the apps and `percentile_cont` in Postgres agree on the same numbers.

## The Work Record — shipped

Migration `supabase/migrations/0003_work_record.sql` plus full iOS and Android implementations.

**It cannot be self-reported.** Entries are written only inside `release_escrow()`, in the same transaction as the payout, so every line represents money that actually cleared. Work settled in cash off-platform simply never appears — which is the anti-leakage property, achieved without any enforcement.

**It cannot be quietly edited.** Each entry carries an HMAC over a canonical serialisation of its contents, keyed by a secret held in database settings and never shipped to a client. `verify_work_record()` recomputes and compares; a `before update or delete` trigger makes the table append-only for everyone, the worker included. A history you can curate is a history nobody should trust.

**Punctuality is measured, not claimed.** On-time is judged against the "after" proof photo's device capture time versus the gig's `due_at` — not against when the poster got round to releasing payment, which the worker doesn't control.

**Sharing is opt-in and revocable.** Employment history is sensitive, so records are private until the worker turns sharing on. The share slug is random rather than derived from name or phone, so it leaks nothing about its owner, and it can be rotated to kill a link already handed out. `public_work_record()` is `SECURITY DEFINER` and granted to `anon`, so the table itself stays closed to anonymous readers and that function is the only way out.

**The reliability score is deliberately explainable.** A transparent weighted sum of volume, punctuality, rating and tenure — anything a lender might price risk from has to be defensible line by line. Punctuality and rating are shrunk toward a neutral prior, because a flawless record over a single job is not evidence of anything; without that correction one perfect gig scored about the same as fifteen good ones.

**The CV export is the payoff.** Both apps render an A4 PDF — standing, main areas of work, and every job with date, pay and rating — shareable straight into WhatsApp, Gmail or Drive. A cleaner or a rider can walk into a formal interview holding a document whose every line is backed by a payment that cleared, with a link the employer can check themselves.

## The offline channels — shipped

Migration `0004_offline_channels.sql` plus Edge Functions in `supabase/functions/`.

**One engine, two transports.** `_shared/menu.ts` holds the whole state machine — gig browsing and applying, wallet and cash-out, quick tasks, work record, and signup for unknown numbers. The USSD and WhatsApp adapters only translate transport, so a feature added once appears on both and the channels cannot drift apart.

**Everything is written to the USSD budget.** One screen is about 182 characters, with no scrolling, no images and no way back except re-dialling. Copy that fits USSD reads fine on WhatsApp; the reverse is not true, so the tighter constraint sets the format for both. The gig list reserves room for its own footer rather than letting a clamp eat it — losing "reply with a number" strands the user with no affordances at all — and it only offers gigs that actually fit, so option 3 can never point at something that never appeared.

**Security had to be rebuilt for this path.** Edge Functions use the service role and bypass Row Level Security entirely, and there is no `auth.uid()` on a USSD call. So every database call goes through a `channel_*` RPC that authorises by phone number itself, and those RPCs are revoked from the client roles so a browser cannot call them with someone else's number. WhatsApp requests are verified against Meta's HMAC over the raw body; Africa's Talking doesn't sign callbacks, so a URL secret plus their IP allow-list stands in.

**Money needs a PIN.** The network asserting a phone number is a decent identity claim, but a stolen handset would otherwise be a drained wallet, and mobile money here always asks for a PIN. It's set in the app, stored only as a bcrypt hash, and verified inside `channel_cash_out()` — never in the Edge Function — with attempt counting and lock-out held on the profile so closing a session cannot reset them.

**Signup works from a feature phone.** An unknown number is walked through name and town and gets a real account, with the auth user created via the admin API and the phone treated as already confirmed, since the network proved they hold it. This is the actual unlock: someone with no smartphone and no data can now join Nchito at all.

## Earned wage access — shipped

Migration `0005_wage_advances.sql`, both apps, and a "Get paid early" option on USSD and WhatsApp.

**It is structurally not a loan, and that matters.** The poster has already funded escrow, so Nchito is holding this worker's money. An advance is early release of funds already deposited against work already started — no credit is extended, nothing accrues, there is no interest, and the flat fee is quoted in kwacha before the worker agrees. This framing is worth protecting: it is the difference between a service fee on your own money and a consumer lending product, which in Zambia is a different regulatory conversation entirely. **Have a Zambian financial-services lawyer confirm the characterisation before launch** — the structure is designed to support it, but the structure is not the ruling.

**The exposure is narrow and bounded four ways.** The only real risk is a worker taking an advance and then abandoning the gig, leaving Nchito to refund the poster from money already paid out. So: work must demonstrably have started (the "before" proof photo, with its device capture time and location — this is the feature proof-of-work was laying groundwork for); the advance is capped at half the payout, which leaves the repayment covered with wide headroom at every gig size; the worker needs standing read from their Work Record (three settled jobs, most delivered on time); and only one advance runs at a time, because stacking across gigs is how someone ends up owing more than they are about to earn.

**Settlement repays before crediting.** `release_escrow()` now deducts the advance and its fee from the payout and credits the worker the net, so the wallet never shows money that is already spoken for. An assertion guards the case where terms are ever changed such that the advance could exceed the payout, rather than silently paying out a negative.

**Abandonment converts to a recoverable obligation** rather than a collections problem: the balance is recovered from future earnings, and a worker who keeps working repays without anyone having to chase them.

**Every number is on one screen before committing** — what arrives now, the fee, and what is left at the end — on all three surfaces. A surprise at settlement is how trust in early payment dies. On USSD the fee is quoted before the PIN prompt, so nobody enters a PIN against a number they have not seen.

**Two features had to exist first**, which is why this sits in Phase 4 rather than Phase 1: proof-of-work supplies the evidence that work started, and the Work Record supplies the standing check. Neither could be faked by a worker, which is what makes underwriting from them defensible.

## The agent liquidity map — shipped

Migration `0006_agent_liquidity.sql`, both apps, and a "Find cash near me" option on USSD and WhatsApp.

**The governing constraint is that a false positive costs someone a trip.** Bus fare to an agent who turns out to be dry is real money to a worker earning K150 a day, and a wasted journey destroys trust faster than showing nothing at all. Every design decision below follows from that.

**Reports decay fast — a three-hour half-life.** Agent float turns over across a day, not a week: a report from this morning says little about this afternoon, and one from yesterday is worth almost nothing. Short by design, because stale optimism is exactly what sends people on wasted journeys. Anything over a day is excluded outright.

**"Unknown" is a first-class answer.** Below a minimum evidence threshold the map says nobody has reported recently, rather than guessing. On USSD, where there is no colour to lean on, that reads as "not reported yet" — never anything that could be mistaken for reassurance.

**One fresh report is enough to claim cash, deliberately.** Demanding two would leave the map blank in a thin market, exactly when it most needs to earn trust. The risk is bounded: a reporter must have actually cashed out through Nchito, may report a given agent only once an hour, and a wrong claim self-corrects within minutes once the next visitor reports otherwise. The honest compensation is that every surface shows *how many* people reported and *how long ago*, so "1 person, 10 minutes ago" reads differently from "4 people in the last hour" and the user decides whether it's worth the fare.

**A confirmation is only good up to its own amount.** An agent who paid out K200 this morning may still not have K2000. Reports carry the amount withdrawn, and a request for more than anyone has confirmed getting out shows a caveat rather than a green light.

**Known-dry agents stay on the list.** One reported dry an hour ago may have been restocked since, so hiding it would be its own kind of false claim — it just sorts last.

**Reports are never readable row by row.** They would reveal where a person was and when, which nobody needs; only the aggregate is useful, and that is all the API exposes.

This is also the feature people open when they aren't working, which makes it the retention play in Phase 4 — and it is genuinely useful to someone who has never posted a gig.

## Sources

- [Marketplace disintermediation and platform leakage — Sharetribe](https://www.sharetribe.com/marketplace-glossary/disintermediation-platform-leakage/)
- [How to prevent platform leakage — Cobbleweb](https://www.cobbleweb.co.uk/how-to-prevent-platform-leakage-in-your-online-marketplace/)
- [Zambia: Mobile Money Opened Doors. Fintech Has to Go Further — The Fintech Times](https://thefintechtimes.com/zambia-mobile-money-opened-doors-fintech-has-to-go-further/)
- [Mobile Money Agent Networks: The Cash-In Cash-Out Economy — All Business Africa](https://allbusiness.africa/insights/mobile-money-agent-networks-2026)
- [Super apps — the future of mobile-first Africa? — DAI Magister](https://www.daimagister.com/resources/super-apps-the-future-of-mobile-first-africa/)
- [Is Africa Ripe for Super Apps — Finextra](https://www.finextra.com/blogposting/27965/is-africa-ripe-for-super-apps)
- [Two-sided marketplace cold start and liquidity — Reforge](https://www.reforge.com/blog/omni-bootstrapped-marketplace-liquidity-growth)


---

## Vernacular and voice — shipped

§2.2, minus the part that does not exist.

**What was built.** `nchito-shared/languages.json` is a generated source like the
taxonomy: 67 strings, vernacular category names and a keyword lexicon, in English,
Nyanja, Bemba, Tonga and Lozi. The interface, the USSD menu and the WhatsApp
routing all read from it. Someone types *ndalama* to WhatsApp and lands on their
wallet; someone dials in and gets the menu in Chinyanja.

**What was not built, and why.** §2.2 says "AI transcribes, translates,
categorises". No browser, phone OS or commodity API transcribes any Zambian
language. Shipping a dictation button for Nyanja would mean silently dropping
what somebody said about their own job, which is worse than not offering it.

So the mechanism is the one Zambians already use every day: **record a voice
note and let the other person listen.** It needs no model, works in any
language, and removes the literacy barrier in both directions. `0009` stores
those recordings, leaves `transcript` null rather than inventing text, and makes
corpus consent explicit, revocable and off by default — a recording of someone's
voice is not ours to train on because they happened to use the app.

That corpus, with consent, is exactly the Bemba/Nyanja speech data §3.4
identifies as scarce worldwide and abundant here. The order matters: collect it
because people chose to speak, then ask; not harvest it and call it a feature.

**Honesty is enforced, not promised.** A missing translation is `null`, never a
guess, and falls back to English. Tonga and Lozi sit at 31% and are held back
from the picker by a coverage floor, because a half-English screen reads as
broken. Nothing is marked reviewed, because no native speaker has seen it, and
the app says so in that language's own words. `generate.mjs` measures the USSD
menu in every offered language and fails the build if Nyanja's longer words push
an option off a screen that cannot scroll.

**Before launch:** a native speaker of each language has to sign the strings off.
That is a person, not a task, and the `reviewed` flag stays false until one does.

---

## Digital Chilimba — shipped, and switched off

§3.3, behind a gate.

**The gate.** Pooling members' money and paying it back out is plausibly a
deposit-taking or savings-scheme activity under Zambian financial regulation,
and the Bank of Zambia decides whether Nchito may do it. `chilimba_enabled()`
returns false, every entry point checks it, and escrow release works normally
with it shut — it simply skips the contribution. The failure mode of shipping
this by accident is not a bug report; it is an unlicensed financial product
holding other people's money.

**The design is mostly about how chilimbas go wrong.**

| Failure | What the schema does |
|---|---|
| The founder always collects first | Turn order is drawn at random from a recorded seed, so anyone can check the draw |
| Somebody collects a pot that is short | A round does not close until every member has paid, and those outstanding are **named**, not counted |
| A member collects, then stops paying | `chilimba_position()` makes that a number on screen; leaving while ahead is refused with the exact amount it would cost the others |
| The circle is more than someone can afford | Joining is capped at 25% of what they have actually earned through Nchito, counting circles they are already in |
| A payout is quietly emptied by standing orders | Auto-contribution is off by default, takes one circle per settlement, and is skipped if it would leave the member with nothing |

§3.3 calls the social obligation "the strongest lock-in in the product". It is,
and that is precisely why the exposure is shown rather than relied upon. A
lock-in built on somebody not realising what leaving would cost is not loyalty.

**Verified, not asserted.** `supabase/test/` applies all twelve migrations to a
real PostgreSQL cluster and exercises the rules: the gate refuses, the cap
refuses with real numbers, the draw is not first-come, the round holds at 3 of 4,
the pot moves at 4 of 4, and the member who has collected cannot walk away.
