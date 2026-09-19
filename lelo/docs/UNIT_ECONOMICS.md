# Unit economics

> Every number below is a **model input to be verified against a real quote**,
> not a fact. The point of this document is not the answers — it is to show
> which two or three numbers decide whether the business exists, so you go and
> get those quotes first.

---

## The headline: the delivery cost decides everything

At K1.00 of revenue per subscriber per day, the cost of delivering one daily
bulletin is not a line item. It is the business.

The original plan quoted bulk SMS at roughly **€0.07–€0.10 per message**. Take
the lower end and a two-segment digest:

```
Revenue per day     K1.00
SMS cost per day    2 segments × ~K1.50  =  K3.00
Contribution        −K2.00 per subscriber per day
```

**At retail bulk-SMS rates, every subscriber you add loses money, and adding a
million of them loses a million times as much.** No amount of scale fixes a
negative contribution margin; scale makes it worse. This is the single most
important thing to establish before anything else in the roadmap.

So the first commercial task is not marketing and not a pilot. It is:

1. Get a **wholesale/volume SMS quote** from each of MTN, Airtel and Zamtel,
   and from two aggregators, at 100k and 1M messages/month.
2. Get a **WhatsApp conversation price** for Zambia for the relevant template
   category.
3. Get a **USSD session cost** — and establish who pays it, the subscriber or
   us.
4. Get a **DCB revenue-share term sheet** from at least one MNO.

Until you have those four numbers, every projection is decoration.

### What the answer has to be

Break-even contribution needs the all-in delivery cost per subscriber-day
comfortably under ~K0.50. Working backwards, a two-segment SMS digest needs a
rate around **K0.10–K0.20 per segment**. If the best quote is materially above
that, the SMS *push* channel does not work at K1/day, and the design has to
change rather than the price.

### The change, if SMS is too expensive

Make **USSD pull the default channel.** The subscriber dials the short code
and reads the bulletin on screen; we pay a session cost, not a message cost,
and often the subscriber's own USSD session is the cheaper unit.

- Default tier: USSD pull. K1 charged on the day they actually read.
- Paid upgrade: SMS push for those who want it delivered, priced to cover it.
- Smartphones: WhatsApp, if the conversation price beats SMS.

`billing.runDaily({ channel })` already takes the channel as a parameter, so
this is a configuration and pricing decision, not a rewrite. What it changes is
the *product*: a pull service has to be worth remembering to dial, which puts
far more weight on content quality.

---

## Cost stack per subscriber per day

| Line | Model value | Where it comes from |
|---|---:|---|
| Revenue (billed day) | K1.00 | `DAILY_PRICE_NGWEE` |
| Tax on turnover | −K0.04 to −K0.16 | **Verify with ZRA** — turnover tax vs VAT |
| PSP fee, amortised | −K0.06 | ~3% + fixed on a K30 bundle ÷ 30 days. **Verify** |
| Delivery | −K0.10 to −K3.00 | **The number to go and get** |
| Content & sourcing | −K0.02 | Fixed editorial cost ÷ subscribers; falls with scale |
| Infrastructure | −K0.01 | Vercel + Supabase paid plans ÷ subscribers |

Bundling matters here: amortising the PSP fee over a **monthly** top-up
instead of a weekly one takes it from ~K0.27/day to ~K0.06/day. That alone is
a fifth of the margin, which is why `M1` and `M3` bundles are priced to be the
obvious choice (K85 for 90 days is a 5.6% discount — cheap for the fee saving
and the churn reduction).

---

## Break-even

Assumptions, all to be replaced with real figures:

- **Billable days:** ~70% of calendar days for an active subscriber. The other
  30% are trial days, days out of credit, and days with nothing published
  (which are refunded — see `billing.js`).
- **Fixed monthly cost:** K200,000 for a lean team (editorial, ops, support,
  infrastructure, compliance).

| Delivery cost / day | Contribution / day | Contribution / subscriber / month | Subscribers to break even |
|---:|---:|---:|---:|
| K0.10 | ~K0.73 | ~K15.3 | ~13,000 |
| K0.20 | ~K0.63 | ~K13.2 | ~15,200 |
| K0.30 | ~K0.53 | ~K11.1 | ~18,000 |
| K0.50 | ~K0.33 | ~K6.9 | ~29,000 |
| K1.00 | −K0.17 | negative | never |

*(Contribution = K1.00 − K0.09 tax − K0.06 PSP − delivery − K0.03 other;
monthly = contribution × 30 × 0.70.)*

**13,000–29,000 paying subscribers is the target.** Not 2.25 million. That is a
reachable number for a focused operation — and it is the number the plan
should be built around, because it is the one that decides whether the company
survives its first year.

---

## Correcting the original projections

The original model multiplied subscribers × K1 × 365. That overstates revenue
in three ways:

1. **Churn.** At 8% monthly churn, a cohort of 100,000 is ~37,000 by month
   twelve. Annual revenue from that cohort is roughly *half* what a
   no-churn model predicts.
2. **Billable days.** Trial days, out-of-credit days and no-content days are
   not billed. ~70%, not 100%.
3. **Costs.** The original projected revenue with no cost line at all.

A corrected version of the same table, at K0.20 delivery cost and 8% monthly
churn:

| Subscribers acquired | Avg active over year | Annual revenue | Annual contribution |
|---:|---:|---:|---:|
| 25,000 | ~15,000 | ~K3.8m | ~K2.4m |
| 250,000 | ~150,000 | ~K38m | ~K24m |
| 2,250,000 | ~1,350,000 | ~K345m | ~K214m |

Still a real business at the top end. But the middle row — 250,000 acquired,
~K24m of annual contribution — is the one worth planning against, and it needs
roughly **1.1% of the population to have dialled a short code and opted in**.
That is a distribution problem, and distribution is where the money and the
roadmap should go.

---

## The four numbers to watch

Once live, these four tell you everything:

| Metric | Why | Warning level |
|---|---|---|
| **Billable-day rate** | Days charged ÷ days a subscriber was consented and active | < 60% means content or top-up friction |
| **Top-up repeat rate** | Subscribers who buy a second bundle | < 40% means the content is not worth K1 |
| **Segments per digest** | Direct multiplier on the largest cost line | > 2.0 sustained |
| **Cost per opted-in subscriber** | Agent commission + airtime + radio ÷ opt-ins | > 3 months of contribution |

`GET /api/admin/summary` reports the first and third today, plus
`unearnedCreditNgwee` — credit sold and not yet consumed, which is a
**liability, not income**. Booking it as revenue overstates the business and
misstates the tax position.
