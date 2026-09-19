'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbFile = path.join(os.tmpdir(), `lelo-test-${process.pid}-${Date.now()}.db`);
process.env.LELO_DB = dbFile;
process.env.NODE_ENV = 'test';
process.env.ADMIN_TOKEN = 'test-admin';
process.env.CRON_SECRET = 'test-cron';

require('../server/seed').seed();
const app = require('../server/app');

let server, base;

async function start() {
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
  return base;
}

async function stop() {
  await new Promise(r => server.close(r));
  for (const ext of ['', '-shm', '-wal']) { try { fs.unlinkSync(dbFile + ext); } catch {} }
}

async function req(method, p, { body, token, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(form).toString(); }
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(base + p, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, text };
}

/** Drive one USSD step the way a gateway would. */
async function dial(phone, text = '', sessionId = `s-${Math.random().toString(36).slice(2)}`) {
  const res = await req('POST', '/api/ussd', { form: { sessionId, phoneNumber: phone, text } });
  return res.text;
}

module.exports = { start, stop, req, dial };
