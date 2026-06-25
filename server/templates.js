'use strict';

/**
 * Message templates with a native-speaker review workflow.
 *
 * Templates live in the `message_templates` table. `render()` only ever uses
 * an APPROVED translation; if the requested language has not been approved by a
 * native-speaker reviewer yet, it falls back to approved English. This guarantees
 * a guardian is never sent machine-drafted, unreviewed local-language copy.
 *
 * DEFAULTS below is the starter copy used to seed the table. The Bemba/Nyanja/
 * Tonga/Lozi strings are starting points that MUST be reviewed by native
 * speakers + the Ministry of Education before they are marked approved — which
 * is exactly what the review workflow enforces.
 */
const db = require('./db');

const DEFAULTS = {
  present: {
    en:  'SafeGirl: Your child {name} is present at school today. Thank you.',
    bem: 'SafeGirl: Umwana wenu {name} aliisa kusukulu lelo. Natotela.',
    nya: 'SafeGirl: Mwana wanu {name} wafika kusukulu lero. Zikomo.',
    toi: 'SafeGirl: Mwana wanu {name} wasika kucikolo sunu. Twalumba.',
    loz: 'SafeGirl: Mwanaa mina {name} u fitile sikolo kacenu. Ni itumezi.'
  },
  absent: {
    en:  'SafeGirl ALERT: Your child {name} was absent today. Kindly contact the school.',
    bem: 'SafeGirl: Umwana wenu {name} taisile kusukulu lelo. Mwafwaya ukwishiba isukulu.',
    nya: 'SafeGirl: Mwana wanu {name} sanafike kusukulu lero. Chonde lankhulani ndi sukulu.',
    toi: 'SafeGirl: Mwana wanu {name} taasiki kucikolo sunu. Amukwabane acikolo.',
    loz: 'SafeGirl: Mwanaa mina {name} ha si ka fita sikolo kacenu. Mu ikopanye ni sikolo.'
  },
  results: {
    en:  'SafeGirl: Monthly update — {name} scored an average of {avg}%. Encourage continued study.',
    bem: 'SafeGirl: {name} apatile {avg}% muli uyu mweshi. Mukoselesheni ukusambilila.',
    nya: 'SafeGirl: {name} wapeza {avg}% mwezi uno. Limbikitsani kuphunzira.',
    toi: 'SafeGirl: {name} wajana {avg}% mumwezi uno. Amumusungwaazye kuyiya.',
    loz: 'SafeGirl: {name} u fumani {avg}% kweli ye. Mu mu susuueze ku ituta.'
  },
  counseling: {
    en:  'SafeGirl: A parent meeting is scheduled for {date}. Your attendance is important.',
    bem: 'SafeGirl: Ukukumana kwa bafyashi kuli pa {date}. Mwise mukwabe.',
    nya: 'SafeGirl: Msonkhano wa makolo udzachitika pa {date}. Chonde bwerani.',
    toi: 'SafeGirl: Muswaangano wabazyali uli a {date}. Amusike.',
    loz: 'SafeGirl: Mukopano wa bashemi u ka ba ka {date}. Mu fite.'
  }
};

const languages = ['en', 'bem', 'nya', 'toi', 'loz'];

function interpolate(body, vars = {}) {
  return body.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
}

/**
 * Render an approved template. Falls back to approved English when the requested
 * language is not yet approved; falls back to the in-code default as a last resort.
 * @param {string} key  present | absent | results | counseling
 * @param {string} language
 * @param {object} vars  e.g. { name, avg, date }
 */
function render(key, language, vars = {}) {
  let row = db.prepare(
    "SELECT body FROM message_templates WHERE key = ? AND language = ? AND status = 'approved'"
  ).get(key, language);
  if (!row && language !== 'en') {
    row = db.prepare(
      "SELECT body FROM message_templates WHERE key = ? AND language = 'en' AND status = 'approved'"
    ).get(key);
  }
  const body = row ? row.body : (DEFAULTS[key]?.en || '');
  return interpolate(body, vars);
}

module.exports = { render, interpolate, languages, DEFAULTS };
