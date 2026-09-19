// WhatsApp webhook — see nchito-ios/INNOVATION.md §2.1.
//
// WhatsApp is where Zambians already coordinate work, so this is the channel
// that makes a gig shareable into the groups where hustles circulate. It speaks
// the Meta Cloud API:
//   * GET  — one-time subscription handshake (hub.challenge)
//   * POST — message events, signed with X-Hub-Signature-256 over the raw body
//
// It drives the same menu engine as USSD, so the two channels can never drift.

import { Db } from "../_shared/db.ts";
import { handle, mainMenu } from "../_shared/menu.ts";

const GRAPH_VERSION = "v21.0";

/**
 * Verifies Meta's HMAC-SHA256 over the RAW request body. This is the only thing
 * standing between the endpoint and anyone who can POST to it claiming to be
 * any phone number, so the body must be read as text and hashed byte for byte —
 * parsing first and re-serialising would change the bytes and break the check.
 */
async function isSignatureValid(rawBody: string, header: string | null): Promise<boolean> {
  const secret = Deno.env.get("WHATSAPP_APP_SECRET");
  if (!secret || !header?.startsWith("sha256=")) return false;

  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  const provided = header.slice("sha256=".length);
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function sendMessage(to: string, body: string): Promise<void> {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneNumberId) return;

  await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body, preview_url: false },
    }),
  });
}

/** wa_id arrives without a plus; the database stores E.164. */
function normalisePhone(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  return `+${digits}`;
}

/**
 * Words people actually type instead of a menu number. WhatsApp has no menu
 * discipline — someone will reply "balance" rather than "2" — so map the common
 * intents onto the same numbered choices the engine already understands.
 */
function interpret(text: string): string {
  const t = text.trim().toLowerCase();
  if (/^\d+$/.test(t)) return t;
  if (/^(hi|hello|hey|start|menu|muli bwanji|mwabuka)/.test(t)) return "";
  if (/(gig|work|job|ncito|nchito|find)/.test(t)) return "1";
  if (/(wallet|balance|money|cash|ndalama)/.test(t)) return "2";
  if (/(task|survey|quick)/.test(t)) return "3";
  if (/(record|cv|history)/.test(t)) return "4";
  return t;   // free text (a name, a town, an amount, a PIN) passes through
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Subscription handshake.
  if (req.method === "GET") {
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    if (url.searchParams.get("hub.verify_token") === verifyToken && verifyToken) {
      return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();
  if (!await isSignatureValid(rawBody, req.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  // Meta retries anything that is not a prompt 200, which would replay side
  // effects like an application. Acknowledge first, then do the work.
  const respond = () => new Response("OK", { status: 200 });

  try {
    const payload = JSON.parse(rawBody);
    const value = payload?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    // Delivery receipts and read receipts arrive here too; ignore them.
    if (!message || message.type !== "text") return respond();

    const waId = message.from as string;
    const phone = normalisePhone(waId);
    const text = (message.text?.body ?? "") as string;

    const db = new Db();
    const session = await db.loadSession("whatsapp", waId);

    // A returning user with no live session gets the menu rather than having
    // their "hello" interpreted as an answer to a question nobody asked.
    const input = session.node === "root" ? interpret(text) : text.trim();

    const { reply, session: next } = await handle(input, session, phone, db);

    if (reply.done) {
      await db.clearSession("whatsapp", waId);
      // USSD ends the call here; on WhatsApp the thread stays open, so offer
      // the way back rather than leaving them at a dead end.
      await sendMessage(waId, `${reply.text}\n\n—\nReply *menu* for more.`);
    } else {
      await db.saveSession("whatsapp", waId, phone, next);
      await sendMessage(waId, reply.text);
    }

    return respond();
  } catch (_error) {
    // Still 200: a 500 makes Meta retry a message we have already partly acted on.
    return respond();
  }
});

// Re-exported for the deployment guide's smoke test.
export { mainMenu };
