'use strict';

/**
 * The service catalogue.
 *
 * Every vertical costs the same (nothing — the K1/day covers the whole
 * bundle). Choosing topics is about relevance, not price: a subscriber who
 * only wants mining prices should not receive maize prices, because an SMS
 * segment they did not want is both a cost to us and a reason to unsubscribe.
 *
 * `maxPerDigest` caps how many lines a vertical may contribute, so that the
 * daily SMS stays inside a predictable number of segments.
 */
const VERTICALS = {
  agri: {
    name: 'Farming',
    shortName: 'Farm',
    blurb: 'District weather, planting advice, maize/soya/groundnut prices.',
    maxPerDigest: 2,
    districtScoped: true,
    sources: ['Zambia Meteorological Department', 'ZNFU 4455 market prices']
  },
  mining: {
    name: 'Mining',
    shortName: 'Mine',
    blurb: 'Copper/cobalt/gold reference prices, licence deadlines, pit safety.',
    maxPerDigest: 2,
    districtScoped: false,
    // Artisanal and small-scale miners are the audience here, not the majors.
    sources: ['London Metal Exchange reference prices', 'Ministry of Mines notices']
  },
  transport: {
    name: 'Transport',
    shortName: 'Road',
    blurb: 'Fuel prices, road closures, RTSA deadlines, route fares.',
    maxPerDigest: 2,
    districtScoped: true,
    sources: ['ERB fuel price announcements', 'RTSA notices', 'RDA road bulletins']
  },
  health: {
    name: 'Health',
    shortName: 'Health',
    blurb: 'Malaria, maternal care, sanitation, outbreak alerts.',
    maxPerDigest: 1,
    districtScoped: true,
    // Health copy is general public-health information only. The approval
    // workflow in content.js refuses to publish health items that read as
    // individual diagnosis or prescription.
    requiresDisclaimer: true,
    sources: ['Ministry of Health', 'ZNPHI outbreak bulletins']
  },
  spirit: {
    name: 'Encouragement',
    shortName: 'Faith',
    blurb: 'A short daily scripture or encouragement to keep going.',
    maxPerDigest: 1,
    districtScoped: false,
    optInOnly: true,
    // Only public-domain or explicitly licensed texts — see docs/COMPLIANCE.md.
    sources: ['Public-domain scripture (KJV / World English Bible)']
  },
  money: {
    name: 'Money',
    shortName: 'Money',
    blurb: 'Mobile-money fraud warnings, forex rate, saving and borrowing tips.',
    maxPerDigest: 1,
    districtScoped: false,
    sources: ['Bank of Zambia daily rates', 'internal fraud desk']
  },
  jobs: {
    name: 'Jobs & Tenders',
    shortName: 'Jobs',
    blurb: 'Vacancies and tender notices you can actually apply for.',
    maxPerDigest: 1,
    districtScoped: true,
    sources: ['Government Gazette', 'ZPPA tender portal']
  }
};

const CODES = Object.keys(VERTICALS);

/** Verticals a brand-new subscriber gets before they customise anything. */
const DEFAULT_CODES = ['agri', 'health', 'money'];

function exists(code) {
  return Object.prototype.hasOwnProperty.call(VERTICALS, code);
}

function get(code) {
  return exists(code) ? { code, ...VERTICALS[code] } : null;
}

function list() {
  return CODES.map(get);
}

module.exports = { VERTICALS, CODES, DEFAULT_CODES, exists, get, list };
