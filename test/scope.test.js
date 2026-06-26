'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.start);
after(h.stop);

test('admin sees all schools and learners; teacher sees only their school', async () => {
  const admin = await h.login('admin');
  const teacher = await h.login('teacher');
  const all = (await h.req('GET', '/api/students', { token: admin })).data;
  const mine = (await h.req('GET', '/api/students', { token: teacher })).data;
  assert.ok(all.length > mine.length, 'admin should see more learners than a single-school teacher');
  // Every learner a teacher sees belongs to one school.
  const schoolIds = new Set(mine.map(s => s.school_id));
  assert.equal(schoolIds.size, 1);
});

test('district officer sees only schools in their district', async () => {
  const district = await h.login('district');
  const schools = (await h.req('GET', '/api/analytics/by-school', { token: district })).data;
  assert.ok(schools.length >= 1);
  assert.ok(schools.every(s => s.district === 'Chongwe'), 'Chongwe DEO must not see other districts');
  assert.ok(!schools.some(s => s.district === 'Lusaka'));
});

test('admin by-school dashboard covers every district', async () => {
  const admin = await h.login('admin');
  const schools = (await h.req('GET', '/api/analytics/by-school', { token: admin })).data;
  const districts = new Set(schools.map(s => s.district));
  assert.ok(districts.has('Chongwe') && districts.has('Lusaka'));
});

test('a teacher cannot view a learner outside their school (403)', async () => {
  const admin = await h.login('admin');
  const teacher = await h.login('teacher');
  // Find a learner in a school the teacher does NOT belong to.
  const mine = (await h.req('GET', '/api/students', { token: teacher })).data;
  const myschool = mine[0].school_id;
  const all = (await h.req('GET', '/api/students', { token: admin })).data;
  const other = all.find(s => s.school_id !== myschool);
  assert.ok(other, 'seed should include a learner in another school');
  const res = await h.req('GET', '/api/students/' + other.id, { token: teacher });
  assert.equal(res.status, 403);
});

test('district analytics summary is bounded to the district', async () => {
  const district = await h.login('district');
  const admin = await h.login('admin');
  const dSum = (await h.req('GET', '/api/analytics/summary', { token: district })).data;
  const aSum = (await h.req('GET', '/api/analytics/summary', { token: admin })).data;
  assert.ok(dSum.totalStudents < aSum.totalStudents, 'district total must be a subset of national total');
});

test('new learners default to the registering staff member\'s school', async () => {
  const teacher = await h.login('teacher');
  const created = (await h.req('POST', '/api/students', {
    token: teacher, body: { full_name: 'Scoped Learner', grade: '8C', gender: 'F' }
  })).data;
  assert.ok(created.school_id, 'should inherit the teacher\'s school');
  // And the teacher can immediately see it within scope.
  const fetched = await h.req('GET', '/api/students/' + created.id, { token: teacher });
  assert.equal(fetched.status, 200);
});

test('admin can create a new school; non-admin cannot', async () => {
  const admin = await h.login('admin');
  const ok = await h.req('POST', '/api/schools', {
    token: admin, body: { name: 'Test School', district: 'Kafue', package: 'bronze' }
  });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.district, 'Kafue');

  const teacher = await h.login('teacher');
  const denied = await h.req('POST', '/api/schools', {
    token: teacher, body: { name: 'Nope', district: 'X' }
  });
  assert.equal(denied.status, 403);
});
