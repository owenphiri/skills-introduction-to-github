/*
 * Drives the USSD/WhatsApp menu engine with a stub database.
 *
 *   node --experimental-strip-types nchito-ios/supabase/functions/_test/menu.test.mts
 *
 * (Deno resolves the .ts imports directly. Under Node the _shared files need
 *  copying to .mts first — see nchito-web/verify.mjs for the same trick.)
 *
 * What it is actually guarding:
 *
 *   · The main menu fits 182 characters IN EVERY LANGUAGE OFFERED. Nyanja and
 *     Bemba words are longer than English ones, and a USSD screen cannot
 *     scroll, so a menu that fits in English and spills in Nyanja silently
 *     loses its last options.
 *   · Vernacular routing sends "ndalama" to the wallet and "chilimba" to the
 *     circle — longest match wins, so a short word cannot steal a long one.
 *   · A chilimba contribution from a handset goes through the PIN, and a wrong
 *     PIN is refused.
 */
import { handle, mainMenu, languageMenu, USSD_SCREEN_LIMIT, clamp } from "../_shared/menu.ts";
import { route } from "../_shared/lang.ts";

const problems: string[] = [];
const bad = (m: string) => { problems.push(m); console.log("  ✗ " + m); };

console.log("=== main menu, every offered language ===");
for (const lang of ["en", "ny", "bem"]) {
  const m = mainMenu(lang);
  const lines = m.split("\n").length;
  console.log(`\n[${lang}] ${m.length}/${USSD_SCREEN_LIMIT} chars, ${lines} lines`);
  console.log(m.split("\n").map(l => "   " + l).join("\n"));
  if (m.length > USSD_SCREEN_LIMIT) bad(`${lang} main menu is ${m.length} chars`);
  if (lines !== 9) bad(`${lang} main menu has ${lines} lines, expected 9`);
}

console.log("\n=== language menu ===");
const lm = languageMenu("en");
console.log(lm.split("\n").map(l => "   " + l).join("\n"));
if (lm.length > USSD_SCREEN_LIMIT) bad(`language menu is ${lm.length} chars`);
if (/Chitonga|Silozi/.test(lm)) bad("a held-back language is being offered");

console.log("\n=== vernacular routing ===");
const cases: Array<[string, string | null]> = [
  ["ndalama", "wallet"], ["Indalama zanga", "wallet"], ["mali", "wallet"],
  ["ntchito", "gigs"], ["incito", "gigs"], ["I need work", "gigs"],
  ["chilimba", "circle"], ["icilimba candi", "circle"],
  ["muli bwanji", "greet"], ["hello", "greet"],
  ["ejenti", "agents"], ["cv", null], ["mbiri yanga", "record"],
  ["thandizo", "help"], ["1234", null],
];
for (const [input, expected] of cases) {
  const got = route(input);
  const ok = got === expected;
  console.log(`   ${ok ? "ok " : "BAD"} ${JSON.stringify(input).padEnd(20)} -> ${got}`);
  if (!ok) bad(`"${input}" routed to ${got}, expected ${expected}`);
}

console.log("\n=== the menu engine drives a chilimba payment ===");
const db: any = {
  profile: async () => ({ id: "u1", phone: "+260970000000", full_name: "Owen", city: "Lusaka" }),
  language: async () => "ny",
  setLanguage: async () => {},
  myChilimbas: async () => ([
    { circle_id: "c1", name: "Soweto Traders", contribution: 200, status: "active",
      current_round: 2, my_position: 2, paid_this_round: false, net: 200 },
    { circle_id: "c2", name: "Kabwata Ladies Association", contribution: 500, status: "active",
      current_round: 1, my_position: 4, paid_this_round: true, net: -300 },
  ]),
  chilimbaContribute: async (_p: string, c: string, pin: string) =>
    pin === "1234" ? `Paid K200 into ${c}.` : "Wrong PIN.",
};

let session = { node: "root", data: {} as Record<string, string> };
const step = async (input: string) => {
  const r = await handle(input, session, "+260970000000", db);
  session = r.session;
  return r.reply;
};

const menu = await step("");
console.log(`\n   dial in (profile language is Nyanja):`);
console.log(menu.text.split("\n").map(l => "     " + l).join("\n"));
if (!/Pezani ntchito/.test(menu.text)) bad("the dial-in menu is not in the caller's language");

const list = await step("7");
console.log(`\n   option 7 — ${list.text.length}/${USSD_SCREEN_LIMIT} chars:`);
console.log(list.text.split("\n").map(l => "     " + l).join("\n"));
if (list.text.length > USSD_SCREEN_LIMIT) bad(`chilimba list is ${list.text.length} chars`);
if (!/net/.test(list.text)) bad("the net position is missing from the feature-phone view");
if (session.node !== "chilimba_pick") bad(`node is ${session.node}, expected chilimba_pick`);

const pinPrompt = await step("1");
console.log(`\n   picked circle 1: ${JSON.stringify(pinPrompt.text)}`);
if (session.node !== "chilimba_pin") bad(`node is ${session.node}, expected chilimba_pin`);
if (/No —/.test(pinPrompt.text)) bad("placeholder text leaked into the PIN prompt");

const wrong = await step("9999");
console.log(`   wrong PIN: ${JSON.stringify(wrong.text)}`);
if (!/Wrong PIN/.test(wrong.text)) bad("a wrong PIN was not refused");

session = { node: "root", data: {} };
await step(""); await step("7");
const paid = await step("1").then(() => step("1234"));
console.log(`   right PIN: ${JSON.stringify(paid.text)}`);
if (!/Paid K200/.test(paid.text)) bad("a correct PIN did not pay in");

console.log("\n=== language switch from the handset ===");
session = { node: "root", data: {} };
await step("");
const langScreen = await step("8");
console.log(langScreen.text.split("\n").map(l => "     " + l).join("\n"));
if (session.node !== "language") bad(`node is ${session.node}, expected language`);
const after = await step("1");
console.log(`   after choosing English:\n` + after.text.split("\n").map(l => "     " + l).join("\n"));
if (!/Find gigs/.test(after.text)) bad("switching to English did not change the menu");

console.log("\n" + "=".repeat(50));
if (problems.length) { console.log(`${problems.length} problem(s)`); process.exit(1); }
console.log("USSD and WhatsApp checks passed.");
