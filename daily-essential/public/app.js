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
