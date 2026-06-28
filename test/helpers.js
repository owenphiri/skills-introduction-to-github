'use strict';
/* Shared test bootstrap: point the app at a throwaway DB, seed it, start it.
   Each test file runs in its own subprocess (node --test), so the env var
   and module cache are fully isolated — no cross-file DB contention. */
const fs   = require('fs');
const os   = require('os');
const path = require('path');

// Must be set BEFORE requiring any server module (config reads env at load).
const dbFile = path.join(os.tmpdir(), `pos-test-${process.pid}-${Date.now()}.db`);
process.env.POS_DB   = dbFile;
process.env.NODE_ENV = 'test';

require('../server/seed');            // populates the throwaway DB
const app = require('../server/app'); // express app (does NOT auto-listen)

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

async function req(method, urlPath, { token, body } = {}) {
  const res = await fetch(base + urlPath, {
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

const PASSWORDS = {
  admin:    'Admin123!',
  manager:  'Manager123!',
  cashier1: 'Cashier123!',
  cashier2: 'Cashier123!',
};

async function login(username, password) {
  const pw = password ?? PASSWORDS[username] ?? 'Admin123!';
  const { data } = await req('POST', '/api/auth/login', { body: { username, password: pw } });
  return data.token;
}

function url(p = '') { return base + p; }

module.exports = { start, stop, req, login, url };
