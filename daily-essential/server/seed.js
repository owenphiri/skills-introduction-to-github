'use strict';

/**
 * Seed a demonstrable database: districts, today's approved bulletin for every
 * vertical, and a handful of subscribers in each lifecycle state (trial,
 * funded, out of credit, stopped).
 *
 * Safe to re-run: it clears the tables it owns first.
 */
const db = require('./db');
const config = require('./config');
const wallet = require('./wallet');
const content = require('./content');

const DISTRICTS = [
  ['Lusaka', 'Lusaka'], ['Chongwe', 'Lusaka'], ['Kafue', 'Lusaka'], ['Chilanga', 'Lusaka'],
  ['Kitwe', 'Copperbelt'], ['Ndola', 'Copperbelt'], ['Chingola', 'Copperbelt'],
  ['Mufulira', 'Copperbelt'], ['Luanshya', 'Copperbelt'], ['Kalulushi', 'Copperbelt'],
  ['Chipata', 'Eastern'], ['Katete', 'Eastern'], ['Petauke', 'Eastern'], ['Lundazi', 'Eastern'],
  ['Kasama', 'Northern'], ['Mbala', 'Northern'], ['Mpika', 'Muchinga'], ['Chinsali', 'Muchinga'],
  ['Mansa', 'Luapula'], ['Samfya', 'Luapula'], ['Nchelenge', 'Luapula'],
  ['Solwezi', 'North-Western'], ['Kasempa', 'North-Western'], ['Mwinilunga', 'North-Western'],
  ['Kabwe', 'Central'], ['Kapiri Mposhi', 'Central'], ['Mkushi', 'Central'], ['Serenje', 'Central'],
  ['Livingstone', 'Southern'], ['Choma', 'Southern'], ['Mazabuka', 'Southern'],
  ['Monze', 'Southern'], ['Kalomo', 'Southern'],
  ['Mongu', 'Western'], ['Senanga', 'Western'], ['Kaoma', 'Western'], ['Sesheke', 'Western']
];

/**
 * A day's bulletin. Every line is written to survive truncation: the fact
 * comes first, the context second, because the second half is what gets cut.
 *
 * These are illustrative placeholders. In production each item arrives from
 * the source named in verticals.js and carries that attribution.
 */
const BULLETIN = [
  ['agri', null, 'Rain likely Thu-Fri countrywide. Hold off on top-dressing until after the rain.', 'ZMD'],
  ['agri', 'Chipata', 'Chipata maize K280/50kg, up K10. Soya K420/50kg steady.', 'ZNFU 4455'],
  ['agri', 'Mazabuka', 'Mazabuka maize K265/50kg. Groundnuts K700/50kg, buyers active.', 'ZNFU 4455'],
  ['mining', null, 'Copper ref USD 9,240/t, up 0.8%. Cobalt steady. Sell in lots, weigh before you travel.', 'LME ref'],
  ['mining', null, 'Small-scale mining licence renewals close end of month. Renew at the provincial office.', 'Ministry of Mines'],
  ['transport', null, 'Petrol K33.19/l, diesel K30.85/l — unchanged this cycle.', 'ERB'],
  ['transport', 'Lusaka', 'Great East Rd roadworks at Chelstone: single lane 06:00-18:00. Allow 30 min extra.', 'RDA'],
  ['health', null, 'Sleep under a treated net every night. Fever lasting 2 days: go to the clinic for a test.', 'MoH'],
  ['health', 'Lusaka', 'Free under-5 clinic days Wed and Fri this week at district health centres.', 'MoH'],
  ['money', null, 'No one from a mobile money company will ever ask for your PIN. Never read it out on a call.', 'Fraud desk'],
  ['money', null, 'BoZ mid rate: USD/ZMW 24.10. Compare two bureaux before you change money.', 'BoZ'],
  ['spirit', null, 'Be strong and of good courage; do not be afraid. — Joshua 1:9 (KJV)', 'Public domain'],
  ['jobs', null, 'ZESCO apprenticeship intake opens Monday. Apply on the ZESCO careers page, no fee is charged.', 'Gazette']
];

function seed() {
  console.log('Seeding Daily Essential…');

  db.exec(`
    DELETE FROM deliveries; DELETE FROM ledger_entries; DELETE FROM payments;
    DELETE FROM subscriptions; DELETE FROM wallet_accounts; DELETE FROM ussd_sessions;
    DELETE FROM subscribers; DELETE FROM content_items; DELETE FROM districts;
  `);

  const insertDistrict = db.prepare('INSERT INTO districts (name, province) VALUES (?, ?)');
  for (const [name, province] of DISTRICTS) insertDistrict.run(name, province);
  console.log(`  ${DISTRICTS.length} districts`);

  const districtId = name =>
    name ? db.prepare('SELECT id FROM districts WHERE name = ?').get(name)?.id ?? null : null;

  const today = db.today();
  for (const [vertical, district, body, source] of BULLETIN) {
    const item = content.addItem({
      verticalCode: vertical, body, validOn: today,
      districtId: districtId(district), source,
      priority: district ? 10 : 0   // local beats national for the same slot
    });
    content.approve(item.id, 'seed-editor');
  }
  console.log(`  ${BULLETIN.length} approved bulletin items for ${today}`);

  // --- Subscribers, one per lifecycle state -----------------------------
  const chipata = districtId('Chipata');
  const lusaka = districtId('Lusaka');
  const solwezi = districtId('Solwezi');

  // 1. Day-one trial user, farming + health.
  const trial = wallet.ensure('0971000001', { districtId: chipata });
  wallet.recordConsent(trial.id, 'ussd');

  // 2. Funded month subscriber on mining + money, trial already expired.
  const funded = wallet.ensure('0971000002', { districtId: solwezi });
  wallet.recordConsent(funded.id, 'ussd');
  db.prepare('UPDATE subscribers SET trial_ends_on = ? WHERE id = ?')
    .run(db.addDays(today, -10), funded.id);
  wallet.toggleTopic(funded.id, 'mining');
  wallet.toggleTopic(funded.id, 'agri');      // off — they are not a farmer
  wallet.creditTopup(funded.id, 3000, 'seed-month-1', 'Seed: 1 month bundle');

  // 3. Out of credit — exercises the low-balance nudge path.
  const broke = wallet.ensure('0971000003', { districtId: lusaka });
  wallet.recordConsent(broke.id, 'ussd');
  db.prepare("UPDATE subscribers SET trial_ends_on = ?, status = 'active' WHERE id = ?")
    .run(db.addDays(today, -30), broke.id);

  // 4. WhatsApp subscriber with the encouragement topic on.
  const wa = wallet.ensure('0971000004', { districtId: lusaka });
  wallet.recordConsent(wa.id, 'whatsapp');
  db.prepare("UPDATE subscribers SET whatsapp_opt_in_at = datetime('now') WHERE id = ?").run(wa.id);
  wallet.toggleTopic(wa.id, 'spirit');
  wallet.toggleTopic(wa.id, 'transport');
  wallet.creditTopup(wa.id, 700, 'seed-week-1', 'Seed: 1 week bundle');

  // 5. Opted out — must never receive anything again.
  const stopped = wallet.ensure('0971000005', { districtId: lusaka });
  wallet.recordConsent(stopped.id, 'ussd');
  wallet.stop(stopped.id, 'sms');

  console.log('  5 subscribers (trial, funded, out-of-credit, whatsapp, stopped)');
  console.log(`\nDone. Start with: npm start   (USSD short code ${config.shortCode})`);
}

if (require.main === module) seed();
module.exports = { seed, DISTRICTS, BULLETIN };
