'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.start);
after(h.stop);

/* ------------------------------------------------ package-tier gating ---- */

async function makeSilverTeacher(admin) {
  // School id 3 is "Lusaka Girls Secondary" (silver) in the seed.
  const u = await h.req('POST', '/api/users', {
    token: admin,
    body: { full_name: 'Silver Teacher', username: 'silverteacher', password: 'Passw0rd', role: 'teacher', school_id: 3 }
  });
  assert.equal(u.status, 201);
  return h.login('silverteacher', 'Passw0rd');
}

test('login reports the school package and enabled features', async () => {
  const teacher = await h.login('teacher'); // platinum school
  const me = (await h.req('GET', '/api/auth/me', { token: teacher })).data.user;
  assert.equal(me.package, 'platinum');
  assert.ok(me.features.includes('gis') && me.features.includes('counseling'));
});

test('a silver-tier school is gated out of gold/platinum features (402)', async () => {
  const admin = await h.login('admin');
  const silver = await makeSilverTeacher(admin);

  const me = (await h.req('GET', '/api/auth/me', { token: silver })).data.user;
  assert.equal(me.package, 'silver');
  assert.ok(me.features.includes('academic_reports'), 'silver includes academic reports');
  assert.ok(!me.features.includes('ai_risk'), 'silver excludes AI risk');
  assert.ok(!me.features.includes('counseling'), 'silver excludes counseling');

  // AI risk (gold) → 402 Payment Required with upgrade info.
  const risk = await h.req('GET', '/api/risk', { token: silver });
  assert.equal(risk.status, 402);
  assert.equal(risk.data.requiredTier, 'gold');
  assert.equal(risk.data.currentTier, 'silver');

  // Counseling (gold) → 402.
  const couns = await h.req('POST', '/api/counseling', {
    token: silver, body: { student_id: 12, type: 'session', notes: 'x' }
  });
  assert.equal(couns.status, 402);

  // Academic reports (silver) → allowed.
  const acad = await h.req('GET', '/api/analytics/academic', { token: silver });
  assert.equal(acad.status, 200);
});

test('admin and district bypass tier gating', async () => {
  const admin = await h.login('admin');
  assert.equal((await h.req('GET', '/api/risk', { token: admin })).status, 200);
  const district = await h.login('district');
  assert.equal((await h.req('GET', '/api/risk', { token: district })).status, 200);
});

/* ------------------------------------------- counseling reminders -------- */

test('reminder dispatcher sends due reminders once (idempotent)', async () => {
  const counselor = await h.login('counselor');
  const today = new Date().toISOString().slice(0, 10);
  await h.req('POST', '/api/counseling', {
    token: counselor,
    body: { student_id: 1, type: 'parent_meeting', scheduled_date: today, follow_up_date: today, notes: 'Due today' }
  });

  const first = await h.req('POST', '/api/counseling/run-reminders', { token: counselor, body: {} });
  assert.equal(first.status, 200);
  assert.ok(first.data.scheduled >= 1 && first.data.followup >= 1);

  // Running again must not re-send (flags already set).
  const second = await h.req('POST', '/api/counseling/run-reminders', { token: counselor, body: {} });
  assert.equal(second.data.scheduled, 0);
  assert.equal(second.data.followup, 0);
});

/* ------------------------------------------- SMS delivery webhook -------- */

test('delivery-report webhook reconciles the outbox', async () => {
  const teacher = await h.login('teacher');
  // Generate a message (attendance notification).
  await h.req('POST', '/api/attendance', { token: teacher, body: { student_id: 2, status: 'present' } });
  const latest = (await h.req('GET', '/api/messages?limit=1', { token: teacher })).data[0];
  assert.ok(latest.provider_ref, 'mock provider should set a provider_ref');

  // Post a delivery report as the aggregator would (form-encoded).
  const res = await fetch(h.url('/api/webhooks/sms/delivery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id: latest.provider_ref, status: 'Success' }).toString()
  });
  const out = await res.json();
  assert.equal(out.updated, true);

  const after = (await h.req('GET', '/api/messages?limit=1', { token: teacher })).data[0];
  assert.equal(after.delivery_status, 'delivered');

  // Unknown reference → no update.
  const miss = await fetch(h.url('/api/webhooks/sms/delivery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id: 'does-not-exist', status: 'Success' }).toString()
  });
  assert.equal((await miss.json()).updated, false);
});
