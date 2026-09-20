# Nchito offline channels — USSD & WhatsApp

Lets someone use Nchito from a K150 feature phone with no data: browse gigs, apply, check a balance, cash out, and sign up. See [INNOVATION.md §2.1](../../INNOVATION.md) for why this is the biggest reach item in the roadmap.

```
functions/
├── _shared/menu.ts   # the state machine — one engine, both channels
├── _shared/db.ts     # data access, strictly through the channel_* RPCs
├── ussd/index.ts     # Africa's Talking webhook (CON/END protocol)
└── whatsapp/index.ts # Meta Cloud API webhook (signature-verified)
```

Both adapters drive the same engine, so a feature added to one appears in the other and the channels cannot drift.

## Security model — read this first

Edge Functions connect with the **service role, which bypasses Row Level Security.** There is no `auth.uid()` on a USSD call, so the RLS policies that protect the apps do nothing here. Three things carry the weight instead:

1. **Every database call goes through a `channel_*` RPC** (migration `0004_offline_channels.sql`) that takes the caller's phone number and authorises against it itself. These RPCs are `REVOKE`d from `anon` and `authenticated` so they're unreachable from a browser, where anyone could pass someone else's number.
2. **The webhook itself is authenticated.** WhatsApp signs every request (`X-Hub-Signature-256`) and we verify it against the raw body. Africa's Talking does not sign USSD callbacks, so we check a secret in the callback URL and rely on their IP allow-list — configure both.
3. **The PIN is checked in the database, not in the function.** `channel_cash_out()` verifies the bcrypt hash, counts failed attempts and applies the lock-out, so a compromised function still cannot wave money through.

## Deploy

```bash
supabase functions deploy ussd --no-verify-jwt
supabase functions deploy whatsapp --no-verify-jwt
```

`--no-verify-jwt` is required: aggregators can't present a Supabase JWT. That's exactly why the authentication above is not optional.

### Secrets

```bash
supabase secrets set \
  USSD_CALLBACK_SECRET="$(openssl rand -hex 24)" \
  WHATSAPP_APP_SECRET="<Meta app secret>" \
  WHATSAPP_TOKEN="<permanent access token>" \
  WHATSAPP_PHONE_NUMBER_ID="<from the WhatsApp dashboard>" \
  WHATSAPP_VERIFY_TOKEN="$(openssl rand -hex 16)"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### USSD (Africa's Talking)

1. Apply for a shortcode through [Africa's Talking](https://africastalking.com) — they resell across MTN, Airtel and Zamtel in Zambia. Budget several weeks: shortcodes need operator approval, and this is the long pole in the whole feature.
2. Set the callback to `https://<project>.supabase.co/functions/v1/ussd?key=<USSD_CALLBACK_SECRET>`.
3. Enable their IP allow-list.

The suggested shortcode is `*384*62448#` — 62448 spells NCHIT on a keypad. It's referenced in both apps as one constant each (`AppState.ussdShortcode`, `AppViewModel.USSD_SHORTCODE`); change it there if the operator assigns something else.

### WhatsApp (Meta Cloud API)

1. Create a Meta app, add the WhatsApp product, and get a permanent token.
2. Set the callback to `https://<project>.supabase.co/functions/v1/whatsapp` with your `WHATSAPP_VERIFY_TOKEN`.
3. Subscribe to the `messages` webhook field.

WhatsApp is the cheaper and faster of the two to launch — no operator approval — and it's where Zambians already coordinate work, so ship it first and let USSD follow when the shortcode clears.

## Design notes worth keeping

**USSD screens are 182 characters, with no scrolling and no going back.** `clamp()` trims on a word boundary, and the gig list reserves room for its own footer rather than letting a clamp eat the instruction line — losing "reply with a number" strands the user completely. The list also only offers gigs that actually fit on screen, so option 3 can never point at something they never saw.

**USSD `text` is cumulative.** Africa's Talking replays every answer so far, joined by `*`. Only the last segment is new; acting on the whole string would re-apply earlier steps and, for example, submit an application twice.

**WhatsApp has no menu discipline.** People type "balance" rather than "2", so `interpret()` maps common words — including Nyanja ones like *ndalama* — onto the numbered choices the engine understands. Free text (a name, a town, an amount, a PIN) passes straight through.

**Meta retries anything that isn't a prompt 200.** The webhook acknowledges first and returns 200 even on error, because a 500 makes Meta resend a message we may already have acted on.

**Early payment is PIN-gated like cash-out**, and the fee is quoted on screen before the PIN prompt — nobody should enter a PIN against a number they haven't seen. The 4%-minimum-K5 fee shown by the menu is the same formula `advance_fee()` charges.

**The agent finder states uncertainty in words**, since USSD has no colour: an unreported agent reads "not reported yet", never anything that could pass for reassurance. Like the gig list, it reserves room for its trailing line rather than letting a clamp eat it.

**Sessions expire after 30 minutes**, so an abandoned cash-out can't be resumed later from a different context.

## Testing before a shortcode exists

Africa's Talking has a USSD simulator that posts the same payload. You can also exercise it directly:

```bash
curl -X POST "https://<project>.supabase.co/functions/v1/ussd?key=<secret>" \
  -d "sessionId=test-1&phoneNumber=%2B260971234567&text="
# -> CON Nchito 🇿🇲 ...

curl -X POST "https://<project>.supabase.co/functions/v1/ussd?key=<secret>" \
  -d "sessionId=test-1&phoneNumber=%2B260971234567&text=1"
# -> CON What kind of work? ...
```
