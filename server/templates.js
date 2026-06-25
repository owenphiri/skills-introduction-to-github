'use strict';

/**
 * Message templates for automated parent/guardian communication.
 * Supports the five languages in scope: English (en), Bemba (bem),
 * Nyanja (nya), Tonga (toi), Lozi (loz). Falls back to English.
 *
 * Translations here are starter copy — they MUST be reviewed by native
 * speakers and the Ministry of Education before national rollout.
 */
const T = {
  present: {
    en: name => `SafeGirl: Your child ${name} is present at school today. Thank you.`,
    bem: name => `SafeGirl: Umwana wenu ${name} aliisa kusukulu lelo. Natotela.`,
    nya: name => `SafeGirl: Mwana wanu ${name} wafika kusukulu lero. Zikomo.`,
    toi: name => `SafeGirl: Mwana wanu ${name} wasika kucikolo sunu. Twalumba.`,
    loz: name => `SafeGirl: Mwanaa mina ${name} u fitile sikolo kacenu. Ni itumezi.`
  },
  absent: {
    en: name => `SafeGirl ALERT: Your child ${name} was absent today. Kindly contact the school.`,
    bem: name => `SafeGirl: Umwana wenu ${name} taisile kusukulu lelo. Mwafwaya ukwishiba isukulu.`,
    nya: name => `SafeGirl: Mwana wanu ${name} sanafike kusukulu lero. Chonde lankhulani ndi sukulu.`,
    toi: name => `SafeGirl: Mwana wanu ${name} taasiki kucikolo sunu. Amukwabane acikolo.`,
    loz: name => `SafeGirl: Mwanaa mina ${name} ha si ka fita sikolo kacenu. Mu ikopanye ni sikolo.`
  },
  results: {
    en: (name, avg) => `SafeGirl: Monthly update — ${name} scored an average of ${avg}%. Encourage continued study.`,
    bem: (name, avg) => `SafeGirl: ${name} apatile ${avg}% muli uyu mweshi. Mukoselesheni ukusambilila.`,
    nya: (name, avg) => `SafeGirl: ${name} wapeza ${avg}% mwezi uno. Limbikitsani kuphunzira.`,
    toi: (name, avg) => `SafeGirl: ${name} wajana ${avg}% mumwezi uno. Amumusungwaazye kuyiya.`,
    loz: (name, avg) => `SafeGirl: ${name} u fumani ${avg}% kweli ye. Mu mu susuueze ku ituta.`
  },
  counseling: {
    en: (date) => `SafeGirl: A parent meeting is scheduled for ${date}. Your attendance is important.`,
    bem: (date) => `SafeGirl: Ukukumana kwa bafyashi kuli pa ${date}. Mwise mukwabe.`,
    nya: (date) => `SafeGirl: Msonkhano wa makolo udzachitika pa ${date}. Chonde bwerani.`,
    toi: (date) => `SafeGirl: Muswaangano wabazyali uli a ${date}. Amusike.`,
    loz: (date) => `SafeGirl: Mukopano wa bashemi u ka ba ka ${date}. Mu fite.`
  }
};

function render(key, language, ...args) {
  const set = T[key] || {};
  const fn = set[language] || set.en;
  return fn ? fn(...args) : '';
}

module.exports = { render, languages: ['en', 'bem', 'nya', 'toi', 'loz'] };
