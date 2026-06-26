'use strict';
/* Shared test bootstrap: point the app at a throwaway DB, seed it, start it. */
const fs = require('fs');
const os = require('os');
const path = require('path');

// Must be set BEFORE requiring any server module (config reads env at load).
const dbFile = path.join(os.tmpdir(), `sewsms-test-${process.pid}-${Date.now()}.db`);
process.env.SEWSMS_DB = dbFile;
process.env.MESSAGING_PROVIDER = 'mock';
process.env.NODE_ENV = 'test';

require('../server/seed');             // populates the throwaway DB
const app = require('../server/app');  // express app (does not auto-listen)

let server, base;

async function start() {
  await new Promise(resolve => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  return base;
}

async function stop() {
  await new Promise(resolve => server.close(resolve));
  for (const ext of ['', '-shm', '-wal']) {
    try { fs.unlinkSync(dbFile + ext); } catch { /* ignore */ }
  }
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(username, password = 'password') {
  const { data } = await req('POST', '/api/auth/login', { body: { username, password } });
  return data.token;
}

function url(path = '') { return base + path; }

module.exports = { start, stop, req, login, url };
