# nchito-shared — the service taxonomy

One file, `taxonomy.json`, defines every service Nchito can be hired for: **39 categories in
8 families**. `generate.mjs` writes it into every surface that has to agree on it.

```bash
node nchito-shared/generate.mjs           # rewrite the mirrors
node nchito-shared/generate.mjs --check   # fail if any mirror has drifted
```

| Surface | Generated file |
|---|---|
| iOS | `nchito-ios/Nchito/Models/ServiceCatalog.swift` |
| Android | `nchito-android/app/src/main/java/com/owenphiri/nchito/data/ServiceCatalog.kt` |
| Web PWA | `nchito-web/app/catalog.js` |
| USSD / WhatsApp | `nchito-ios/supabase/functions/_shared/catalog.ts` |
| Postgres | `nchito-ios/supabase/migrations/0007…` and `0008…` (written once, then frozen) |

## Why this exists

It started at eight categories, hand-written five times over, and that was already a promise
nobody was keeping — the USSD menu said "Digital & design" where the app said "Digital &
Design". At thirty-nine it is not a promise anyone *could* keep. So there is one copy and a
generator, and `--check` fails the build rather than letting a chip render blank.

## Rules the generator enforces

It refuses to write anything until all of these hold, because each one is a bug that is
invisible until a user hits it:

- **A `code` that has shipped can never be removed.** Gig rows written months ago still carry
  it; dropping it orphans them. `_shipped_in_0001` pins the original eight.
- **Two categories may not share a `label`.** Swift uses the display label as the enum's
  `rawValue`, so a duplicate silently collapses two cases into one.
- **The USSD group menu must fit 182 characters.** This caught a real bug before it shipped:
  with full group names only six of eight families fit one screen, which meant Learning &
  Guidance and Office & Admin did not exist at all for feature-phone users — and a USSD screen
  has no scrolling, so nothing on screen would have hinted that anything was missing. Hence
  the separate `short` labels.
- **Every family's category menu must fit 182 characters too**, or services inside a family go
  the same way.

## Migrations

`0007` adds the enum values and `0008` adds the group metadata, deliberately split: Postgres
will not let a new enum value be *used* in the transaction that created it. Apply them
separately, in order.

They are generated once and then frozen. A migration that has been applied to a database is a
historical fact, not a mirror, so `generate.mjs` does not rewrite them — a later taxonomy
change needs a new migration. `public.taxonomy_drift()` reports any disagreement between the
enum and the metadata table at runtime.

## Changing the taxonomy

1. Edit `taxonomy.json`.
2. `node nchito-shared/generate.mjs`.
3. Write a new migration for anything the database needs (new enum values, new metadata rows).
4. `node nchito-shared/generate.mjs --check` in CI, and `select * from public.taxonomy_drift()`
   after deploying.
