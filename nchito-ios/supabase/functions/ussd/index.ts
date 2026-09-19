// USSD webhook — see nchito-ios/INNOVATION.md §2.1.
//
// Speaks the Africa's Talking USSD protocol, which is the de-facto standard for
// Zambian shortcodes:
//   * request is form-encoded: sessionId, serviceCode, phoneNumber, text
//   * `text` is CUMULATIVE — every answer so far, joined by '*' — so the newest
//     input is the last segment
//   * response is plain text beginning with "CON " to keep the session open or
//     "END " to close it
//
// The user pays per session, on a phone with no data. Every response must fit
// one screen and every screen must be worth the seconds it costs.

import { Db } from "../_shared/db.ts";
import { handle } from "../_shared/menu.ts";

/** Africa's Talking sends +260…; the database stores the same E.164 form. */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.replace(/^260/, "").replace(/^0/, "");
  return `+260${local}`;
}

/**
 * Africa's Talking does not sign USSD callbacks. The documented protections are
 * IP allow-listing plus a secret in the callback URL, so we check the secret
 * here and the allow-list is configured at the aggregator. Without this, anyone
 * who found the URL could impersonate any subscriber.
 */
function isAuthorised(req: Request): boolean {
  const expected = Deno.env.get("USSD_CALLBACK_SECRET");
  if (!expected) return false;         // unset means misconfigured, not open
  const provided = new URL(req.url).searchParams.get("key") ??
                   req.headers.get("x-callback-secret") ?? "";
  // Constant-time-ish: compare full length regardless of where they differ.
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("END Method not allowed", { status: 405 });
  }
  if (!isAuthorised(req)) {
    // Deliberately terse: an attacker probing the endpoint learns nothing.
    return new Response("END Service unavailable", { status: 401 });
  }

  try {
    const form = new URLSearchParams(await req.text());
    const sessionId = form.get("sessionId") ?? "";
    const phone = normalisePhone(form.get("phoneNumber") ?? "");
    const cumulative = form.get("text") ?? "";

    if (!sessionId || phone === "+260") {
      return new Response("END Sorry, something went wrong.", ussdHeaders());
    }

    // Only the newest answer matters — the rest is replayed history we already
    // acted on, and re-applying it would repeat side effects like an application.
    const segments = cumulative.split("*");
    const input = cumulative === "" ? "" : segments[segments.length - 1];

    const db = new Db();
    const session = await db.loadSession("ussd", sessionId);
    const { reply, session: next } = await handle(input, session, phone, db);

    if (reply.done) {
      await db.clearSession("ussd", sessionId);
    } else {
      await db.saveSession("ussd", sessionId, phone, next);
    }

    return new Response(`${reply.done ? "END" : "CON"} ${reply.text}`, ussdHeaders());
  } catch (_error) {
    // A thrown error must still be valid USSD, or the subscriber sees a network
    // failure instead of a message.
    return new Response("END Sorry, Nchito is unavailable right now. Please try again.",
                        ussdHeaders());
  }
});

function ussdHeaders(): ResponseInit {
  return { headers: { "Content-Type": "text/plain; charset=utf-8" } };
}
