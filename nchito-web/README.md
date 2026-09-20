# Nchito Web — PWA

The third Nchito client, alongside [iOS](../nchito-ios/) and [Android](../nchito-android/). Installable, works offline, and runs the same seed data as the other two so all three demo identically.

**Why a PWA matters here:** it needs no app store, no download over a metered connection, and no approval cycle. On a market where data costs real money the whole app is well under 200KB, opens from a link, and lays out properly on a K400 Android phone, a tablet and a desktop browser.

## Running it

It is static files with no build step:

```bash
cd nchito-web
python3 -m http.server 8000   # or any static server
```

**Live:** https://nchito-nu.vercel.app — landing page at `/`, the app at `/app`.

Deployed on Vercel from `nchito-web/` on this branch. Pushing to the branch redeploys it.

## Layout

One shell at every width; CSS decides which navigation exists, not JavaScript.

| Width | Navigation | Feed | Detail |
|---|---|---|---|
| < 640px | bottom tab bar (5 + Profile) | one column | full screen, with a back button |
| 640–899px | bottom tab bar | two columns | full screen |
| 900px+ | left rail, full navigation | three columns | full width |
| 1180px+ | left rail | list column | **beside the list**, sticky |

The only width question JavaScript asks is whether there is room to show a list and a detail
at once, because that changes what belongs on screen rather than how it looks. Everything else
is a media query. Charts are the exception: an SVG drawn for a 390px column smears when
stretched to 1240px, so charts are drawn once their box has a measured width, and redrawn on
resize.

Motion — slide transitions between views, staggered list entry, drawn-in charts, a slow sheen
on the hero — is all switched off under `prefers-reduced-motion`, including the stagger
*delays*, since a delayed element with a zeroed duration still appears late for no reason.

## Verifying it

```bash
python3 -m http.server 8123 --directory nchito-web &
node nchito-web/verify.mjs
```

Drives the real app in Chromium at 390, 834, 1280 and 1680px and asserts on painted geometry
and computed style, not on whether elements exist. Every bug it now guards against was one
that passed every static check and was still visibly wrong on screen — chart columns squashed
to 6px by a CSS class collision, a sparkline painted green on the copper dashboard, a progress
bar collapsed to nothing inside a column flex parent, a generated-text box 20 characters wide.

## Why vanilla

No framework, no bundler, no dependencies. The product's own design principle is that Zambian mobile data is expensive and intermittent, and it would be odd to ship 200KB of framework to demo an app built around not wasting people's bundles. The service worker precaches everything, so after one visit it opens with no network at all.

```
nchito-web/
├── index.html              # landing page
├── landing.css             # its styles
├── brand/                  # logo and generated icons, shared by both
└── app/                    # the PWA
    ├── index.html          # shell: rail + content + tab bar
    ├── styles.css          # hand-written, no framework
    ├── catalog.js          # GENERATED from nchito-shared/taxonomy.json
    ├── data.js             # the same seed data as the iOS/Android apps
    ├── app.js              # screens, state, charts and actions
    ├── sw.js               # cache-first service worker, scoped to /app/
    └── manifest.webmanifest
```

`catalog.js` is generated — edit [`../nchito-shared/taxonomy.json`](../nchito-shared/) and run
`node nchito-shared/generate.mjs`, which rewrites the matching catalogues for iOS, Android and
the USSD/WhatsApp Edge Functions at the same time.

The service worker is registered from `/app/`, so its scope is `/app/` and the landing page is never intercepted or cached by it. Installing the PWA installs the app, not the marketing site.

## Brand

The mark is an **N** whose right stem carries on above the letter's top line, the part above turning copper. Read quickly it is a monogram; read again it is a rising bar — earnings going up — and the copper is Zambia's own metal against the flag's green. Square joins keep the strokes meeting cleanly at favicon size, where a rounded corner just reads as a chip in the letter.

| Token | Value | Use |
|---|---|---|
| Eagle green | `#0E7A18` | Primary, the tile, confirmed states |
| Copper | `#F08A1D` | The rise, boosts, early payment, warnings |
| Red | `#DE2010` | Urgency and refusals only |

Assets: `brand/logo.svg` (light), `brand/logo-dark.svg` (dark backgrounds), `brand/icon.svg` (mark alone), plus PNG icons at 16/32/180/192/512 and a maskable 512 for Android.

The PNGs are generated from the same geometry as the SVG by `brand/render_icons.py` in git history — no rasteriser was available, and the mark is deliberately built from four straight shapes, so drawing it directly is exact.

## What it demonstrates

Every headline feature from [INNOVATION.md](../nchito-ios/INNOVATION.md) is live in the demo: loyalty-decaying commission with progress to the next tier, proof-of-work gating escrow release, earned wage access blocked until the "before" photo exists, the agent liquidity map with honest uncertainty states, and the Work Record with its reliability score.

Plus the two-sided app:

- **Working mode** — 39 services across 8 families, searchable and filterable; quick tasks; wallet; and a dashboard of your own numbers (12-week earnings trend, week-by-week bars, where your money actually comes from, and what loyalty tiering has saved you).
- **Hiring mode** — post a job with a fair-price band drawn from comparable settled work, read applicants with their rating, on-time rate and quote, hire one, and release escrow once both proof photos exist. Its own dashboard covers spend, fill rate, applicants per job and repeat hiring.
- **Office Assistant** — writes the job post, quote, invoice, receipt, follow-up for a late payment, or WhatsApp advert. Templates, not a language model: it works offline, costs no data and never invents a number.

The mode switch changes the whole navigation rather than hiding a few buttons, because someone looking for work and someone hiring want almost nothing in common. It is the same account, wallet and Work Record either way.
