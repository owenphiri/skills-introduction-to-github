'use strict';

/**
 * Money handling. One rule: amounts are integer ngwee everywhere — in the
 * database, in the ledger, in API payloads. Kwacha only appear at the moment
 * a human reads them.
 */

const NGWEE_PER_KWACHA = 100;

/** "1", "1.50", 1.5 -> ngwee. Throws on anything that is not clean money. */
function toNgwee(kwacha) {
  const n = typeof kwacha === 'number' ? kwacha : Number(String(kwacha).trim());
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid amount: ${kwacha}`);
  const ngwee = Math.round(n * NGWEE_PER_KWACHA);
  if (Math.abs(n * NGWEE_PER_KWACHA - ngwee) > 1e-6) {
    throw new Error(`Amount ${kwacha} is finer than one ngwee`);
  }
  return ngwee;
}

/** 750 -> "K7.50". Used in SMS/USSD copy, so it stays short. */
function format(ngwee) {
  const sign = ngwee < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(ngwee));
  return `${sign}K${Math.floor(abs / NGWEE_PER_KWACHA)}.${String(abs % NGWEE_PER_KWACHA).padStart(2, '0')}`;
}

/**
 * Top-up bundles.
 *
 * The service is priced at K1/day but is NOT collected daily: a mobile-money
 * collection carries a per-transaction fee that would swallow a K1 charge
 * whole. Subscribers buy days in a bundle, and the daily ledger draws K1 from
 * the resulting credit. See docs/UNIT_ECONOMICS.md.
 */
const BUNDLES = [
  { code: 'D3', label: '3 days', days: 3, priceNgwee: 300 },
  { code: 'W1', label: '1 week', days: 7, priceNgwee: 700 },
  { code: 'M1', label: '1 month', days: 30, priceNgwee: 3000 },
  { code: 'M3', label: '3 months', days: 90, priceNgwee: 8500 }
];

function bundle(code) {
  return BUNDLES.find(b => b.code === String(code || '').toUpperCase()) || null;
}

module.exports = { NGWEE_PER_KWACHA, toNgwee, format, BUNDLES, bundle };
