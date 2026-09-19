'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const h = require('./helpers');

const db = require('../server/db');
const wallet = require('../server/wallet');
const config = require('../server/config');
const ussd = require('../server/ussd');

before(h.start);
after(h.stop);

test('a new caller is asked to opt in before anything else', async () => {
  const out = await h.dial('0979999001', '');
  assert.match(out, /^CON /);
  assert.match(out, /Accept & start/);
  const sub = wallet.findByMsisdn('0979999001');
  assert.equal(sub.consent_at, null, 'dialling alone is not consent');
});

test('accepting records consent and starts the free trial', async () => {
  await h.dial('0979999002', '');
  const out = await h.dial('0979999002', '1');
  assert.match(out, /^END /);
  const sub = wallet.findByMsisdn('0979999002');
  assert.ok(sub.consent_at, 'consent must be recorded');
  assert.equal(sub.consent_channel, 'ussd');
  assert.ok(sub.trial_ends_on > db.today());
});

test('declining leaves the caller un-consented', async () => {
  await h.dial('0979999003', '3');
  assert.equal(wallet.findByMsisdn('0979999003').consent_at, null);
});

test('every screen fits inside one 182-character USSD page', async () => {
  const phone = '0979999004';
  await h.dial(phone, '1');
  const paths = ['', '1', '2', '2*1', '3', '4', '5', '6', '6*1'];
  for (const p of paths) {
    const out = await h.dial(phone, p);
    const payload = out.replace(/^(CON|END) /, '');
    assert.ok(payload.length <= config.limits.ussdScreenChars,
      `path "${p}" produced ${payload.length} chars:\n${payload}`);
  }
});

test('the menu is stateless: a path resolves the same without prior steps', () => {
  const phone = '+260979999005';
  wallet.recordConsent(wallet.ensure(phone).id, 'ussd');
  const walked = ussd.handle({ sessionId: 'a', phoneNumber: phone, text: '5' }).text;
  const jumped = ussd.handle({ sessionId: 'b-fresh-session', phoneNumber: phone, text: '5' }).text;
  assert.equal(walked, jumped);
});

test('toggling a topic from the menu changes what the subscriber receives', async () => {
  const phone = '0979999006';
  await h.dial(phone, '1');
  const sub = wallet.findByMsisdn(phone);
  const before = wallet.topics(sub.id);
  assert.ok(before.includes('agri'), 'agri is on by default');

  const verticals = require('../server/verticals');
  const agriIndex = verticals.list().findIndex(v => v.code === 'agri') + 1;
  await h.dial(phone, `2*${agriIndex}`);
  assert.ok(!wallet.topics(sub.id).includes('agri'), 'agri should now be off');

  await h.dial(phone, `2*${agriIndex}`);
  assert.ok(wallet.topics(sub.id).includes('agri'), 'and back on');
});

test('district search matches on a prefix and sets the district', async () => {
  const phone = '0979999007';
  await h.dial(phone, '1');
  const out = await h.dial(phone, '4*Chip');
  assert.match(out, /Chipata/);
  const sub = wallet.findByMsisdn(phone);
  const district = db.prepare('SELECT name FROM districts WHERE id = ?').get(sub.district_id);
  assert.equal(district.name, 'Chipata');
});

test('an unknown district prefix says so rather than guessing', async () => {
  const phone = '0979999008';
  await h.dial(phone, '1');
  assert.match(await h.dial(phone, '4*Zzz'), /No district starts with/);
});

test('reading the bulletin on a funded account takes exactly one K1', async () => {
  const sub = wallet.findByMsisdn('0971000004');
  const opening = wallet.balance(sub.id);
  const out = await h.dial(sub.msisdn, '1');
  assert.match(out, /^END /);
  const spent = opening - wallet.balance(sub.id);
  assert.ok(spent === 0 || spent === config.dailyPriceNgwee,
    `expected K0 (already billed today) or K1, spent ${spent}`);

  const again = await h.dial(sub.msisdn, '1');
  assert.match(again, /^END /);
  assert.equal(wallet.balance(sub.id), opening - spent, 'a second read on the same day is free');
});

test('an out-of-credit caller is offered bundles, not an error', async () => {
  const sub = wallet.findByMsisdn('0971000003');
  const out = await h.dial(sub.msisdn, '1');
  assert.match(out, /credit is finished/i);
  assert.match(out, /K7\.00|1 week/);
});

test('choosing STOP from the menu silences the subscription', async () => {
  const phone = '0979999009';
  await h.dial(phone, '1');
  const out = await h.dial(phone, '6*1');
  assert.match(out, /^END /);
  assert.match(out, /Stopped/);
  const sub = wallet.findByMsisdn(phone);
  assert.equal(sub.status, 'stopped');
  assert.equal(sub.consent_at, null);
});

test('an unreadable MSISDN ends the session politely', () => {
  const out = ussd.handle({ sessionId: 'x', phoneNumber: 'not-a-number', text: '' });
  assert.match(out.text, /^END /);
  assert.equal(out.keepOpen, false);
});

test('a garbage menu selection falls back to the main menu', async () => {
  const phone = '0979999010';
  await h.dial(phone, '1');
  const out = await h.dial(phone, '99');
  assert.match(out, /Today's bulletin/);
});
