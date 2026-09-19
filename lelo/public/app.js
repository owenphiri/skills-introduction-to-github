'use strict';

/**
 * Landing page. Reads the public catalogue so price, topics and bundles are
 * never duplicated in markup — change DAILY_PRICE_NGWEE and this page follows.
 */
const el = id => document.getElementById(id);

function card(inner) {
  const a = document.createElement('article');
  a.className = 'card';
  a.innerHTML = inner;
  return a;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

fetch('/api/catalog')
  .then(r => r.json())
  .then(data => {
    el('shortcode').textContent = data.shortCode;
    el('support').textContent = `Dial ${data.shortCode} for help`;

    document.querySelector('.price').innerHTML =
      `<strong>${esc(data.dailyPrice)} a day.</strong> First ${data.trialDays} days free. Stop any time.`;

    const verticals = el('verticals');
    verticals.innerHTML = '';
    for (const v of data.verticals) {
      verticals.append(card(
        `<h3>${esc(v.name)}</h3><p>${esc(v.blurb)}</p>` +
        (v.sources?.length ? `<p class="small" style="margin-top:.5rem">Source: ${esc(v.sources[0])}</p>` : '')
      ));
    }

    const bundles = el('bundles');
    bundles.innerHTML = '';
    for (const b of data.bundles) {
      bundles.append(card(
        `<span class="tag">${esc(b.label)}</span>` +
        `<p class="amount">${esc(b.price)}</p>` +
        `<p>${b.days} days of bulletins</p>`
      ));
    }
  })
  .catch(() => {
    el('verticals').innerHTML = '<p class="muted">Could not load the catalogue. Please refresh.</p>';
  });

/* ------------------------------------------------ USSD simulator ---- */

/**
 * Drives the real /api/ussd endpoint the way a gateway does: every step posts
 * the whole accumulated path, and the reply's CON/END prefix decides whether
 * the session stays open.
 */
(() => {
  const screen = el('sim-screen');
  const input = el('sim-input');
  const send = el('sim-send');
  const dial = el('sim-dial');
  const pathOut = el('sim-path');
  if (!screen) return;

  // A demo handset number, stable for this browser tab so the account the
  // visitor creates survives their own session.
  const phone = '09' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0');
  let sessionId = null;
  let steps = [];
  let busy = false;

  let shortCode = '';
  const setOpen = open => {
    input.disabled = !open;
    send.disabled = !open;
    dial.textContent = open ? 'Restart' : `Dial ${shortCode}`.trim();
  };

  function showPath() {
    pathOut.innerHTML = steps.length
      ? `Sending <code>text=${esc(steps.join('*'))}</code> as ${esc(phone)}`
      : `Dialling as ${esc(phone)}`;
  }

  async function step(entry) {
    if (busy) return;
    busy = true;
    if (entry !== null) steps.push(entry);
    showPath();
    screen.textContent = '…';
    try {
      const res = await fetch('/api/ussd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ sessionId, phoneNumber: phone, text: steps.join('*') })
      });
      const text = await res.text();
      const open = text.startsWith('CON ');
      screen.textContent = text.replace(/^(CON|END) /, '');
      setOpen(open);
      if (!open) { steps = []; sessionId = null; pathOut.textContent = 'Session ended. Dial again to restart.'; }
      else input.focus();
    } catch {
      screen.textContent = 'Could not reach the service. Please try again.';
      setOpen(false);
    } finally {
      busy = false;
      input.value = '';
    }
  }

  dial.addEventListener('click', () => {
    sessionId = 'web-' + Math.random().toString(36).slice(2, 10);
    steps = [];
    step(null);
  });

  send.addEventListener('click', () => {
    const v = input.value.trim();
    if (v) step(v);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); send.click(); }
  });

  // Show the simulator only where it is safe to: demo mode, backed by an
  // in-memory database. Elsewhere the section is removed entirely.
  fetch('/api/catalog').then(r => r.json())
    .then(d => {
      if (!d.demo) { document.getElementById('try')?.remove(); return; }
      shortCode = d.shortCode;
      setOpen(false);
    })
    .catch(() => {});
})();
