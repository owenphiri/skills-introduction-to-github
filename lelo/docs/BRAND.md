# Brand

## The name

**Lelo** means **today** in Bemba and Nyanja, and is understood across most of
Zambia.

It was chosen against four tests that a mass-market service in this market
actually has to pass:

| Test | Why it matters | Lelo |
|---|---|---|
| Says what the product is | The promise is *today* — not yesterday's news, not a weekend newsletter | The name is the promise |
| Survives radio | Most subscribers will first hear the name, not read it | Two syllables, spelled as it sounds |
| Fits an SMS sender ID | Alphanumeric sender IDs are capped at 11 characters | `LELO`, four |
| Cheap in a digest | The service name is in the header of every message, every day | Saves 11 characters per SMS against "Daily Essential" |

That last one is not a joke. At two segments per digest and a base in the
hundreds of thousands, header characters are a real cost line.

> **Before you use it commercially:** run a PACRA company-name search and a
> trademark search. "Lelo" is a common word, which is exactly what makes it
> good branding and hard to protect — expect to register a composite mark (the
> wordmark *with* the sunrise device) rather than the word alone, and budget
> for a lawyer's opinion. A domain and social handles should be secured before
> a single advert runs.

## The tagline

**Know today, today.**

It states the benefit and the timeliness in four words, and it translates
without losing the pun's job — in Nyanja and Bemba the name itself carries it.

## The mark

A rising sun whose rays double as broadcast arcs: the day breaks, the message
arrives.

It is drawn twice, and the two must be kept in step:

- `public/brand/mark.svg` — the vector source, in a 64-unit space
- `scripts/genicons.js` — the same geometry, rendered to PNG with no
  dependencies for PWA icons and favicon fallbacks (`npm run icons`)

Design constraints it was built to survive, all of which are real in this
market:

- **A 16px favicon.** No thin detail, no gradients, two colours.
- **A one-colour screen print** on an agent's golf shirt.
- **A black-and-white newspaper advert.** The sun and the arcs still separate
  at greyscale because their values differ, not just their hues.

The sun sits clear of the horizon bar on purpose. Touching, it read as a hat.

## Colour

| Token | Hex | Use |
|---|---|---|
| Lelo Green | `#0B6E4F` | Badge, headings, primary buttons |
| Sunrise Amber | `#F6A828` | The sun, the horizon, accents |
| White | `#FFFFFF` | Signal arcs on the badge |

Green and amber are read as Zambian without literally reproducing the flag,
which keeps the mark usable and avoids any suggestion of official endorsement.

Dark mode lightens the green to `#6CC79A` for text while the badge keeps
`#0B6E4F`, so the mark is one asset in both themes.

## The wordmark

`public/brand/logo.svg` sets "Lelo" as **live text** so the file stays
editable. **Convert it to outlines before any print or signage use** — a
missing font turns a logo into a fallback serif at the worst possible moment.

A designer should also be commissioned to draw the wordmark properly. A system
font set at weight 700 is a good placeholder and an obvious one.

## Writing in the product

The copy rules are constraints, not style preferences:

- **GSM-7 only in anything that goes out by SMS or USSD.** One em dash or
  curly apostrophe forces UCS-2 and cuts the payload from 306 characters to
  134. `messaging.send()` and `ussd.respond()` normalise automatically, but
  write the plain character in the source so what you read is what is sent.
- **Fact first, context second.** Truncation eats the end of the line.
- **Never promise what a bulletin cannot deliver.** No "guaranteed", no
  "cure", no implication that paying brings a blessing.
- **Every outbound message carries the price and the way out.** `K1/day` and
  `STOP=stop` are not optional furniture.
