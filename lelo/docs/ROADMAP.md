# Roadmap

What exists in this repository is a working reference implementation: the USSD
menu, the credit ledger, the content engine, the daily run, and the WhatsApp
and payment webhooks, all runnable and tested with no external account.

What follows is what stands between that and a service people pay for. The
ordering is deliberate — each phase kills a specific risk, and the risks are
ordered by how expensive they are to discover late.

---

## Phase 0 — Answer the four questions that decide everything (weeks 1–4)

**No code. No pilot. No company registration yet.** These four answers decide
whether there is a business at all, and three of them are phone calls.

1. **Delivery cost.** Wholesale SMS quotes from MTN, Airtel, Zamtel and two
   aggregators at 100k and 1M messages/month. WhatsApp conversation price for
   Zambia. USSD session cost and who bears it. See `docs/UNIT_ECONOMICS.md` —
   if the best SMS quote is materially above ~K0.20/segment, the push model
   does not work at K1/day and the product becomes USSD-pull-first.
2. **Short code and licensing.** What ZICTA requires, and whether you can
   operate under an aggregator's licence rather than your own.
3. **PSP terms.** Per-collection fee on a K7 and a K30 collection from two
   licensed providers, and settlement timing.
4. **Willingness to pay, tested properly.** Not a survey — surveys about money
   lie. Sell something. Set up a manual WhatsApp group, deliver a real daily
   bulletin to 100 people for two weeks free, then ask them to pay K7 for the
   next week. **The number that matters is how many actually pay**, not how
   many said they would.

**Kill criteria, stated in advance:** if fewer than ~20% of engaged pilot users
pay for week three, the content is not worth K1 yet. Fix the content before
building anything.

---

## Phase 1 — Legal and commercial foundation (weeks 4–12)

Runs in parallel once Phase 0 is positive.

- PACRA incorporation; ZRA TPIN; confirm turnover tax vs VAT position.
- Data Protection Commission registration; confirm the cross-border
  transfer position **before** choosing a Supabase region.
- Sign the PSP agreement. Confirm in writing that they are merchant of record.
- Legal opinion: prepaid service credit as implemented is not e-money.
- Secure the short code.
- Content agreements: ZNFU (market prices), ZMD (weather), ERB (fuel), MoH
  (health), RDA/RTSA (transport). Attribution terms in writing.
- Confirm the scripture source is public domain or licensed, per language.

Full checklist: `docs/COMPLIANCE.md` §6.

---

## Phase 2 — Production platform (weeks 8–16)

- **Port the data layer to Supabase.** `supabase/migrations/0001_init.sql` and
  `0002_rls.sql` are ready. Move `server/db.js` behind an interface with a
  Postgres implementation; use the `charge_day()` function so the balance check
  and ledger write stay atomic under concurrency.
- **Swap the mock adapters** in `messaging.js` and `payments.js` for the
  chosen aggregator and PSP. The interfaces do not change.
- **Move the daily run off Vercel Cron onto a queue** with a worker pool once
  the base exceeds what a 60-second invocation window can process. The batch
  interface (`afterId` / `lastId` / `done`) is already the right shape.
- **Operator console in Lovable** against Supabase with RLS: content calendar,
  approval queue, subscriber lookup, revenue dashboard. Anon key only — the
  service-role key never reaches a browser.
- **Observability**: alert on the daily run not completing by 07:00, on
  delivery failure rate, and on segments-per-digest crossing 2.0.
- **WhatsApp templates** submitted and approved. Expect iterations.

---

## Phase 3 — Earn the K1 (months 4–8)

This is the phase most services like this skip, and it is why most of them
fail. A daily message nobody values is a daily reminder to unsubscribe.

- **Automate the sources.** Hand-keyed prices do not survive contact with a
  public holiday. Build ingestion for ZNFU, ZMD and ERB, with a
  last-known-good fallback and an alert when a feed goes stale.
- **Localise properly.** Bemba, Nyanja, Tonga, Lozi — translated by native
  speakers, reviewed by a second native speaker. Machine translation of health
  or financial content is a liability, not a shortcut. Note that local
  orthography outside GSM-7 doubles the segment count: budget for it.
- **Make it district-specific.** National weather is worth nothing to a farmer
  in Petauke. District-level content is the single strongest retention lever
  available, and the schema already supports it.
- **Instrument what people read.** On USSD pull you learn exactly which
  bulletin they came for. Cut what nobody reads.

---

## Phase 4 — Distribution (months 6–14)

Opt-in is the constraint, because nothing can be pushed to a phone that has
not asked. Budget for it as the main cost line after delivery.

- **Agents.** Mobile-money agents, agro-dealers, community health workers.
  Commission per *retained* subscriber (paid after their first top-up), not
  per sign-up — otherwise you buy sign-ups from people who never dial again.
- **Community radio.** High reach, low cost, and the right audience.
  Sponsoring a farming or health slot in-language beats a spot advert.
- **Cooperatives, churches, mining associations, bus operators.** Verticalise
  the pitch: a mining co-op cares about the copper price and licence
  deadlines, not maize.
- **Referral.** Bonus days for a referral who tops up (`bonus` ledger kind
  exists for this). Cap it, and watch for gaming.
- **Free trial already implemented** — 7 days, no payment details required,
  which removes the only real objection to trying it.

---

## Phase 5 — Widen the service (year 2)

Only once the core digest retains. Each of these is a real product, not a
content line.

| Extension | What it adds | Watch out for |
|---|---|---|
| **Mining services** | Buyer directory, verified scales, licence renewal reminders, pit safety alerts | Facilitating unlicensed mineral trading — get advice first |
| **Transport services** | Route fares, breakdown/recovery directory, RTSA deadline reminders | Liability if a road-condition alert is wrong |
| **Health services** | Clinic locator, immunisation schedules, outbreak alerts by district | Stays general information — never diagnosis (`content.js` enforces) |
| **Jobs & tenders** | Vacancies and tenders people can actually apply for | Scam listings. Verify every one, and never list a job charging a fee |
| **Premium tier** | K2–K5/day: more frequent alerts, voice messages for low-literacy users | Do not raise the K1 tier — add above it |
| **Voice (IVR)** | Reaches subscribers who cannot read comfortably | Per-minute cost is far above SMS; price separately |

---

## Deliberately not on this roadmap

- **Person-to-person credit transfer.** One line of code; changes your
  regulatory category to e-money. See `docs/COMPLIANCE.md` §2.
- **Buying a subscriber list.** Illegal to message, and the fastest way to
  lose the aggregator relationship the whole service depends on.
- **Auto-renew without a clear prompt.** The credit model exists so that
  running out is silent and free rather than a surprise deduction. Keep it
  that way; it is the reason people will trust a daily debit at all.
- **A smartphone app.** The audience is on USSD and SMS. An app serves the
  people who need this least.
