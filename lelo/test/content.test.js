'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const h = require('./helpers');

const db = require('../server/db');
const wallet = require('../server/wallet');
const content = require('../server/content');
const billing = require('../server/billing');
const messaging = require('../server/messaging');
const whatsapp = require('../server/whatsapp');

before(h.start);
after(h.stop);

test('SMS segment counting follows the GSM-7 and UCS-2 rules', () => {
  assert.equal(content.segments('a'.repeat(160)), 1);
  assert.equal(content.segments('a'.repeat(161)), 2);
  assert.equal(content.segments('a'.repeat(306)), 2);
  assert.equal(content.segments('a'.repeat(307)), 3);
  // A single non-GSM character drops the whole message to UCS-2.
  assert.equal(content.isGsm7('Mwapoleni mukwai'), true);
  assert.equal(content.isGsm7('Ŋanda'), false);
  assert.equal(content.segments('Ŋ' + 'a'.repeat(69)), 1);
  assert.equal(content.segments('Ŋ' + 'a'.repeat(70)), 2);
});

test('a single em dash must not halve the payload', () => {
  const scripture = 'Be strong and of good courage; do not be afraid. — Joshua 1:9 (KJV)';
  assert.equal(content.isGsm7(scripture), false, 'an em dash is outside GSM-7');
  assert.equal(content.isGsm7(content.toGsm7Safe(scripture)), true);
  assert.equal(content.toGsm7Safe('don’t “quote”…'), 'don\'t "quote"...');
  // Characters with no safe equivalent are left alone rather than mangled.
  assert.equal(content.toGsm7Safe('ŋanda'), 'ŋanda');
});

test('content is normalised to GSM-7 on the way in', () => {
  const item = content.addItem({
    verticalCode: 'spirit',
    body: 'Courage — don’t be afraid.',
    validOn: db.today()
  });
  assert.equal(item.body, "Courage - don't be afraid.");
  assert.equal(content.isGsm7(item.body), true);
});

test('truncation never leaves a dangling article or preposition', () => {
  const text = 'Hold off on top-dressing until after the rain';
  const cut = content.clamp(text, 40);
  assert.ok(cut.length <= 40);
  assert.ok(!/\b(the|a|an|of|to|and|for)\.$/i.test(cut), `dangling word in: ${cut}`);
});

test('an item that cannot keep most of itself is dropped, not stubbed', () => {
  const body = 'Small-scale mining licence renewals close end of month at the provincial office.';
  assert.equal(content.fitsUsefully(body, body.length), true);
  assert.equal(content.fitsUsefully(body, Math.ceil(body.length * 0.9)), true);
  assert.equal(content.fitsUsefully(body, Math.floor(body.length * 0.5)), false);
  assert.equal(content.fitsUsefully('Short line', 6), false, 'a short item must fit whole');
});

test('clamp cuts on a word boundary and never exceeds the limit', () => {
  const text = 'Chipata maize K280 per 50kg bag, up K10 on last week';
  for (const limit of [10, 20, 30, 40, 52, 80]) {
    assert.ok(content.clamp(text, limit).length <= limit, `limit ${limit}`);
  }
  assert.equal(content.clamp('short', 50), 'short');
});

test('the daily digest stays inside its segment budget', () => {
  const sub = wallet.findByMsisdn('0971000002');
  const digest = content.buildDigest(sub, db.today(), { balanceNgwee: 2900 });
  assert.ok(digest.segments <= 2, `digest billed as ${digest.segments} segments:\n${digest.body}`);
  assert.match(digest.body, /STOP=stop/, 'every message must carry an opt-out');
});

test('a subscriber sees their own district, not someone else’s', () => {
  const chipata = wallet.findByMsisdn('0971000001');
  const digest = content.buildDigest(chipata, db.today());
  assert.match(digest.body, /Chipata/, 'local market price should win the slot');
  assert.ok(!/Mazabuka/.test(digest.body), 'another district must not leak in');
});

test('health copy that reads as personal medical advice is refused', () => {
  const item = content.addItem({
    verticalCode: 'health',
    body: 'If you have a fever you have malaria — take 4 tablets twice daily, no need to see a doctor.',
    validOn: db.today()
  });
  assert.throws(() => content.approve(item.id, 'editor'), err => {
    assert.equal(err.status, 422);
    assert.ok(err.concerns.length >= 2);
    return true;
  });
  const stored = db.prepare('SELECT approved_at FROM content_items WHERE id = ?').get(item.id);
  assert.equal(stored.approved_at, null, 'refused copy must stay unapproved');
});

test('general public-health copy approves normally', () => {
  const item = content.addItem({
    verticalCode: 'health',
    body: 'Wash hands with soap before eating. Fever lasting two days: visit your nearest clinic for a test.',
    validOn: db.today()
  });
  assert.ok(content.approve(item.id, 'editor').approved_at);
});

test('unapproved content never reaches a digest', () => {
  content.addItem({
    verticalCode: 'money', body: 'UNAPPROVED DRAFT — do not send', validOn: db.today(), priority: 99
  });
  const sub = wallet.findByMsisdn('0971000004');
  assert.ok(!content.buildDigest(sub, db.today()).body.includes('UNAPPROVED'));
});

test('the daily run bills, delivers, and refuses to do either twice', async () => {
  const date = db.addDays(db.today(), 1);
  // Publish tomorrow's bulletin so the run has something to send.
  const item = content.addItem({ verticalCode: 'money', body: 'Never share your mobile money PIN.', validOn: date });
  content.approve(item.id, 'editor');

  const first = await billing.runDailyToCompletion({ date });
  assert.ok(first.delivered > 0, 'first run should deliver');

  const second = await billing.runDailyToCompletion({ date });
  assert.equal(second.delivered, 0, 'a re-run must deliver nothing');
  assert.equal(second.charged, 0, 'a re-run must charge nothing');
});

test('hand-written SMS copy is normalised at the outbound boundary', async () => {
  const sub = wallet.findByMsisdn('0971000002');
  const res = await messaging.send({
    subscriber: sub, channel: 'sms', allowDuplicate: true,
    body: 'Top up \u2014 K7 for a week, don\u2019t wait\u2026'
  });
  assert.equal(res.sent, true);
  const stored = db.prepare('SELECT body FROM deliveries WHERE id = ?').get(res.deliveryId).body;
  assert.equal(stored, "Top up - K7 for a week, don't wait...");
  assert.equal(content.isGsm7(stored), true, 'nothing hand-written may force UCS-2');
});

test('WhatsApp keeps its typography — only SMS is normalised', async () => {
  const sub = wallet.findByMsisdn('0971000004');
  const res = await messaging.send({
    subscriber: sub, channel: 'whatsapp', allowDuplicate: true, body: 'Balance \u2014 K7.00'
  });
  assert.equal(res.sent, true);
  assert.equal(db.prepare('SELECT body FROM deliveries WHERE id = ?').get(res.deliveryId).body,
    'Balance \u2014 K7.00');
});

test('a stopped subscriber is never delivered to', async () => {
  const sub = wallet.findByMsisdn('0971000005');
  const result = await messaging.send({ subscriber: sub, channel: 'sms', body: 'test' });
  assert.equal(result.sent, false);
  assert.equal(result.reason, 'no_consent');
});

test('WhatsApp needs its own opt-in on top of service consent', async () => {
  const sub = wallet.findByMsisdn('0971000001');   // consented by USSD only
  const result = await messaging.send({ subscriber: sub, channel: 'whatsapp', body: 'hello' });
  assert.equal(result.sent, false);
  assert.equal(result.reason, 'no_whatsapp_opt_in');
});

test('WhatsApp keywords drive the same account the USSD menu does', () => {
  const phone = '+260978888001';
  assert.match(whatsapp.handleInbound({ from: phone, text: 'hi' }).reply, /Welcome/);
  const sub = wallet.findByMsisdn(phone);
  assert.ok(sub.consent_at && sub.whatsapp_opt_in_at, 'messaging us is the opt-in');

  assert.match(whatsapp.handleInbound({ from: phone, text: 'TOPICS' }).reply, /agri/);
  whatsapp.handleInbound({ from: phone, text: 'ON mining' });
  assert.ok(wallet.topics(sub.id).includes('mining'));
  whatsapp.handleInbound({ from: phone, text: 'OFF mining' });
  assert.ok(!wallet.topics(sub.id).includes('mining'));

  assert.match(whatsapp.handleInbound({ from: phone, text: 'BAL' }).reply, /Balance K/);
  assert.match(whatsapp.handleInbound({ from: phone, text: 'STOP' }).reply, /Stopped/);
  assert.equal(wallet.byId(sub.id).status, 'stopped');
});

test('the WhatsApp verification handshake only answers the right token', () => {
  const config = require('../server/config');
  assert.equal(
    whatsapp.verifyHandshake({ 'hub.mode': 'subscribe', 'hub.verify_token': config.whatsapp.verifyToken, 'hub.challenge': '12345' }),
    '12345'
  );
  assert.equal(whatsapp.verifyHandshake({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '1' }), null);
});

test('the cron endpoint is closed without the shared secret', async () => {
  assert.equal((await h.req('POST', '/api/cron/daily', { body: {} })).status, 401);
  assert.equal((await h.req('POST', '/api/cron/daily', { body: {}, token: 'wrong' })).status, 401);
  assert.equal((await h.req('POST', '/api/cron/daily', { body: { date: db.today() }, token: 'test-cron' })).status, 200);
});

test('admin routes are closed without the admin token', async () => {
  assert.equal((await h.req('GET', '/api/admin/summary')).status, 401);
  const ok = await h.req('GET', '/api/admin/summary', { token: 'test-admin' });
  assert.equal(ok.status, 200);
  assert.ok('unearnedCreditNgwee' in ok.data, 'unspent credit is a liability and must be reported');
});

test('the public catalogue exposes price and topics without auth', async () => {
  const res = await h.req('GET', '/api/catalog');
  assert.equal(res.status, 200);
  assert.equal(res.data.dailyPrice, 'K1.00');
  assert.ok(res.data.verticals.some(v => v.code === 'mining'));
  assert.ok(res.data.verticals.some(v => v.code === 'spirit'));
});
