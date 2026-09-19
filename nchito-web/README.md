# Nchito Web — PWA

The third Nchito client, alongside [iOS](../nchito-ios/) and [Android](../nchito-android/). Installable, works offline, and runs the same seed data as the other two so all three demo identically.

**Why a PWA matters here:** it needs no app store, no download over a metered connection, and no approval cycle. On a market where data costs real money, the whole app is ~116KB and opens from a link.

## Running it

It is static files with no build step:

```bash
cd nchito-web
python3 -m http.server 8000   # or any static server
```

Deployed on Vercel from this directory — see the project README for the live link.

## Why vanilla

No framework, no bundler, no dependencies. The product's own design principle is that Zambian mobile data is expensive and intermittent, and it would be odd to ship 200KB of framework to demo an app built around not wasting people's bundles. The service worker precaches everything, so after one visit it opens with no network at all.

```
nchito-web/
├── index.html              # shell
├── styles.css              # hand-written, ~7KB
├── data.js                 # the same seed data as the iOS/Android apps
├── app.js                  # screens, state and actions
├── sw.js                   # cache-first service worker
├── manifest.webmanifest    # installability
└── brand/                  # logo and generated icons
```

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
