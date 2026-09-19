/*
 * Nchito web — a dependency-free SPA mirroring the iOS and Android apps.
 *
 * Vanilla on purpose. The product's own design principle is that Zambian mobile
 * data is expensive and intermittent, and it would be odd to ship a 200KB
 * framework to demo an app built around not wasting people's bundles.
 */

// ---------- State ----------

const state = {
  tab: 'gigs',
  detail: null,          // { type, id } — pushed over the current tab
  category: null,
  applied: new Set(),
  proofs: {},            // gigId -> { before: bool, after: bool }
  advances: {},          // gigId -> { amount, fee }
  done: new Set(),       // completed task ids
  ledger: TRANSACTIONS.slice(),
  chats: JSON.parse(JSON.stringify(CHATS)),
  agents: AGENTS.slice(),
  shareOn: false,
};

const balance = () => state.ledger.reduce((s, t) => s + t.amount, 0);
const gigById = id => GIGS.find(g => g.id === id);
const el = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = el(`<div class="toast">${esc(msg)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function go(tab) { state.tab = tab; state.detail = null; render(); window.scrollTo(0, 0); }
function open_(type, id) { state.detail = { type, id }; render(); window.scrollTo(0, 0); }
function back() { state.detail = null; render(); }

// ---------- Icons (inline so there is no icon-font request) ----------

const ICON = {
  gigs:   '<path d="M4 7h16v13H4z"/><path d="M9 7V5h6v2"/>',
  tasks:  '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  chats:  '<path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.4 3.5A7.9 7.9 0 0 1 21 12z"/>',
  wallet: '<path d="M3 7h15a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5a2 2 0 0 1-2-2z"/><circle cx="17" cy="13" r="1.4"/>',
  profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

// ---------- Screens ----------

function gigsScreen() {
  const list = GIGS
    .filter(g => !state.category || g.category === state.category)
    .sort((a, b) => (b.boosted ? 1 : 0) - (a.boosted ? 1 : 0));

  return `
    <div class="chips">
      ${CATEGORIES.map(c => `
        <button class="chip" aria-pressed="${state.category === c.id}"
                onclick="state.category = state.category === '${c.id}' ? null : '${c.id}'; render()">
          ${esc(c.label)}
        </button>`).join('')}
    </div>
    ${list.map(g => `
      <div class="card tap" onclick="open_('gig','${g.id}')">
        <div class="row wrap" style="margin-bottom:7px">
          <span class="pill">${esc(CATEGORIES.find(c => c.id === g.category).label)}</span>
          ${g.urgent ? '<span class="pill red">URGENT</span>' : ''}
          ${g.boosted ? '<span class="pill copper">★ Featured</span>' : ''}
          <span class="spacer"></span>
          <span class="bold green">${KWACHA(g.pay)}</span>
        </div>
        <div class="bold" style="font-size:14.5px;line-height:1.35">${esc(g.title)}</div>
        <div class="small muted" style="margin-top:5px">
          ${esc(g.city)} · ${esc(g.area)} — ${g.applicants} applied · ${esc(g.ago)} ago
        </div>
      </div>`).join('')}
    ${list.length ? '' : '<div class="empty">No gigs in this category.<br>Try another one.</div>'}
  `;
}

function gigDetail(id) {
  const g = gigById(id);
  const tier = tierFor(g.together);
  const payout = g.pay * (1 - tier.rate);
  const applied = state.applied.has(id);
  const proof = state.proofs[id] || {};
  const adv = state.advances[id];
  const next = TIERS.filter(t => t.rate < tier.rate).pop();
  const needed = next ? next.min - g.together : 0;

  return `
    <div class="card">
      <div class="row" style="margin-bottom:8px">
        <span class="pill">${esc(CATEGORIES.find(c => c.id === g.category).label)}</span>
        ${g.urgent ? '<span class="pill red">URGENT</span>' : ''}
      </div>
      <div class="bold" style="font-size:18px;line-height:1.3">${esc(g.title)}</div>
      <div class="stat-row" style="margin-top:14px">
        <div><div class="v">${KWACHA(g.pay)}</div><div class="l">Gig pay</div></div>
        <div><div class="v green">${KWACHA(payout)}</div><div class="l">You receive</div></div>
        <div><div class="v">${g.applicants}</div><div class="l">Applicants</div></div>
      </div>
    </div>

    <div class="notice" style="flex-direction:column;gap:7px">
      <div class="row" style="width:100%">
        <span class="bold green">${esc(tier.label)}</span>
        <span class="spacer"></span>
        <span class="bold green">${Math.round(tier.rate * 100)}% fee</span>
      </div>
      ${g.together ? `<div class="small muted">You've completed ${g.together} gig${g.together === 1 ? '' : 's'} with ${esc(g.poster)}.</div>` : ''}
      ${next ? `
        <div class="bar"><i style="width:${(g.together / next.min * 100).toFixed(0)}%"></i></div>
        <div class="tiny copper">${needed} more gig${needed === 1 ? '' : 's'} with this poster drops your fee to
          ${Math.round(next.rate * 100)}% — you'd keep ${KWACHA(g.pay * (1 - next.rate))} on a gig this size.</div>`
      : `<div class="tiny copper">You're on our lowest fee with this poster. Keep working together on Nchito to stay protected by escrow.</div>`}
    </div>

    ${applied ? proofCard(g, proof) : ''}
    ${applied ? advanceCard(g, payout, proof, adv) : ''}

    <h2 class="section">Details</h2>
    <div class="small" style="line-height:1.55">${esc(g.details)}</div>

    <h2 class="section">Posted by</h2>
    <div class="card">
      <div class="row">
        <div class="stack">
          <span class="bold">${esc(g.poster)}</span>
          <span class="tiny copper">★ ${g.rating.toFixed(1)} rating</span>
        </div>
        <span class="spacer"></span>
        <button class="link" onclick="go('chats')">Message</button>
      </div>
    </div>

    <div class="notice" style="margin-top:12px">
      <div class="stack">
        <span class="bold small">🔒 Escrow protected</span>
        <span class="tiny muted">The poster's ${KWACHA(g.pay)} is held by Nchito and released once they
          confirm the job is done and both proof photos are attached. Your
          ${Math.round(tier.rate * 100)}% service fee is ${KWACHA(g.pay * tier.rate)}.</span>
      </div>
    </div>

    <div style="margin-top:14px">
      <button class="primary" ${applied ? 'disabled' : ''} onclick="applyTo('${id}')">
        ${applied ? 'Application sent ✓' : 'Apply for this gig'}
      </button>
    </div>
  `;
}

function proofCard(g, proof) {
  const both = proof.before && proof.after;
  const slot = (kind, label, hint) => proof[kind]
    ? `<div class="card" style="flex:1;margin:0;text-align:center;background:rgba(14,122,24,.10)">
         <div class="bold small green">✓ ${label}</div>
         <div class="tiny muted">just now · geotagged</div>
       </div>`
    : `<button class="card tap" style="flex:1;margin:0;text-align:center;border:1.5px dashed var(--line);box-shadow:none;font-family:inherit"
              onclick="capture('${g.id}','${kind}')">
         <div class="bold small">${label}</div>
         <div class="tiny muted">${hint}</div>
       </button>`;

  return `
    <div class="card">
      <div class="row" style="margin-bottom:6px">
        <span class="bold small">Proof of work</span>
        <span class="spacer"></span>
        <span class="tiny muted">${(proof.before ? 1 : 0) + (proof.after ? 1 : 0)}/2</span>
      </div>
      <div class="tiny muted" style="margin-bottom:10px">
        Photos are stamped with the time and place they were taken. They protect your
        payment if the poster disputes the work.
      </div>
      <div class="row" style="gap:8px">
        ${slot('before', 'Before', 'Photograph the job before you start')}
        ${slot('after', 'After', 'Photograph the finished work')}
      </div>
      <div class="tiny ${both ? 'green' : 'copper'}" style="margin-top:9px">
        ${both ? '🔓 Payment can now be released by the poster.'
               : '🔒 Both photos are required before payment can be released.'}
      </div>
    </div>`;
}

function advanceCard(g, payout, proof, adv) {
  if (adv) {
    return `
      <div class="notice copper" style="flex-direction:column;gap:5px">
        <div class="row" style="width:100%">
          <span class="bold copper">${KWACHA(adv.amount)} paid early</span>
          <span class="spacer"></span>
          <span class="tiny muted">Comes off your next payout</span>
        </div>
        <div class="tiny muted">${KWACHA(adv.amount + adv.fee)} (including the ${KWACHA(adv.fee)} fee)
          comes off this gig. You'll receive ${KWACHA(payout - adv.amount - adv.fee)} when it settles.</div>
      </div>`;
  }
  const cap = Math.floor(payout * 0.5);
  if (!proof.before) {
    return `
      <div class="notice copper">
        <div class="stack">
          <span class="bold small">Get paid before the job ends</span>
          <span class="tiny muted">Take your "before" photo on this gig first — that is what shows
            the work has started.</span>
        </div>
      </div>`;
  }
  return `
    <div class="notice copper" style="flex-direction:column;gap:9px">
      <div class="stack" style="width:100%">
        <span class="bold small">Get paid before the job ends</span>
        <span class="tiny muted">You've started this job, so you can take up to
          <b>${KWACHA(cap)}</b> of your ${KWACHA(payout)} payout right now. The rest arrives when
          the poster confirms the work.</span>
      </div>
      <button class="primary copper" onclick="takeAdvance('${g.id}', ${cap})">
        Take ${KWACHA(cap)} now
      </button>
    </div>`;
}

function tasksScreen() {
  const available = TASKS.filter(t => !state.done.has(t.id)).reduce((s, t) => s + t.reward, 0);
  return `
    <div class="hero" style="text-align:left;padding:16px">
      <div class="bold">Earn in your spare time</div>
      <div class="small" style="opacity:.92;margin-top:3px">
        ${KWACHA(available)} available right now — tasks refresh daily.
      </div>
    </div>
    ${TASKS.map(t => {
      const done = state.done.has(t.id);
      return `
        <div class="card">
          <div class="row">
            <div class="stack" style="flex:1">
              <span class="bold small">${esc(t.title)}</span>
              <span class="tiny muted">${esc(t.kind)} · ${t.minutes} min · ${t.slots} slots</span>
            </div>
            ${done
              ? '<span class="pill">Done ✓</span>'
              : `<button class="chip" style="background:var(--copper);color:#fff;border-color:var(--copper)"
                         onclick="doTask('${t.id}')">${KWACHA(t.reward)}</button>`}
          </div>
        </div>`;
    }).join('')}
  `;
}

function chatsScreen() {
  return state.chats.map(c => {
    const last = c.messages[c.messages.length - 1];
    return `
      <div class="card tap" onclick="open_('chat','${c.id}')">
        <div class="row">
          <div class="stack" style="flex:1">
            <span class="bold small">${esc(c.name)}</span>
            <span class="tiny copper">${esc(c.gig)}</span>
            <span class="tiny muted">${last.mine ? 'You: ' : ''}${esc(last.body)}</span>
          </div>
          <span class="tiny muted">${esc(last.time)}</span>
        </div>
      </div>`;
  }).join('');
}

function chatThread(id) {
  const c = state.chats.find(x => x.id === id);
  return `
    <div class="card" style="padding:11px">
      <div class="tiny copper bold">${esc(c.gig)}</div>
    </div>
    <div style="margin:14px 0">
      ${c.messages.map(m => `
        <div class="bubble ${m.mine ? 'mine' : 'theirs'}">${esc(m.body)}</div>
        <div class="time ${m.mine ? 'mine' : ''}">${esc(m.time)}</div>`).join('')}
    </div>
    <form class="row" onsubmit="sendMsg(event,'${id}')">
      <input class="field" id="msg" placeholder="Message…" autocomplete="off">
      <button class="chip" style="background:var(--green);color:#fff;border-color:var(--green);padding:11px 15px">Send</button>
    </form>
  `;
}

function walletScreen() {
  const adv = Object.entries(state.advances)[0];
  return `
    <div class="hero">
      <div class="small" style="opacity:.9">Available balance</div>
      <div class="amount">${KWACHA(balance())}</div>
      <button class="chip" style="margin-top:8px;background:#fff;color:var(--green);border:0"
              onclick="cashOut()">Cash out to MTN MoMo</button>
    </div>

    <div class="card tap" onclick="open_('agents',null)">
      <div class="stack">
        <span class="bold small">📍 Find cash near you</span>
        <span class="tiny green">Which agents actually have float right now</span>
        <span class="tiny muted">Reported by other Nchito workers. A balance you can't withdraw isn't money.</span>
      </div>
    </div>

    ${adv ? `
      <div class="notice copper" style="flex-direction:column;gap:4px">
        <div class="row" style="width:100%">
          <span class="bold copper">${KWACHA(adv[1].amount + adv[1].fee)}</span>
          <span class="spacer"></span>
          <span class="tiny muted">Comes off your next payout</span>
        </div>
        <div class="tiny muted">${KWACHA(adv[1].amount)} advanced on
          ${esc(gigById(adv[0]).title)}, plus a ${KWACHA(adv[1].fee)} fee.</div>
      </div>` : ''}

    <h2 class="section">Recent activity</h2>
    ${state.ledger.map(t => `
      <div class="card" style="padding:12px 14px">
        <div class="row">
          <div class="stack" style="flex:1">
            <span class="bold small">${esc(t.kind)}</span>
            <span class="tiny muted">${esc(t.note)}</span>
          </div>
          <span class="bold ${t.amount >= 0 ? 'green' : 'red'}">
            ${t.amount >= 0 ? '+' : ''}${KWACHA(t.amount)}
          </span>
        </div>
      </div>`).join('')}
  `;
}

const AGENT_UI = {
  has_cash: { label: 'Had cash',              cls: 'pill' },
  no_cash:  { label: 'No cash',               cls: 'pill red' },
  mixed:    { label: 'Mixed reports',         cls: 'pill copper' },
  unknown:  { label: 'Not reported recently', cls: 'pill grey' },
};
const AGENT_ORDER = { has_cash: 0, unknown: 1, mixed: 2, no_cash: 3 };

function agentsScreen() {
  // Confirmed cash first, then unknowns, then known-dry last — but still listed:
  // one dry an hour ago may have been restocked, and hiding it would be its own
  // kind of false claim.
  const list = state.agents.slice().sort((a, b) =>
    (AGENT_ORDER[a.status] - AGENT_ORDER[b.status]) || (a.km - b.km));

  return `
    ${list.map((a, i) => {
      const ui = AGENT_UI[a.status];
      const evidence = a.reports === 0
        ? "Nobody has reported here recently — you'd be finding out for everyone."
        : a.reports === 1
          ? `1 person reported ${a.fresh}.`
          : `${a.reports} people reported in the last day, most recently ${a.fresh}.`;
      return `
        <div class="card">
          <div class="row top">
            <div class="stack" style="flex:1">
              <span class="bold small">${esc(a.name)}${a.verified ? ' <span class="tiny green">✓ verified</span>' : ''}</span>
              <span class="tiny muted">${esc(a.area)} — near ${esc(a.landmark)}</span>
            </div>
            <div class="stack" style="text-align:right">
              <span class="bold tiny">${a.km.toFixed(1)} km</span>
              <span class="tiny muted">~${Math.max(1, Math.round(a.km / 5 * 60))} min walk</span>
            </div>
          </div>
          <div style="margin:8px 0 6px"><span class="${ui.cls}">${ui.label}</span></div>
          <div class="tiny muted">${esc(evidence)}</div>
          <div style="margin-top:8px">
            <button class="link" onclick="reportAgent(${i})">I went here — report what I found</button>
          </div>
        </div>`;
    }).join('')}

    <div class="notice">
      <div class="tiny muted">
        These reports come from other Nchito workers, not from the networks. Float changes
        through the day, so always check how recent a report is — and tell us what you find
        so the next person doesn't waste a trip.
      </div>
    </div>`;
}

function profileScreen() {
  return `
    <div class="card" style="text-align:center">
      <div class="bold" style="font-size:18px">${esc(USER.name)}</div>
      <div class="tiny muted">${esc(USER.city)} · ${esc(USER.phone)}</div>
      <div class="stat-row" style="margin-top:14px">
        <div><div class="v">${USER.rating.toFixed(1)} ★</div><div class="l">Rating</div></div>
        <div><div class="v">${USER.gigsDone}</div><div class="l">Gigs done</div></div>
        <div><div class="v green">NRC ✓</div><div class="l">Verified</div></div>
      </div>
    </div>

    <div class="card tap" onclick="open_('record',null)">
      <div class="stack">
        <span class="bold small">📄 My Work Record</span>
        <span class="tiny green">${USER.gigsDone} verified jobs · export as a CV</span>
        <span class="tiny muted">A work history employers and lenders can verify.
          Only jobs paid through Nchito count.</span>
      </div>
    </div>

    <div class="card">
      <div class="stack">
        <span class="bold small">📞 Phone &amp; USSD access</span>
        <span class="tiny copper">Dial *384*62448#</span>
        <span class="tiny muted">Use Nchito from any handset — find gigs, apply, check your
          balance and cash out, with no app and no data.</span>
      </div>
    </div>

    <div class="card">
      <div class="stack">
        <span class="bold small">Invite friends, earn passively</span>
        <span class="tiny muted">You earn K20 for every friend who joins with your code and
          finishes their first gig — plus 2% of their task rewards for 3 months.</span>
        <div class="row" style="margin-top:8px">
          <span class="bold green" style="font-family:ui-monospace,monospace">${esc(USER.referral)}</span>
          <span class="spacer"></span>
          <button class="link" onclick="shareReferral()">Share</button>
        </div>
      </div>
    </div>`;
}

function recordScreen() {
  // Transparent weighted sum: volume, punctuality, rating, tenure — with
  // punctuality and rating shrunk toward a neutral prior, so a thin record
  // can't look like a strong one.
  const n = USER.gigsDone, k = 5;
  const volume = Math.min(n / 50, 1) * 40;
  const punct = ((USER.onTimeRate * n + 0.5 * k) / (n + k)) * 30;
  const quality = (((USER.rating * n + 3.5 * k) / (n + k)) / 5) * 20;
  const tenure = Math.min(USER.months / 12, 1) * 10;
  const score = Math.round(volume + punct + quality + tenure);
  const band = score >= 80 ? 'Excellent' : score >= 60 ? 'Strong' : score >= 40 ? 'Building' : 'Getting started';

  return `
    <div class="hero">
      <div class="amount">${score}</div>
      <div class="small" style="opacity:.9">${band} · reliability out of 100</div>
      <div class="stat-row" style="margin-top:14px">
        <div><div class="v">${USER.gigsDone}</div><div class="l">Jobs done</div></div>
        <div><div class="v">${Math.round(USER.onTimeRate * 100)}%</div><div class="l">On time</div></div>
        <div><div class="v">${USER.rating.toFixed(1)}★</div><div class="l">Rating</div></div>
      </div>
      <div class="tiny" style="opacity:.9;margin-top:10px">
        ${KWACHA(USER.totalEarned)} earned through escrow · ${USER.months} months on Nchito
      </div>
    </div>

    <div class="card">
      <div class="row">
        <div class="stack" style="flex:1">
          <span class="bold small">Share my record</span>
          <span class="tiny muted">Off by default. Turn on to let an employer open it from a link.</span>
        </div>
        <button class="chip" aria-pressed="${state.shareOn}"
                onclick="state.shareOn = !state.shareOn; render()">
          ${state.shareOn ? 'On' : 'Off'}
        </button>
      </div>
      ${state.shareOn ? `
        <div class="notice" style="margin-top:10px">
          <span class="tiny" style="font-family:ui-monospace,monospace">nchito.zm/w/k7mq2xrp</span>
        </div>` : ''}
    </div>

    <h2 class="section">Completed work</h2>
    ${WORK_RECORD.map(w => `
      <div class="card" style="padding:12px 14px">
        <div class="row">
          <div class="stack" style="flex:1">
            <span class="bold small">${esc(w.title)}</span>
            <span class="tiny muted">${esc(w.when)} · ${esc(w.cat)} · ★ ${w.rating.toFixed(1)}${w.onTime ? '' : ' · late'}</span>
          </div>
          <div class="stack" style="text-align:right">
            <span class="bold small">${KWACHA(w.pay)}</span>
            <span class="tiny green">✓</span>
          </div>
        </div>
      </div>`).join('')}

    <div class="notice">
      <div class="tiny muted">
        Every entry was paid through Nchito escrow and is cryptographically signed. Neither
        Nchito nor you can change a record once it's issued — that's what makes it worth showing.
      </div>
    </div>`;
}

// ---------- Actions ----------

function applyTo(id) {
  state.applied.add(id);
  state.proofs[id] = state.proofs[id] || {};
  render();
  toast('Applied — you’ll be notified if you’re picked');
}

function capture(id, kind) {
  state.proofs[id] = state.proofs[id] || {};
  state.proofs[id][kind] = true;
  render();
  toast(kind === 'before' ? 'Before photo saved' : 'After photo saved — payment can be released');
}

function takeAdvance(id, cap) {
  const fee = Math.max(Math.round(cap * 0.04 * 100) / 100, 5);
  state.advances[id] = { amount: cap, fee };
  state.ledger.unshift({ kind: 'Early Payment', amount: cap, note: 'Early payment on ' + gigById(id).title });
  render();
  toast(`${KWACHA(cap)} paid to your wallet now`);
}

function doTask(id) {
  const t = TASKS.find(x => x.id === id);
  state.done.add(id);
  state.ledger.unshift({ kind: 'Task Reward', amount: t.reward, note: t.title });
  render();
  toast(`+${KWACHA(t.reward)} added to your wallet 🎉`);
}

function cashOut() {
  const amount = Math.min(200, balance());
  if (amount <= 0) return toast('No balance to cash out yet');
  state.ledger.unshift({ kind: 'Cash Out', amount: -amount, note: 'Cash out to MTN MoMo' });
  render();
  toast(`${KWACHA(amount)} sent to your mobile money`);
}

function sendMsg(e, id) {
  e.preventDefault();
  const input = document.getElementById('msg');
  const body = input.value.trim();
  if (!body) return;
  const c = state.chats.find(x => x.id === id);
  const now = new Date();
  c.messages.push({ mine: true, body,
    time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}` });
  render();
  window.scrollTo(0, document.body.scrollHeight);
}

function reportAgent(i) {
  const a = state.agents[i];
  a.status = 'has_cash'; a.reports += 1; a.fresh = 'just now';
  render();
  toast('Thanks — others will see this agent has cash');
}

function shareReferral() {
  const text = `Join me on Nchito 🇿🇲 — find gigs and quick tasks, get paid straight to mobile money. Use my code ${USER.referral} and we both earn K20!`;
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else { navigator.clipboard?.writeText(text); toast('Invite copied to clipboard'); }
}

// ---------- Render ----------

const TITLES = { gigs: 'Gigs near you', tasks: 'Quick Tasks', chats: 'Chats', wallet: 'Wallet', profile: 'Profile' };
const DETAIL_TITLES = { gig: 'Gig details', chat: 'Chat', agents: 'Find cash near you', record: 'Work Record' };

function render() {
  const d = state.detail;
  const title = d ? DETAIL_TITLES[d.type] : TITLES[state.tab];

  document.getElementById('bar').innerHTML = d
    ? `<button class="back" onclick="back()">‹ Back</button><h1>${esc(title)}</h1>`
    : `<img class="logo" src="../brand/logo.svg" alt="Nchito"><span class="spacer"></span>
       <h1 style="font-size:15px;font-weight:600" class="muted">${esc(title)}</h1>`;

  let body;
  if (d) {
    body = d.type === 'gig' ? gigDetail(d.id)
         : d.type === 'chat' ? chatThread(d.id)
         : d.type === 'agents' ? agentsScreen()
         : recordScreen();
  } else {
    body = state.tab === 'gigs' ? gigsScreen()
         : state.tab === 'tasks' ? tasksScreen()
         : state.tab === 'chats' ? chatsScreen()
         : state.tab === 'wallet' ? walletScreen()
         : profileScreen();
  }
  document.getElementById('main').innerHTML = body;

  document.querySelectorAll('nav.tabs button').forEach(b => {
    if (b.dataset.tab === state.tab && !d) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}

document.getElementById('tabs').innerHTML = Object.keys(TITLES).map(t => `
  <button data-tab="${t}" onclick="go('${t}')">
    ${icon(t)}<span>${t === 'tasks' ? 'Tasks' : t[0].toUpperCase() + t.slice(1)}</span>
  </button>`).join('');

render();

// Offline support. The app is built around intermittent Zambian connectivity,
// so it ought to survive losing signal itself.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
