# App icons

The manifest expects three PNGs here:

- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `icon-512-maskable.png` (512×512 with ≥ 20% safe-zone padding)

Generate them from your logo with any tool, e.g.:

```bash
npx pwa-asset-generator logo.svg ./ --icon-only --padding "20%"
```

(The sibling `poultry/scripts/genicons.js` in this repo shows a zero-dependency
way to emit placeholder PNGs if you need stand-ins before the brand logo exists.)
