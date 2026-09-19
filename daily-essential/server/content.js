'use strict';

/**
 * The content engine: what goes out, to whom, and how much of it fits.
 *
 * The hard constraint the whole design bends around is length. A daily SMS
 * that spills into a third segment costs 50% more to send than a two-segment
 * one, every day, for every subscriber — at K1/day of revenue that is the
 * difference between a margin and a loss. So the digest is assembled against
 * an explicit character budget and is truncated deterministically, never
 * "usually short enough".
 */
const db = require('./db');
const config = require('./config');
const verticals = require('./verticals');

/* ------------------------------------------------------------ LENGTH -- */

// GSM 03.38 basic set plus the common extensions. Anything outside this
// forces the whole message to UCS-2 and more than halves the payload.
const GSM7 = new Set(
  ('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
   '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà').split('')
);
const GSM7_EXTENDED = new Set('^{}\\[~]|€'.split(''));

function isGsm7(text) {
  for (const ch of text) if (!GSM7.has(ch) && !GSM7_EXTENDED.has(ch)) return false;
  return true;
}

/**
 * Replace characters that fall outside GSM-7 with equivalents that do not.
 *
 * This is worth more than it looks. A single em dash or curly apostrophe —
 * the kind a copy-paste from a press release carries in silently — forces the
 * entire message to UCS-2 and cuts the payload from 306 characters to 134.
 * Normalising on the way in doubles the capacity of the daily digest for free.
 *
 * Characters with no safe equivalent (Bemba ŋ, for instance) are left alone
 * and correctly force UCS-2, because mangling a local-language word to save a
 * segment is not a trade worth making.
 */
const GSM7_SUBSTITUTIONS = [
  [/[‘’‛′]/g, "'"],   // curly single quotes, prime
  [/[“”‟″]/g, '"'],   // curly double quotes
  [/[‐-―−]/g, '-'],        // hyphens, en/em dash, minus
  [/…/g, '...'],
  [/[   ]/g, ' '],         // non-breaking spaces
  [/•/g, '-'],                       // bullet
  [/[⁄∕]/g, '/'],
  [/°/g, 'deg'],
  [/–/g, '-']
];

function toGsm7Safe(text) {
  let out = String(text);
  for (const [re, replacement] of GSM7_SUBSTITUTIONS) out = out.replace(re, replacement);
  return out;
}

/** Billable length: extended characters occupy two positions. */
function gsm7Length(text) {
  let n = 0;
  for (const ch of text) n += GSM7_EXTENDED.has(ch) ? 2 : 1;
  return n;
}

/** How many SMS segments `text` will be billed as. */
function segments(text) {
  if (isGsm7(text)) {
    const len = gsm7Length(text);
    return len <= 160 ? 1 : Math.ceil(len / 153);
  }
  // UCS-2 — any Bemba/Nyanja orthography outside GSM-7 lands here.
  const len = [...text].length;
  return len <= 70 ? 1 : Math.ceil(len / 67);
}

/** Largest payload that still bills as `n` segments. */
function budgetFor(n, unicode = false) {
  if (unicode) return n === 1 ? 70 : 67 * n;
  return n === 1 ? 160 : 153 * n;
}

/**
 * The shortest useful line, and the least of an item worth keeping.
 *
 * A half-line is worse than no line: "licence renewals close end of." tells a
 * miner nothing and still costs a segment. An item that cannot keep most of
 * itself is dropped and reported in `dropped` instead.
 */
const MIN_LINE_CHARS = 40;
const MIN_KEPT_FRACTION = 0.7;

function fitsUsefully(body, remaining) {
  if (remaining >= body.length) return true;
  return remaining >= Math.max(MIN_LINE_CHARS, Math.ceil(body.length * MIN_KEPT_FRACTION));
}

// Cutting after one of these leaves a dangling article or preposition
// ("...until after the.") which reads like a fault rather than a summary.
const DANGLING = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'from',
  'and', 'or', 'with', 'is', 'are', 'was', 'be', 'per', 'up', 'down', 'no'
]);

/** Cut to `limit` on a word boundary where possible, with a trailing dot. */
function clamp(text, limit) {
  const t = text.trim();
  if (t.length <= limit) return t;
  if (limit <= 1) return t.slice(0, Math.max(0, limit));

  const cut = t.slice(0, limit - 1);
  const space = cut.lastIndexOf(' ');
  let body = space > limit * 0.6 ? cut.slice(0, space) : cut;

  // Walk back over trailing filler words and punctuation.
  for (;;) {
    const trimmed = body.replace(/[\s,;:.\-]+$/, '');
    const lastSpace = trimmed.lastIndexOf(' ');
    const lastWord = trimmed.slice(lastSpace + 1).toLowerCase();
    if (lastSpace <= 0 || !DANGLING.has(lastWord)) { body = trimmed; break; }
    body = trimmed.slice(0, lastSpace);
  }
  return `${body}.`;
}

/* ----------------------------------------------------------- EDITORIAL -- */

/**
 * Health copy must stay general public-health information. Individual
 * diagnosis or prescription is the practice of medicine, and we are not
 * licensed to practise it over SMS.
 *
 * This is a backstop against an editor's slip, not a substitute for the
 * clinician sign-off required in docs/COMPLIANCE.md.
 */
const CLINICAL_RED_FLAGS = [
  /\byou (?:have|are suffering from|are infected with)\b/i,
  /\btake \d+\s*(?:mg|ml|tablets?|capsules?)\b/i,
  /\b(?:dosage|dose) (?:of|is)\b/i,
  /\b(?:cures?|cured|will cure|guaranteed cure)\b/i,
  /\bstop taking your\b/i,
  /\bno need to (?:see|visit) (?:a )?(?:doctor|clinic|nurse)\b/i
];

function clinicalConcerns(body) {
  return CLINICAL_RED_FLAGS.filter(re => re.test(body)).map(re => re.source);
}

function addItem({ verticalCode, body, validOn, districtId = null, language = 'en', source = null, priority = 0 }) {
  if (!verticals.exists(verticalCode)) throw new Error(`Unknown vertical: ${verticalCode}`);
  // Normalise on the way in, so a pasted em dash never costs a segment later.
  const text = toGsm7Safe(String(body || '')).trim();
  if (!text) throw new Error('Content body is empty');
  db.prepare(
    'INSERT INTO content_items (vertical_code, district_id, language, body, valid_on, source, priority) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(verticalCode, districtId, language, text, validOn || db.today(), source, priority);
  return db.prepare('SELECT * FROM content_items ORDER BY id DESC LIMIT 1').get();
}

/**
 * Approve an item for delivery. Refuses health copy that trips a clinical
 * red flag — the editor must rewrite it or route it through a clinician.
 */
function approve(id, approvedBy) {
  const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(id);
  if (!item) throw new Error(`No content item ${id}`);

  if (item.vertical_code === 'health') {
    const concerns = clinicalConcerns(item.body);
    if (concerns.length) {
      const err = new Error('Health copy reads as individual medical advice and cannot be auto-approved');
      err.status = 422;
      err.concerns = concerns;
      throw err;
    }
  }

  db.prepare("UPDATE content_items SET approved_by = ?, approved_at = datetime('now') WHERE id = ?")
    .run(approvedBy, id);
  db.audit(approvedBy, 'content.approved', `item:${id} vertical:${item.vertical_code}`);
  return db.prepare('SELECT * FROM content_items WHERE id = ?').get(id);
}

/* -------------------------------------------------------------- DIGEST -- */

/**
 * Pick the best approved line per subscribed vertical.
 *
 * Preference order within a vertical: the subscriber's own district and
 * language first, then nationwide, then English. A Chipata subscriber gets
 * the Chipata weather; if there is none, they get the national bulletin
 * rather than silence.
 */
function itemsFor(subscriber, date, codes) {
  const picked = [];
  for (const code of codes) {
    const v = verticals.get(code);
    if (!v) continue;
    const rows = db.prepare(`
      SELECT *,
             (district_id IS NOT NULL AND district_id = ?) AS district_match,
             (language = ?)                                AS language_match
        FROM content_items
       WHERE vertical_code = ?
         AND valid_on = ?
         AND approved_at IS NOT NULL
         AND (district_id IS NULL OR district_id = ?)
         AND (language = ? OR language = 'en')
       ORDER BY district_match DESC, language_match DESC, priority DESC, id ASC
       LIMIT ?
    `).all(
      subscriber.district_id, subscriber.language, code, date,
      subscriber.district_id, subscriber.language, v.maxPerDigest
    );
    for (const r of rows) picked.push({ ...r, vertical: v });
  }
  return picked;
}

/**
 * Build the SMS digest for one subscriber on one day.
 *
 * Returns { body, segments, used, dropped } — `dropped` names the verticals
 * that did not fit, which is the signal the ops team needs to see when the
 * budget is too tight for the topics people are actually buying.
 */
function buildDigest(subscriber, date = db.today(), { maxSegments = 2, balanceNgwee = null } = {}) {
  const codes = db.prepare('SELECT vertical_code FROM subscriptions WHERE subscriber_id = ? ORDER BY vertical_code')
    .all(subscriber.id).map(r => r.vertical_code);
  const items = itemsFor(subscriber, date, codes);

  const header = `${config.serviceName} ${date.slice(8)}/${date.slice(5, 7)}`;
  // The footer carries the two things support calls are always about: what
  // it costs and how to stop.
  const footer = balanceNgwee == null
    ? `K1/day. STOP=stop. ${config.shortCode}`
    : `K1/day. Bal ${require('./money').format(balanceNgwee)}. STOP=stop.`;

  const unicode = !isGsm7(header + footer + items.map(i => i.body).join(''));
  const budget = budgetFor(maxSegments, unicode);

  const lines = [];
  const dropped = [];
  let used = header.length + 1 + footer.length + 1;

  for (const item of items) {
    const prefix = `${item.vertical.shortName}: `;
    const remaining = budget - used - prefix.length - 1;
    if (!fitsUsefully(item.body, remaining)) { dropped.push(item.vertical_code); continue; }
    const line = prefix + clamp(item.body, remaining);
    lines.push(line);
    used += line.length + 1;
  }

  const body = [header, ...lines, footer].join('\n');
  return { body, segments: segments(body), used, dropped, itemCount: lines.length };
}

/**
 * The same content for a USSD screen: one 182-character screen, no footer,
 * because the subscriber is already looking at the menu that explains price.
 */
function buildUssdDigest(subscriber, date = db.today()) {
  const codes = db.prepare('SELECT vertical_code FROM subscriptions WHERE subscriber_id = ?')
    .all(subscriber.id).map(r => r.vertical_code);
  const items = itemsFor(subscriber, date, codes);
  if (!items.length) return 'No bulletin published yet today. Try again after 06:00.';

  const budget = config.limits.ussdScreenChars;
  const lines = [];
  let used = 0;
  for (const item of items) {
    const prefix = `${item.vertical.shortName}: `;
    const remaining = budget - used - prefix.length - 1;
    if (!fitsUsefully(item.body, remaining)) continue;
    const line = prefix + clamp(item.body, remaining);
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join('\n');
}

module.exports = {
  isGsm7, gsm7Length, toGsm7Safe, segments, budgetFor, clamp, fitsUsefully,
  clinicalConcerns, addItem, approve, itemsFor, buildDigest, buildUssdDigest
};
