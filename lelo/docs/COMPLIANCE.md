# Compliance, platform terms, and the things that will actually stop you

> **Read this before writing a line of marketing copy.** Every item here has
> either shut down a service like this one somewhere, or is a term you agree
> to by deploying. Platform terms and Zambian statutory thresholds change:
> **verify every figure and clause against the current primary source before
> you rely on it.** Dates in this document are when the point was last
> checked, not a guarantee.

---

## 1. Two things in the original brief that cannot be built

### "Pop up in all connected smartphones and analogue phones"

There is no lawful, supported way to make a message appear unsolicited on
every phone in Zambia. Specifically:

- **USSD is pull-only from our side.** The subscriber dials; we answer. There
  *is* a network-initiated variant (USSD Push / NI-USSD), but it is operated
  by the MNO, reserved largely for things like payment confirmations, and
  requires an MNO contract that will not be granted for marketing.
- **SMS to a number that has not opted in** breaches the Data Protection Act
  and the MNOs' own acceptable-use terms. The aggregator will cut you off long
  before the regulator does — it is their licence at risk.
- **WhatsApp cannot be cold-messaged at all.** Meta requires prior opt-in, and
  proactive messages outside a 24-hour window must use a pre-approved
  template. Cold-messaging gets the number's quality rating downgraded and
  then blocked.

**What is buildable, and is what this codebase does:** advertise the short
code, let people dial in and opt in, then push daily. Opt-in is the growth
problem, and the roadmap treats it as such rather than pretending it away.

### "1 kwacha for the sake of tax"

A lower unit price does not reduce a tax obligation — tax follows turnover,
not unit price. Below the VAT registration threshold a business pays turnover
tax; above it, it registers for VAT. Either way the rate applies to what you
earn in total, so K1 × 10 million days is taxed exactly like K2 × 5 million
days.

**Verify the current VAT registration threshold and turnover-tax rate with
ZRA before modelling anything.** They have both moved in recent budgets.

K1 is still the right price, for three reasons that have nothing to do with
tax:

1. It clears the psychological bar for an unknown service on a first sale.
2. It is a round number that fits in a USSD screen and a radio advert.
3. It leaves room to raise to K2 with a premium tier once churn and content
   quality are proven — raising a price is far easier than cutting one.

---

## 2. The collection problem, and why the wallet exists

**A K1/day mobile-money debit does not work.** Mobile-money collections carry
a per-transaction cost, and on a K1 collection that cost is a large fraction
of — plausibly more than — the revenue. 365 collections per subscriber per
year is a fee structure that eats the business.

Two viable structures:

| Structure | How it works | Trade-off |
|---|---|---|
| **Prepaid credit** *(implemented here)* | Subscriber buys K7 / K30 of days; a ledger draws K1/day | ~12–52 collections/year instead of 365. Needs a top-up habit. |
| **Direct carrier billing (DCB)** | The MNO deducts K1/day from airtime and revenue-shares | No collection fee per day, and no top-up friction — but requires an MNO VAS agreement, and the revenue share is typically large. |

Model both against real rate cards. DCB is usually where a service like this
ends up at scale; prepaid credit is how you get there without an MNO contract
on day one, and the two can run side by side.

### Keep the credit out of e-money territory

The balance in `wallet_accounts` is **prepaid credit for one named service**.
It cannot be transferred to another person and cannot be cashed out. That
restriction is deliberate and load-bearing: a general-purpose stored value
that can be sent or withdrawn is e-money, and issuing e-money requires
authorisation from the **Bank of Zambia** under the National Payment Systems
framework.

**Do not relax that restriction without a legal opinion.** "Let users send
credit to a friend" is a one-line feature that changes your regulatory
category.

Similarly, `server/payments.js` never holds a float. A licensed PSP is
merchant of record, settles to a bank account, and we keep a record of what
they told us. Keep that boundary.

---

## 3. Zambian regulatory checklist

| Area | What to do | Who |
|---|---|---|
| Company | Reserve name, incorporate, get a Certificate of Incorporation | PACRA |
| Tax | Register for a TPIN; determine turnover tax vs VAT | ZRA |
| Payments | Contract a **licensed** PSP as merchant of record. Do not collect directly without authorisation | BoZ-licensed PSP |
| Data protection | Register as a data controller; appoint a data protection officer if required; honour access and erasure requests | Data Protection Commission (Act No. 3 of 2021) |
| Communications / short code | Obtain a short code and confirm whether your arrangement requires a licence or must sit under a licensed aggregator | ZICTA |
| Consumer protection | Clear pricing, working opt-out, no auto-renew surprises | CCPC |
| Health content | Ministry of Health sign-off on health copy and attribution | MoH |

Two data-protection points that bite in practice:

- **Consent must be recorded, not inferred.** The schema stores `consent_at`
  and `consent_channel` for this reason, and clears `consent_at` on STOP.
- **Check the current position on cross-border transfer and localisation of
  personal data** before choosing a Supabase region. This determines whether
  you may host subscriber data outside Zambia and under what conditions. Get
  this answered before you have a million rows, not after.

---

## 4. Platform terms

*Checked against publicly documented terms; re-verify before launch — these
change, and this document does not update itself.*

### Vercel

- **The Hobby plan is for non-commercial use.** A revenue-generating service
  must be on a paid plan. This is the single most commonly breached term in
  projects like this one, and it is enforced.
- Serverless functions have a maximum duration. `vercel.json` sets
  `maxDuration`, and the daily run is written as a resumable batch so a
  timeout cannot strand it.
- Cron invocations are `GET` with `Authorization: Bearer $CRON_SECRET`. There
  are plan-dependent limits on cron frequency and count.
- Bandwidth and invocation overages bill on usage. Put a budget alert on the
  account before you run a radio advert.

### Supabase

- Free-tier projects pause after a period of inactivity and have hard row,
  storage and connection limits. **Production runs on a paid plan** — a paused
  database at 06:00 means no digest and a day of refunds.
- The **service-role key bypasses Row Level Security.** Server-side only. It
  must never appear in a Lovable front end, in any `NEXT_PUBLIC_*` or
  `VITE_*` variable, or in this repository. Rotate it immediately if it ever
  lands in a commit.
- Enable RLS on every table holding personal data — see
  `supabase/migrations/0002_rls.sql`. RLS is off by default on new tables;
  a table added later without it is a silent hole.
- Take real backups. Point-in-time recovery is a paid feature; the ledger is
  the one thing you genuinely cannot rebuild.

### Lovable

- Good fit for the operator console and marketing site. Generated code is
  yours to commit, so keep it in this repository under version control rather
  than only in the platform.
- **Never paste a service-role key, PSP key or WhatsApp token into a prompt.**
  Treat every prompt as though it will be logged.
- Confirm current terms on commercial use, data handling and code ownership
  for your plan before it underpins a revenue-generating product.
- Anything touching money or personal data should be reviewed line by line
  before it ships, whoever or whatever wrote it.

### GitHub

- Never commit `.env`, keys, tokens or a subscriber export. Enable secret
  scanning and push protection on the repository.
- Keep the repository private until you have deliberately decided otherwise.
- Store deployment secrets in GitHub Actions secrets or Vercel environment
  variables, never in the tree.

### WhatsApp Business Platform (Meta)

This is the strictest platform in the stack. Get it wrong and the number is
throttled, then blocked.

- **Prior opt-in is mandatory**, through a channel you can evidence.
- Outside the **24-hour customer-service window** opened by the user's own
  message, only **pre-approved template messages** may be sent. The daily
  digest to a WhatsApp subscriber is a template, and its category affects both
  approval and price.
- Conversation-based pricing applies — model it before assuming WhatsApp is
  cheaper than SMS. At K1/day of revenue it may well not be.
- A clear opt-out must work on every message. `whatsapp.js` handles STOP,
  CANCEL and UNSUBSCRIBE.
- Quality rating is scored on user blocks and reports. Sending content people
  did not choose is the fastest way to lose the channel — which is why topics
  are opt-in per vertical.

---

## 5. Content licensing and safety

### Health

Health copy is **general public-health information only**. Individual
diagnosis or prescription is the practice of medicine, and this service is not
licensed to practise it over SMS.

`content.approve()` refuses to approve health copy that trips a clinical red
flag (`you have…`, `take 4 tablets`, `no need to see a doctor`, `cures`).
**That check is a backstop against an editor's slip, not a substitute for
clinician sign-off.** Route health copy through MoH or a qualified reviewer,
and record who approved it — `approved_by` exists for that.

### Scripture and the "encouragement" vertical

Most modern Bible translations (NIV, NLT, ESV and others) are **copyrighted**,
with strict limits on how much may be reproduced and a requirement to display
a copyright notice. Sending a verse a day to a million handsets is not fair
dealing.

Use **public-domain** texts — the King James Version, the World English Bible
— or obtain a licence. For local-language translations, check the position
individually: many Bemba, Nyanja, Tonga and Lozi editions are held by Bible
societies and are in copyright.

Keep the vertical **opt-in and non-coercive**. Never imply that paying for the
service brings a blessing, or tie spiritual content to payment prompts. That
is both a consumer-protection problem and the fastest way to lose the trust
the whole service runs on.

### Third-party data

Market prices (ZNFU), weather (ZMD), fuel prices (ERB), road notices (RDA) and
government notices are somebody's work product. Get a content-sharing
agreement before republishing commercially, and carry attribution — the
`source` column exists for this, and the landing page shows it.

Scraping a source that has refused you permission is both a legal exposure and
a reliability risk: the scrape breaks silently, at 06:00, on the day it
matters.

---

## 6. Pre-launch gate

Do not send a single paid message until all of these are true:

- [ ] PACRA company-name search and trademark search cleared for "Lelo" — it is a common word, so expect to register the composite mark (wordmark **with** the sunrise device) rather than the word alone (`docs/BRAND.md`)
- [ ] PACRA incorporation and ZRA TPIN in hand
- [ ] Data Protection Commission registration filed
- [ ] Contract signed with a **licensed** PSP; we hold no float
- [ ] Short code secured and the ZICTA position on licensing confirmed in writing
- [ ] Data localisation / cross-border transfer position confirmed for the chosen Supabase region
- [ ] Legal opinion confirming prepaid credit is not e-money as implemented
- [ ] MoH (or qualified clinician) sign-off process live for health copy
- [ ] Scripture source confirmed public domain or licensed, in every language shipped
- [ ] Content-sharing agreements for ZNFU / ZMD / ERB data
- [ ] Vercel on a paid plan; Supabase on a paid plan with PITR
- [ ] Secret scanning on; service-role key confirmed absent from the repository
- [ ] WhatsApp templates submitted and approved
- [ ] STOP tested end to end on USSD, SMS and WhatsApp — **by someone who did not write it**
