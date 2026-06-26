'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbFile = path.join(os.tmpdir(), `poultry-test-${process.pid}-${Date.now()}.db`);
process.env.POULTRY_DB = dbFile;
process.env.NODE_ENV = 'test';

require('../server/seed');
const app = require('../server/app');

let server, base;
async function start() { await new Promise(r => { server = app.listen(0, r); }); base = `http://127.0.0.1:${server.address().port}`; return base; }
async function stop() { await new Promise(r => server.close(r)); for (const e of ['', '-shm', '-wal']) { try { fs.unlinkSync(dbFile + e); } catch {} } }
async function req(method, p, { token, body } = {}) {
  const res = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
async function login(u, pw = 'password') { return (await req('POST', '/api/auth/login', { body: { username: u, password: pw } })).data.token; }
module.exports = { start, stop, req, login };
