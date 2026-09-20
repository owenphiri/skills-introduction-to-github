#!/usr/bin/env node
/*
 * Writes the service taxonomy into every surface that has to agree on it.
 *
 *   node nchito-shared/generate.mjs           # rewrite the mirrors
 *   node nchito-shared/generate.mjs --check   # fail if any mirror has drifted
 *
 * The mirrors are generated files and should not be hand-edited; edit
 * taxonomy.json and re-run. Migrations are deliberately NOT regenerated — a
 * migration that has been applied to a database is a historical fact, not a
 * mirror, so 0007/0008 are written once and then left alone.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const T = JSON.parse(readFileSync(join(here, "taxonomy.json"), "utf8"));
const L = JSON.parse(readFileSync(join(here, "languages.json"), "utf8"));

const check = process.argv.includes("--check");
const cats = T.categories;
const groups = T.groups;

// ---------- sanity, before anything is written ----------

const fail = (msg) => { console.error("taxonomy: " + msg); process.exit(2); };
const dupes = (xs) => xs.filter((x, i) => xs.indexOf(x) !== i);

if (dupes(cats.map(c => c.code)).length) fail("duplicate codes: " + dupes(cats.map(c => c.code)));
// Swift uses the display label as the enum rawValue, so two categories sharing
// a label would collapse into one case that silently fails to compile.
if (dupes(cats.map(c => c.label)).length) fail("duplicate labels: " + dupes(cats.map(c => c.label)));
const groupCodes = new Set(groups.map(g => g.code));
for (const c of cats) if (!groupCodes.has(c.group)) fail(`${c.code} is in unknown group ${c.group}`);
for (const c of cats) if (!/^[a-z][a-z0-9_]*$/.test(c.code)) fail(`${c.code} is not a safe enum literal`);
for (const c of cats) if (c.short.length > 16) fail(`${c.code} short label "${c.short}" is too long for USSD`);
for (const code of T._shipped_in_0001) {
  if (!cats.some(c => c.code === code)) {
    fail(`${code} shipped in 0001 and cannot be dropped — gig rows still carry it`);
  }
}
for (const g of groups) {
  if (!cats.some(c => c.group === g.code)) fail(`group ${g.code} has no categories`);
}

// A USSD screen is 182 characters with no scrolling. The group menu is the ONLY
// way into the catalogue from a feature phone, so a group that does not fit is
// a family of work that simply does not exist for those users. This is a real
// bug that shipped once already, and it is invisible unless it is measured.
const USSD_SCREEN_LIMIT = 182;
{
  const header = "What kind of work?";
  const footer = "\n9. Anything near me\n0. Back";
  const lines = groups.map((g, i) => `${i + 1}. ${g.short}`);
  const screen = [header, ...lines].join("\n") + footer;
  if (screen.length > USSD_SCREEN_LIMIT) {
    fail(`the USSD group menu is ${screen.length} chars, over the ${USSD_SCREEN_LIMIT} limit — ` +
         `shorten a group's "short" label or the whole menu silently loses its last entries`);
  }
  for (const g of groups) {
    const opts = cats.filter(c => c.group === g.code);
    const catScreen = [`${g.label}:`, ...opts.map((c, i) => `${i + 1}. ${c.short}`)].join("\n") + "\n0. Back";
    if (catScreen.length > USSD_SCREEN_LIMIT) {
      fail(`the USSD menu for ${g.code} is ${catScreen.length} chars, over the ${USSD_SCREEN_LIMIT} limit — ` +
           `split the group or shorten its categories' "short" labels`);
    }
  }
}

// ---------- languages ----------

const LANGS = L.languages;
const STRING_KEYS = Object.keys(L.strings);
const CAT_KEYS = Object.keys(L.categories).filter(k => k !== "_comment");
const LEX = Object.fromEntries(Object.entries(L.lexicon).filter(([k]) => k !== "_comment"));

if (LANGS[0].code !== "en") fail("English must be first — it is every other language's fallback");
for (const key of STRING_KEYS) {
  if (!L.strings[key].en) fail(`string ${key} has no English, so it has no fallback either`);
}
{
  const codes = LANGS.map(l => l.code);
  if (dupes(codes).length) fail("duplicate language codes: " + dupes(codes));
}

// Matching is by substring, so a term contained in another bucket's term
// silently steals it: type "chilimba" and a bucket containing "hi" wins.
{
  const terms = [];
  for (const [bucket, words] of Object.entries(LEX)) {
    for (const w of words) {
      if (w !== w.toLowerCase()) fail(`lexicon term ${JSON.stringify(w)} must be lower case — matching lowercases the input`);
      terms.push([bucket, w]);
    }
  }
  for (const [b1, w1] of terms) {
    for (const [b2, w2] of terms) {
      if (b1 === b2 || w1 === w2) continue;
      if (w2.includes(w1)) {
        fail(`lexicon term "${w1}" (${b1}) is inside "${w2}" (${b2}) — typing "${w2}" could route to ${b1}`);
      }
    }
  }
}

/** A language's share of strings actually translated, English excluded from the question. */
const coverage = (code) => code === "en" ? 1 :
  STRING_KEYS.filter(k => L.strings[k][code] != null).length / STRING_KEYS.length;

const FLOOR = L._minimum_coverage ?? 0.45;
// Below the floor a language is listed but not selectable. Hiding it entirely
// would suggest nobody thought about Southern or Western Province; offering a
// 34%-translated interface would just read as broken.
const langMeta = LANGS.map(l => ({
  ...l,
  coverage: coverage(l.code),
  available: coverage(l.code) >= FLOOR,
}));

const resolved = (code) => Object.fromEntries(
  STRING_KEYS.map(k => [k, L.strings[k][code] ?? L.strings[k].en]));

const catNames = (code) => Object.fromEntries(
  CAT_KEYS.filter(k => L.categories[k][code] != null).map(k => [k, L.categories[k][code]]));

const camel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const upper = s => s.toUpperCase();
const byGroup = g => cats.filter(c => c.group === g.code);
const pad = (s, n) => s + " ".repeat(Math.max(0, n - s.length));
const q = s => JSON.stringify(s);

const header = (comment, source = "taxonomy.json", extra = "") =>
  `${comment} Generated by nchito-shared/generate.mjs from ${source} — do not edit.\n` +
  `${comment} Run \`node nchito-shared/generate.mjs\` after changing it.\n` + extra;

// ---------- Swift ----------

const swift = () => {
  const caseW = Math.max(...cats.map(c => camel(c.code).length)) + 1;
  const arm = (c, body) => `    case .${pad(camel(c.code) + ":", caseW + 1)} return ${body}`;
  return header("//") + `
import Foundation

/// The eight families a service belongs to. Groups exist because 39 flat
/// categories is a wall of chips on a phone and six screens on USSD; nobody
/// browses that. Every surface shows groups first.
enum ServiceGroup: String, CaseIterable, Identifiable, Codable {
${groups.map(g => `    case ${pad(camel(g.code), 10)} = ${q(g.code)}`).join("\n")}

    var id: String { rawValue }

    var label: String {
        switch self {
${groups.map(g => `        case .${pad(camel(g.code) + ":", 11)} return ${q(g.label)}`).join("\n")}
        }
    }

    /// One line on why these belong together, shown under the group heading.
    var blurb: String {
        switch self {
${groups.map(g => `        case .${pad(camel(g.code) + ":", 11)} return ${q(g.blurb)}`).join("\n")}
        }
    }

    var emoji: String {
        switch self {
${groups.map(g => `        case .${pad(camel(g.code) + ":", 11)} return ${q(g.emoji)}`).join("\n")}
        }
    }

    /// The label used where a whole menu has to fit one USSD screen.
    var shortLabel: String {
        switch self {
${groups.map(g => `        case .${pad(camel(g.code) + ":", 11)} return ${q(g.short)}`).join("\n")}
        }
    }

    var categories: [GigCategory] { GigCategory.allCases.filter { $0.group == self } }
}

/// A service someone can be hired for.
///
/// The rawValue is DISPLAY text and may be reworded freely. The value Postgres
/// stores is \`wireValue\`, which must never change once shipped: gig rows
/// written months ago still carry it.
enum GigCategory: String, Codable, CaseIterable, Identifiable {
${cats.map(c => `    case ${pad(camel(c.code), caseW)} = ${q(c.label)}`).join("\n")}

    var id: String { rawValue }

    /// Exactly the value the Postgres \`gig_category\` enum stores.
    var wireValue: String {
        switch self {
${cats.map(c => arm(c, q(c.code))).join("\n")}
        }
    }

    var group: ServiceGroup {
        switch self {
${cats.map(c => arm(c, `.${camel(c.group)}`)).join("\n")}
        }
    }

    /// SF Symbol name.
    var icon: String {
        switch self {
${cats.map(c => arm(c, q(c.sf))).join("\n")}
        }
    }

    /// The short form used where space is scarce — USSD screens, dense chips.
    var shortLabel: String {
        switch self {
${cats.map(c => arm(c, q(c.short))).join("\n")}
        }
    }

    // from(wire:) comes from the WireRepresentable conformance declared in
    // WireFormat.swift, alongside every other enum that crosses the wire.
}
`;
};

// ---------- Kotlin ----------

const kotlin = () => {
  const nameW = Math.max(...cats.map(c => upper(c.code).length));
  return header("//") + `
package com.owenphiri.nchito.data

/**
 * The eight families a service belongs to. Groups exist because 39 flat
 * categories is a wall of chips on a phone and six screens on USSD; nobody
 * browses that. Every surface shows groups first.
 */
enum class ServiceGroup(
    val code: String,
    val label: String,
    /** The label used where a whole menu has to fit one USSD screen. */
    val short: String,
    val blurb: String,
    val emoji: String,
) {
${groups.map(g => `    ${pad(upper(g.code) + "(", 12)}${q(g.code)}, ${q(g.label)}, ${q(g.short)}, ${q(g.blurb)}, ${q(g.emoji)}),`).join("\n")}
    ;

    val categories: List<GigCategory> get() = GigCategory.entries.filter { it.group == this }

    companion object {
        fun fromCode(code: String): ServiceGroup? = entries.firstOrNull { it.code == code }
    }
}

/**
 * A service someone can be hired for.
 *
 * [label] is display text and may be reworded freely. [wire] is the value
 * Postgres stores and must never change once shipped: gig rows written months
 * ago still carry it.
 */
enum class GigCategory(
    val wire: String,
    val label: String,
    val short: String,
    val emoji: String,
    val group: ServiceGroup,
) {
${cats.map(c => `    ${pad(upper(c.code), nameW)}(${q(c.code)}, ${q(c.label)}, ${q(c.short)}, ${q(c.emoji)}, ServiceGroup.${upper(c.group)}),`).join("\n")}
    ;

    companion object {
        fun fromWire(wire: String): GigCategory? = entries.firstOrNull { it.wire == wire }
    }
}
`;
};

// ---------- Web ----------

const web = () => header("//") + `
const SERVICE_GROUPS = [
${groups.map(g => `  { id: ${q(g.code)}, label: ${q(g.label)}, short: ${q(g.short)}, blurb: ${q(g.blurb)}, emoji: ${q(g.emoji)} },`).join("\n")}
];

const CATEGORIES = [
${cats.map(c => `  { id: ${q(c.code)}, label: ${q(c.label)}, short: ${q(c.short)}, emoji: ${q(c.emoji)}, group: ${q(c.group)} },`).join("\n")}
];

const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const GROUP_BY_ID = Object.fromEntries(SERVICE_GROUPS.map(g => [g.id, g]));
const categoriesIn = groupId => CATEGORIES.filter(c => c.group === groupId);

/* A category code from an older build, or a typo, must not blank out a card. */
const categoryLabel = id => (CATEGORY_BY_ID[id] || { label: 'Other' }).label;
const categoryEmoji = id => (CATEGORY_BY_ID[id] || { emoji: '\\u{1F4CC}' }).emoji;
`;

// ---------- Edge Function (USSD / WhatsApp) ----------

const deno = () => header("//") + `
export interface CategoryEntry {
  code: string;
  label: string;
  short: string;
  group: string;
}

export interface GroupEntry {
  code: string;
  label: string;
  /** The label used where a whole menu has to fit one USSD screen. */
  short: string;
}

export const SERVICE_GROUPS: GroupEntry[] = [
${groups.map(g => `  { code: ${q(g.code)}, label: ${q(g.label)}, short: ${q(g.short)} },`).join("\n")}
];

export const CATEGORIES: CategoryEntry[] = [
${cats.map(c => `  { code: ${q(c.code)}, label: ${q(c.label)}, short: ${q(c.short)}, group: ${q(c.group)} },`).join("\n")}
];

export const categoriesIn = (group: string): CategoryEntry[] =>
  CATEGORIES.filter((c) => c.group === group);

export const categoryByCode = (code: string): CategoryEntry | undefined =>
  CATEGORIES.find((c) => c.code === code);
`;


// ---------- language emitters ----------

const langWeb = () => header("//", "languages.json") + `
/* ${langMeta.length} languages · ${langMeta.filter(l => l.available).length} offered in the picker.
   A language below ${(FLOOR * 100).toFixed(0)}% coverage is listed as coming soon rather than
   shipped half-English, and every untranslated string falls back to English. */
const LANGUAGES = [
${langMeta.map(l => `  { code: ${q(l.code)}, name: ${q(l.name)}, native: ${q(l.native)}, reviewed: ${l.reviewed}, available: ${l.available}, coverage: ${l.coverage.toFixed(3)}, asr: ${l.asr ? q(l.asr) : "null"}, tts: ${l.tts ? q(l.tts) : "null"}, note: ${q(l.note)} },`).join("\n")}
];

const STRINGS = {
${langMeta.map(l => `  ${q(l.code)}: ${JSON.stringify(resolved(l.code))},`).join("\n")}
};

/* Which keys are genuinely translated, as opposed to falling back. The UI uses
   this to be honest about a partly translated screen instead of pretending. */
const TRANSLATED = {
${langMeta.map(l => `  ${q(l.code)}: ${JSON.stringify(STRING_KEYS.filter(k => L.strings[k][l.code] != null))},`).join("\n")}
};

const CATEGORY_NAMES = {
${langMeta.map(l => `  ${q(l.code)}: ${JSON.stringify(catNames(l.code))},`).join("\n")}
};

const LEXICON = ${JSON.stringify(LEX, null, 2)};

const LANG_BY_CODE = Object.fromEntries(LANGUAGES.map(l => [l.code, l]));
`;

const langDeno = () => header("//", "languages.json") + `
export interface LanguageEntry {
  code: string;
  name: string;
  native: string;
  reviewed: boolean;
  available: boolean;
  coverage: number;
}

export const LANGUAGES: LanguageEntry[] = [
${langMeta.map(l => `  { code: ${q(l.code)}, name: ${q(l.name)}, native: ${q(l.native)}, reviewed: ${l.reviewed}, available: ${l.available}, coverage: ${l.coverage.toFixed(3)} },`).join("\n")}
];

const STRINGS: Record<string, Record<string, string>> = {
${langMeta.map(l => `  ${q(l.code)}: ${JSON.stringify(resolved(l.code))},`).join("\n")}
};

export const CATEGORY_NAMES: Record<string, Record<string, string>> = {
${langMeta.map(l => `  ${q(l.code)}: ${JSON.stringify(catNames(l.code))},`).join("\n")}
};

export const LEXICON: Record<string, string[]> = ${JSON.stringify(LEX, null, 2)};

/** Falls back to English, then to the key itself — never to an empty screen. */
export function t(lang: string, key: string): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}

/** A category's name in this language, or its English label if there isn't one. */
export function categoryName(lang: string, code: string, fallback: string): string {
  return CATEGORY_NAMES[lang]?.[code] ?? fallback;
}

/**
 * Routes free text to a menu bucket. Longest match wins, because "chilimba"
 * must not be beaten by a three-letter term that happens to sit inside it.
 */
export function route(text: string): string | null {
  const t = text.trim().toLowerCase();
  let best: string | null = null;
  let bestLen = 0;
  for (const [bucket, words] of Object.entries(LEXICON)) {
    for (const w of words) {
      if (t.includes(w) && w.length > bestLen) { best = bucket; bestLen = w.length; }
    }
  }
  return best;
}
`;

const langSwift = () => {
  const caseFor = c => c === "en" ? "english" : c === "ny" ? "nyanja" : c === "bem" ? "bemba"
                    : c === "toi" ? "tonga" : c === "loz" ? "lozi" : camel(c);
  return header("//", "languages.json") + `
import Foundation

/// The languages Nchito speaks. \`available\` is false below ${(FLOOR * 100).toFixed(0)}% coverage:
/// a half-translated interface reads as broken, and broken is worse than English.
enum AppLanguage: String, CaseIterable, Identifiable, Codable {
${langMeta.map(l => `    case ${pad(caseFor(l.code), 8)} = ${q(l.code)}`).join("\n")}

    var id: String { rawValue }

    var name: String {
        switch self {
${langMeta.map(l => `        case .${pad(caseFor(l.code) + ":", 9)} return ${q(l.name)}`).join("\n")}
        }
    }

    /// The language's name in itself — the only version a speaker of it scans for.
    var nativeName: String {
        switch self {
${langMeta.map(l => `        case .${pad(caseFor(l.code) + ":", 9)} return ${q(l.native)}`).join("\n")}
        }
    }

    /// False until a native speaker has signed the translation off.
    var isReviewed: Bool {
        switch self {
${langMeta.map(l => `        case .${pad(caseFor(l.code) + ":", 9)} return ${l.reviewed}`).join("\n")}
        }
    }

    var isAvailable: Bool {
        switch self {
${langMeta.map(l => `        case .${pad(caseFor(l.code) + ":", 9)} return ${l.available}`).join("\n")}
        }
    }

    /// BCP-47 tag for on-device speech recognition, or nil where none exists.
    /// Nil is the honest answer for every Zambian language today.
    var speechLocale: String? {
        switch self {
${langMeta.map(l => `        case .${pad(caseFor(l.code) + ":", 9)} return ${l.asr ? q(l.asr) : "nil"}`).join("\n")}
        }
    }

    static var offered: [AppLanguage] { allCases.filter(\\.isAvailable) }
}

enum Strings {
    static let table: [String: [String: String]] = [
${langMeta.map(l => `        ${q(l.code)}: ${JSON.stringify(resolved(l.code))},`).join("\n")}
    ]

    static let categoryNames: [String: [String: String]] = [
${langMeta.map(l => `        ${q(l.code)}: ${JSON.stringify(catNames(l.code))},`).join("\n")}
    ]

    /// Falls back to English, then to the key — a missing string never blanks a screen.
    static func t(_ key: String, _ language: AppLanguage) -> String {
        table[language.rawValue]?[key] ?? table["en"]?[key] ?? key
    }

    static func categoryName(_ category: GigCategory, _ language: AppLanguage) -> String {
        categoryNames[language.rawValue]?[category.wireValue] ?? category.rawValue
    }
}
`;
};

const langKotlin = () => {
  const nameFor = c => c === "en" ? "ENGLISH" : c === "ny" ? "NYANJA" : c === "bem" ? "BEMBA"
                     : c === "toi" ? "TONGA" : c === "loz" ? "LOZI" : upper(c);
  const kmap = (obj) => "mapOf(" + Object.entries(obj)
    .map(([k, v]) => `${q(k)} to ${q(v)}`).join(", ") + ")";
  return header("//", "languages.json") + `
package com.owenphiri.nchito.data

/**
 * The languages Nchito speaks. [available] is false below ${(FLOOR * 100).toFixed(0)}% coverage: a
 * half-translated interface reads as broken, and broken is worse than English.
 *
 * [speechLocale] is null wherever no on-device recogniser exists, which today
 * is every Zambian language.
 */
enum class AppLanguage(
    val code: String,
    val label: String,
    val nativeName: String,
    val reviewed: Boolean,
    val available: Boolean,
    val speechLocale: String?,
) {
${langMeta.map(l => `    ${pad(nameFor(l.code) + "(", 9)}${q(l.code)}, ${q(l.name)}, ${q(l.native)}, ${l.reviewed}, ${l.available}, ${l.asr ? q(l.asr) : "null"}),`).join("\n")}
    ;

    companion object {
        fun fromCode(code: String): AppLanguage? = entries.firstOrNull { it.code == code }
        val offered: List<AppLanguage> get() = entries.filter { it.available }
    }
}

object Strings {
    private val table: Map<String, Map<String, String>> = mapOf(
${langMeta.map(l => `        ${q(l.code)} to ${kmap(resolved(l.code))},`).join("\n")}
    )

    private val categoryNames: Map<String, Map<String, String>> = mapOf(
${langMeta.map(l => `        ${q(l.code)} to ${kmap(catNames(l.code))},`).join("\n")}
    )

    /** Falls back to English, then to the key — a missing string never blanks a screen. */
    fun t(key: String, language: AppLanguage): String =
        table[language.code]?.get(key) ?: table["en"]?.get(key) ?: key

    fun categoryName(category: GigCategory, language: AppLanguage): String =
        categoryNames[language.code]?.get(category.wire) ?: category.label
}
`;
};

// ---------- write / check ----------

const outputs = [
  ["nchito-ios/Nchito/Models/ServiceCatalog.swift", swift()],
  ["nchito-android/app/src/main/java/com/owenphiri/nchito/data/ServiceCatalog.kt", kotlin()],
  ["nchito-web/app/catalog.js", web()],
  ["nchito-ios/supabase/functions/_shared/catalog.ts", deno()],
  ["nchito-ios/Nchito/Models/LanguageCatalog.swift", langSwift()],
  ["nchito-android/app/src/main/java/com/owenphiri/nchito/data/LanguageCatalog.kt", langKotlin()],
  ["nchito-web/app/lang.js", langWeb()],
  ["nchito-ios/supabase/functions/_shared/lang.ts", langDeno()],
];

let drifted = 0;
for (const [rel, body] of outputs) {
  const path = join(root, rel);
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === body) { console.log("  ok      " + rel); continue; }
  if (check) { console.error("  DRIFTED " + rel); drifted++; continue; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  console.log((current === null ? "  created " : "  updated ") + rel);
}

if (check && drifted) {
  console.error(`\n${drifted} generated file(s) no longer match taxonomy.json.`);
  console.error("Run: node nchito-shared/generate.mjs");
  process.exit(1);
}
console.log(`\n${cats.length} categories in ${groups.length} groups${check ? " — all mirrors in sync" : ""}.`);
console.log(`${STRING_KEYS.length} strings in ${langMeta.length} languages:`);
for (const l of langMeta) {
  const bar = l.available ? "offered " : "HELD BACK";
  console.log(`  ${l.code.padEnd(4)} ${(l.coverage * 100).toFixed(0).padStart(3)}%  ${bar}  ` +
              `${l.reviewed ? "reviewed" : "NOT reviewed by a native speaker"}`);
}
