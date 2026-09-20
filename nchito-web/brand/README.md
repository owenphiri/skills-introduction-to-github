# Nchito brand & store assets

Everything here is generated from the same geometry — no image editor is involved, and rerunning the two scripts reproduces the whole set.

## The mark

An **N** whose right stem carries on above the letter's top line, the part above turning copper. Read quickly it is a monogram; read again it is a rising bar — earnings going up — and the copper is Zambia's own metal against the flag's green.

Square joins throughout. At favicon size a rounded corner reads as a chip in the letter rather than a soft edge, and a first version with the copper floating as a separate block read as a lowercase "i" — making the whole mark say "Ni" instead of "N".

| Token | Value | Use |
|---|---|---|
| Eagle green | `#0E7A18` | Primary, the icon tile, confirmed states |
| Copper | `#F08A1D` | The rise, boosts, early payment, warnings |
| Red | `#DE2010` | Urgency and refusals only |

## Regenerating

```bash
python3 render_icons.py .          # every icon, for all three platforms
node render_screenshots.mjs        # store screenshots (needs the app served locally)
```

`render_icons.py` rasterises the mark directly: no rasteriser was available when it was written, and the mark is four straight shapes, so drawing it is exact rather than approximate. `render_screenshots.mjs` drives the real PWA in a browser, captures each screen, and composes it into a captioned store frame at full resolution.

## What's here

| Path | For |
|---|---|
| `logo.svg`, `logo-dark.svg`, `icon.svg` | Web and documents |
| `icon-{16,32,180,192,512}.png` | Favicons, `apple-touch-icon`, PWA manifest |
| `icon-maskable-512.png` | Android adaptive PWA icon (inset for circular cropping) |
| `ios/AppIcon.appiconset/` | Copied into `nchito-ios/Nchito/Assets.xcassets/` |
| `android/mipmap-*/` | Copied into `nchito-android/app/src/main/res/` |
| `store/ios-6.7-*.png` | App Store, 1290×2796 (the size Apple now requires) |
| `store/android-*.png` | Play Store phone screenshots, 1080×1920 |
| `store/play-icon-512.png` | Play Store listing icon |
| `store/play-feature-graphic-1024x500.png` | The banner at the top of a Play listing |

## Two requirements worth knowing

**Store icons carry no alpha channel.** App Store Connect rejects an icon that merely *has* one, even fully opaque, so `icon-1024.png` and `play-icon-512.png` are written as RGB rather than RGBA. Every other icon keeps its alpha.

**The Android adaptive foreground is inset to ~62%.** Launchers crop the outer ~28% to whatever mask the device uses, so the mark has to sit well inside the safe area or it loses its edges on circular-icon devices.

## Before you actually submit

The screenshots are captured from the **web app**, which mirrors the native apps screen for screen and runs the same seed data. They are ready to use for a landing page, a pitch or a placeholder listing.

For a real store submission, recapture from the iOS Simulator and an Android emulator once the apps build. Both stores expect screenshots of the app as it runs on their platform, and small platform differences — status bar, system font, safe-area insets — show up under review.
