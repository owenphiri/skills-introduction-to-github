'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const h = require('./helpers');

const db = require('../server/db');
const wallet = require('../server/wallet');
const payments = require('../server/payments');
const money = require('../server/money');
const config = require('../server/config');

before(h.start);
after(h.stop);

test('money never loses a ngwee', () => {
  assert.equal(money.toNgwee('1'), 100);
  assert.equal(money.toNgwee('7.50'), 750);
  assert.equal(money.toNgwee(0.05), 5);
  assert.equal(money.format(750), 'K7.50');
  assert.equal(money.format(100), 'K1.00');
  assert.equal(money.format(5), 'K0.05');
  assert.throws(() => money.toNgwee('1.005'), /finer than one ngwee/);
  assert.throws(() => money.toNgwee(-5), /Invalid amount/);
});

test('phone numbers normalise to +260 regardless of how they are typed', () => {
  for (const input of ['0971234567', '260971234567', '+260971234567', '+260 97 123 4567']) {
    assert.equal(db.normaliseMsisdn(input), '+260971234567');
  }
  assert.throws(() => db.normaliseMsisdn('12345'), /Not a Zambian mobile number/);
});

test('a day is billed once no matter how many times the run fires', () => {
  const sub = wallet.findByMsisdn('0971000002');   // funded, trial expired
  const opening = wallet.balance(sub.id);
  const date = db.today();

  const first = wallet.chargeDay(sub.id, date);
  assert.equal(first.reason, 'charged');
  assert.equal(wallet.balance(sub.id), opening - config.dailyPriceNgwee);

  for (let i = 0; i < 5; i++) {
    assert.equal(wallet.chargeDay(sub.id, date).reason, 'already');
  }
  assert.equal(wallet.balance(sub.id), opening - config.dailyPriceNgwee,
    'repeat runs must not take a second K1');
});

test('a trial day costs nothing and writes no ledger entry', () => {
  const sub = wallet.findByMsisdn('0971000001');   // day-one trial
  assert.equal(wallet.inTrial(sub), true);
  const result = wallet.chargeDay(sub.id, db.today());
  assert.equal(result.reason, 'trial');
  assert.equal(wallet.ledger(sub.id).length, 0);
});

test('an empty balance suspends rather than going negative', () => {
  const sub = wallet.findByMsisdn('0971000003');   // out of credit
  const result = wallet.chargeDay(sub.id, db.today());
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no_credit');
  assert.equal(wallet.balance(sub.id), 0);
  assert.equal(wallet.byId(sub.id).status, 'suspended');
});

test('a replayed PSP webhook credits the subscriber exactly once', () => {
  const sub = wallet.findByMsisdn('0971000004');
  const opening = wallet.balance(sub.id);
  const settlement = {
    pspRef: 'psp-replay-test-1', status: 'succeeded',
    amountNgwee: 3000, msisdn: sub.msisdn, bundleCode: 'M1'
  };

  const first = payments.settle(settlement);
  assert.equal(first.applied, true);
  assert.equal(wallet.balance(sub.id), opening + 3000);

  for (let i = 0; i < 3; i++) {
    assert.equal(payments.settle(settlement).applied, false);
  }
  assert.equal(wallet.balance(sub.id), opening + 3000, 'retries must not stack credit');
});

test('a failed payment credits nothing', () => {
  const sub = wallet.findByMsisdn('0971000001');
  const opening = wallet.balance(sub.id);
  const result = payments.settle({
    pspRef: 'psp-failed-1', status: 'failed', amountNgwee: 700, msisdn: sub.msisdn
  });
  assert.equal(result.applied, false);
  assert.equal(wallet.balance(sub.id), opening);
});

test('an unsigned webhook is rejected when a secret is configured', () => {
  const original = config.payments.webhookSecret;
  config.payments.webhookSecret = 'shhh';
  try {
    const body = Buffer.from('{"reference":"x"}');
    assert.equal(payments.verifySignature(body, 'sha256=deadbeef'), false);
    const good = require('node:crypto').createHmac('sha256', 'shhh').update(body).digest('hex');
    assert.equal(payments.verifySignature(body, good), true);
  } finally {
    config.payments.webhookSecret = original;
  }
});

test('with no secret set, signature verification fails closed', () => {
  const original = config.payments.webhookSecret;
  config.payments.webhookSecret = '';
  try {
    assert.equal(payments.verifySignature(Buffer.from('{}'), 'anything'), false);
  } finally {
    config.payments.webhookSecret = original;
  }
});

test('stopping clears consent and blocks every further charge', () => {
  const sub = wallet.findByMsisdn('0971000005');   // stopped in the seed
  assert.equal(sub.status, 'stopped');
  assert.equal(sub.consent_at, null);
  assert.equal(wallet.chargeDay(sub.id, db.today()).reason, 'stopped');
});
