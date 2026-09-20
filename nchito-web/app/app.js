/*
 * Nchito web — a dependency-free SPA mirroring the iOS and Android apps.
 *
 * Vanilla on purpose. The product's own design principle is that Zambian mobile
 * data is expensive and intermittent, and it would be odd to ship a 200KB
 * framework to demo an app built around not wasting people's bundles.
 *
 * Two things shape the structure:
 *
 *  1. There are two users in one app. Someone looking for work and someone
 *     hiring want almost nothing in common, so `state.mode` swaps the whole
 *     navigation rather than hiding a few buttons.
 *  2. The same code runs on a K400 Android phone and a desktop browser. Layout
 *     is CSS's job; the only thing JavaScript knows about width is whether the
 *     screen is wide enough to show a list and a detail at the same time.
 */

// ---------- State ----------

const state = {
  mode: 'work',          // 'work' | 'hire'
  tab: 'gigs',
  detail: null,          // { type, id } — pushed over the current tab
  group: null,           // selected service family
  category: null,        // selected service within that family
  query: '',
  applied: new Set(),
  proofs: {},            // gigId -> { before: bool, after: bool }
  advances: {},          // gigId -> { amount, fee }
  done: new Set(),       // completed task ids
  ledger: TRANSACTIONS.slice(),
  chats: JSON.parse(JSON.stringify(CHATS)),
  agents: AGENTS.slice(),
  posts: JSON.parse(JSON.stringify(MY_POSTS)),
  shareOn: false,
  assistant: { kind: 'gigpost', fields: {}, output: null },
  anim: 'fade',
};

const balance = () => state.ledger.reduce((s, t) => s + t.amount, 0);
const gigById = id => GIGS.find(g => g.id === id);
const postById = id => state.posts.find(p => p.id === id);
const el = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sum = xs => xs.reduce((a, b) => a + b, 0);
const pct = n => Math.round(n * 100) + '%';

/* The only width question JavaScript asks: is there room to show a list and a
   detail side by side? Everything else is a media query. */
const wideQuery = window.matchMedia('(min-width: 1180px)');
const isWide = () => wideQuery.matches;

function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = el(`<div class="toast">${esc(msg)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// ---------- Navigation ----------

const NAV = {
  work: [
    { id: 'gigs',      label: 'Find work', title: 'Work near you',  icon: 'gigs' },
    { id: 'tasks',     label: 'Tasks',     title: 'Quick Tasks',    icon: 'tasks' },
    { id: 'dashboard', label: 'Numbers',   title: 'My numbers',     icon: 'chart' },
    { id: 'chats',     label: 'Chats',     title: 'Chats',          icon: 'chats' },
    { id: 'wallet',    label: 'Wallet',    title: 'Wallet',         icon: 'wallet' },
    { id: 'assistant', label: 'Office',    title: 'Office Assistant', icon: 'doc' },
    { id: 'profile',   label: 'Profile',   title: 'Profile',        icon: 'profile' },
  ],
  hire: [
    { id: 'post',      label: 'Hire',      title: 'Hire someone',   icon: 'plus' },
    { id: 'myposts',   label: 'My jobs',   title: 'Jobs I posted',  icon: 'gigs' },
    { id: 'dashboard', label: 'Numbers',   title: 'Hiring numbers', icon: 'chart' },
    { id: 'chats',     label: 'Chats',     title: 'Chats',          icon: 'chats' },
    { id: 'wallet',    label: 'Wallet',    title: 'Wallet',         icon: 'wallet' },
    { id: 'assistant', label: 'Office',    title: 'Office Assistant', icon: 'doc' },
    { id: 'profile',   label: 'Profile',   title: 'Profile',        icon: 'profile' },
  ],
};

/* On a phone seven tabs is a row of unreadable 40px targets, so the bottom bar
   carries five and the rest are reached from Profile. The desktop rail, which
   has vertical room, shows everything. */
const PHONE_TABS = { work: ['gigs', 'tasks', 'dashboard', 'chats', 'wallet'],
                     hire: ['post', 'myposts', 'dashboard', 'chats', 'wallet'] };

const navItems = () => NAV[state.mode];
const navItem = id => navItems().find(n => n.id === id) || navItems()[0];

function go(tab) {
  if (state.tab === tab && !state.detail) return;
  state.anim = 'fade';
  state.tab = tab;
  state.detail = null;
  render();
  window.scrollTo(0, 0);
}

function open_(type, id) {
  state.anim = 'fwd';
  state.detail = { type, id };
  render();
  if (!isWide()) window.scrollTo(0, 0);
}

function back() {
  state.anim = 'back';
  state.detail = null;
  render();
}

function setMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  state.tab = navItems()[0] ? NAV[mode][0].id : 'gigs';
  state.detail = null;
  state.anim = 'fade';
  render();
  window.scrollTo(0, 0);
  toast(mode === 'hire' ? 'Hiring mode — post a job and pick who does it'
                        : 'Working mode — find jobs and get paid');
}

// ---------- Icons (inline so there is no icon-font request) ----------

const ICON = {
  gigs:   '<path d="M4 7h16v13H4z"/><path d="M9 7V5h6v2"/>',
  tasks:  '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  chats:  '<path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.4 3.5A7.9 7.9 0 0 1 21 12z"/>',
  wallet: '<path d="M3 7h15a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5a2 2 0 0 1-2-2z"/><circle cx="17" cy="13" r="1.4"/>',
  profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  chart:  '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  doc:    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  plus:   '<path d="M12 5v14M5 12h14"/>',
};
const icon = name =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ICON.gigs}</svg>`;

// ---------- Charts (inline SVG, no library) ----------

/*
 * Charts are the one place JavaScript has to know pixels.
 *
 * An SVG with a fixed viewBox either letterboxes or distorts when its container
 * is three times wider than it was drawn for — the first sparkline here scaled
 * from 320px to 1242px and came out as a smear. So the markup is a placeholder,
 * and the chart is drawn once its box has a measured width.
 */
function chartSlot(kind, values, labels = [], opts = {}) {
  return `<div class="chartbox" data-kind="${kind}" data-alt="${opts.alt ? 1 : 0}"
               data-values="${esc(JSON.stringify(values))}"
               data-labels="${esc(JSON.stringify(labels))}"></div>`;
}

const sparkline = (values, opts = {}) => chartSlot('spark', values, [], opts);
const barChart = (values, labels, opts = {}) => chartSlot('bars', values, labels, opts);

function drawCharts(root) {
  root.querySelectorAll('.chartbox').forEach(box => {
    const w = Math.max(Math.round(box.clientWidth), 160);
    const values = JSON.parse(box.dataset.values);
    const labels = JSON.parse(box.dataset.labels);
    const alt = box.dataset.alt === '1';
    box.innerHTML = box.dataset.kind === 'spark'
      ? sparkSVG(values, w, alt)
      : barsSVG(values, labels, w, alt);
    box.querySelectorAll('path.c-line.c-draw').forEach(path => {
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
    });
  });
}

/* A filled sparkline over a value series. Height grows a little with width so
   a chart does not become a letterbox slot on a desktop. */
function sparkSVG(values, w, alt) {
  if (!values.length) return '';
  const h = Math.round(Math.min(Math.max(w * 0.26, 84), 180));
  const max = Math.max(...values, 1);
  const pad = 8;
  const x = i => pad + (i * (w - pad * 2)) / Math.max(values.length - 1, 1);
  const y = v => h - pad - (v / max) * (h - pad * 2);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = 'M' + pts.join(' L');
  const area = `${line} L${x(values.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;
  const colour = alt ? 'var(--copper)' : 'var(--green)';
  const uid = 'sp' + Math.random().toString(36).slice(2, 8);
  const last = values.length - 1;
  return `
    <svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"
         role="img" aria-label="Trend over the last ${values.length} weeks">
      <defs>
        <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${colour}" stop-opacity=".26"/>
          <stop offset="100%" stop-color="${colour}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#${uid})"/>
      <!-- stroke as a style, not an attribute: the .c-line rule would otherwise
           win over a presentation attribute and paint every series green. -->
      <path class="c-line c-draw" d="${line}" style="stroke:${colour}"/>
      <circle cx="${x(last).toFixed(1)}" cy="${y(values[last]).toFixed(1)}" r="4" fill="${colour}"/>
    </svg>`;
}

/* Bars with a baseline. Labels are thinned rather than rotated: a rotated axis
   label is unreadable at phone width and lies about how much room there is. */
function barsSVG(values, labels, w, alt) {
  const h = Math.round(Math.min(Math.max(w * 0.34, 130), 240));
  const max = Math.max(...values, 1);
  const n = values.length;
  const pad = 14, gap = Math.max(2, Math.round(w / 140));
  const bw = (w - pad * 2 - gap * (n - 1)) / n;
  const base = h - 22;
  // Thin the labels to whatever the width can actually fit at 9px.
  const every = Math.max(1, Math.ceil(n / Math.floor(w / 42)));
  return `
    <svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"
         role="img" aria-label="${esc(labels.join(', '))}">
      <line class="c-grid" x1="${pad}" y1="${base}" x2="${w - pad}" y2="${base}"/>
      ${values.map((v, i) => {
        const bh = Math.max((v / max) * (h - 46), v > 0 ? 2 : 0);
        const bx = pad + i * (bw + gap);
        return `<rect class="c-bar c-draw ${alt ? 'alt' : ''}" x="${bx.toFixed(1)}" y="${(base - bh).toFixed(1)}"
                      width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3"
                      style="animation-delay:${i * 35}ms"><title>${esc(labels[i] || '')}: ${KWACHA(v)}</title></rect>`;
      }).join('')}
      ${labels.map((l, i) => i % every ? '' :
        `<text class="c-axis" x="${(pad + i * (bw + gap) + bw / 2).toFixed(1)}" y="${h - 7}"
               text-anchor="middle">${esc(l)}</text>`).join('')}
    </svg>`;
}

/* A ranked breakdown. Horizontal bars beat a pie here: the point is comparing
   categories to each other, and nobody compares pie slices accurately. */
function mixBars(rows, { alt = false } = {}) {
  const top = Math.max(...rows.map(r => r.value), 1);
  return rows.map((r, i) => `
    <div class="mixrow">
      <div class="name">${esc(r.name)}</div>
      <div class="track"><i style="width:${((r.value / top) * 100).toFixed(1)}%;
        background:${alt ? 'var(--copper)' : 'var(--green)'};animation-delay:${i * 45}ms"></i></div>
      <div class="val">${esc(r.display)}</div>
    </div>`).join('');
}

function kpi(value, label, delta) {
  const d = delta
    ? `<div class="d ${delta.dir}">${delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '—'} ${esc(delta.text)}</div>`
    : '';
  return `<div class="kpi"><div class="v">${esc(value)}</div><div class="k">${esc(label)}</div>${d}</div>`;
}

// ---------- Derived numbers ----------

/* All dashboard figures come from one place so a KPI and a chart can never
   disagree about the same quantity. */
function metrics() {
  const rec = WORK_RECORD;
  const weeks = EARNINGS_WEEKS;
  const last4 = sum(weeks.slice(-4));
  const prev4 = sum(weeks.slice(-8, -4));
  const activeWeeks = weeks.filter(v => v > 0).length;

  const byCat = {};
  rec.forEach(r => { byCat[r.cat] = (byCat[r.cat] || 0) + r.pay; });
  const mix = Object.entries(byCat)
    .map(([id, v]) => ({ name: categoryLabel(id), value: v, display: KWACHA(v) }))
    .sort((a, b) => b.value - a.value);

  // What loyalty tiering actually saved, versus everything at the entry rate.
  const feeSaved = sum(GIGS.filter(g => state.applied.has(g.id))
    .map(g => g.pay * (0.10 - tierFor(g.together).rate)));
  const repeat = rec.length ? GIGS.filter(g => g.together > 0).length / GIGS.length : 0;

  const spend = SPEND_WEEKS;
  const posts = state.posts;
  const filled = posts.filter(p => p.status !== 'open').length;

  return {
    weeks, last4, prev4, activeWeeks, mix, feeSaved, repeat,
    delta4: prev4 === 0 ? null : (last4 - prev4) / prev4,
    bestWeek: Math.max(...weeks),
    perActiveWeek: activeWeeks ? sum(weeks) / activeWeeks : 0,
    spend, spendTotal: sum(spend),
    posts: posts.length, filled,
    fillRate: posts.length ? filled / posts.length : 0,
    avgApplicants: posts.length
      ? posts.reduce((s, p) => s + (p.applicants.length || (p.worker ? 6 : 0)), 0) / posts.length : 0,
    repeatWorkers: posts.filter(p => p.worker && p.worker.together > 0).length,
  };
}

const WEEK_LABELS = EARNINGS_WEEKS.map((_, i) => 'W' + (i + 1));

// ---------- Screens: finding work ----------

function gigsScreen() {
  const q = state.query.trim().toLowerCase();
  const list = GIGS
    .filter(g => !state.group || CATEGORY_BY_ID[g.category].group === state.group)
    .filter(g => !state.category || g.category === state.category)
    .filter(g => !q || (g.title + ' ' + g.area + ' ' + g.city + ' ' + categoryLabel(g.category))
      .toLowerCase().includes(q))
    .sort((a, b) => (b.boosted ? 1 : 0) - (a.boosted ? 1 : 0));

  const cats = state.group ? categoriesIn(state.group) : [];

  return `
    <input class="field" style="margin-bottom:10px" placeholder="Search 39 services, or a place…"
           value="${esc(state.query)}" oninput="state.query=this.value; renderMain()" aria-label="Search gigs">

    <div class="chips" role="group" aria-label="Service families">
      ${SERVICE_GROUPS.map(g => `
        <button class="chip" aria-pressed="${state.group === g.id}"
                onclick="pickGroup('${g.id}')">${g.emoji} ${esc(g.label)}</button>`).join('')}
    </div>

    ${state.group ? `
      <div class="chips" role="group" aria-label="${esc(GROUP_BY_ID[state.group].label)} services">
        ${cats.map(c => `
          <button class="chip copper" aria-pressed="${state.category === c.id}"
                  onclick="state.category = state.category === '${c.id}' ? null : '${c.id}'; renderMain()">
            ${esc(c.label)}</button>`).join('')}
      </div>` : ''}

    <div class="row" style="margin:2px 0 10px">
      <span class="tiny muted">${list.length} open ${list.length === 1 ? 'job' : 'jobs'}${
        state.group ? ' in ' + esc(GROUP_BY_ID[state.group].label) : ' across 39 services'}</span>
      <span class="spacer"></span>
      ${(state.group || state.category || state.query)
        ? '<button class="link" onclick="clearFilters()">Clear</button>' : ''}
    </div>

    <div class="grid">
      ${list.map(g => gigCard(g)).join('')}
    </div>
    ${list.length ? '' : `<div class="empty">Nothing open here right now.<br>
      <button class="link" onclick="clearFilters()">Show everything</button></div>`}
  `;
}

function gigCard(g) {
  const selected = state.detail && state.detail.type === 'gig' && state.detail.id === g.id;
  return `
    <div class="card tap ${selected ? 'selected' : ''}" onclick="open_('gig','${g.id}')">
      <div class="row top" style="margin-bottom:7px">
        <div class="row wrap" style="flex:1">
          <span class="pill">${categoryEmoji(g.category)} ${esc(categoryLabel(g.category))}</span>
          ${g.urgent ? '<span class="pill red">URGENT</span>' : ''}
          ${g.boosted ? '<span class="pill copper">★ Featured</span>' : ''}
        </div>
        <span class="bold green" style="white-space:nowrap">${KWACHA(g.pay)}</span>
      </div>
      <div class="bold" style="font-size:14.5px;line-height:1.35">${esc(g.title)}</div>
      <div class="small muted" style="margin-top:5px">
        ${esc(g.city)} · ${esc(g.area)} — ${g.applicants} applied · ${esc(g.ago)} ago
      </div>
    </div>`;
}

function gigDetail(id) {
  const g = gigById(id);
  if (!g) return '<div class="empty">That gig is no longer open.</div>';
  const tier = tierFor(g.together);
  const payout = g.pay * (1 - tier.rate);
  const applied = state.applied.has(id);
  const proof = state.proofs[id] || {};
  const adv = state.advances[id];
  const next = TIERS.filter(t => t.rate < tier.rate).pop();
  const needed = next ? next.min - g.together : 0;

  return `
    <div class="card">
      <div class="row wrap" style="margin-bottom:8px">
        <span class="pill">${categoryEmoji(g.category)} ${esc(categoryLabel(g.category))}</span>
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
    <div class="hero" style="text-align:left;padding:18px">
      <div class="bold">Earn in your spare time</div>
      <div class="small" style="opacity:.92;margin-top:3px">
        ${KWACHA(available)} available right now — tasks refresh daily.
      </div>
    </div>
    <div class="grid">
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
    </div>`;
}

// ---------- Screens: hiring ----------

const POST_STATUS = {
  open:             { label: 'Taking applications', cls: 'pill copper' },
  assigned:         { label: 'In progress',         cls: 'pill' },
  awaiting_release: { label: 'Waiting on you',      cls: 'pill red' },
  settled:          { label: 'Paid',                cls: 'pill grey' },
};

function myPostsScreen() {
  const order = { awaiting_release: 0, open: 1, assigned: 2, settled: 3 };
  const list = state.posts.slice().sort((a, b) => order[a.status] - order[b.status]);
  const waiting = list.filter(p => p.status === 'awaiting_release').length;

  return `
    ${waiting ? `
      <div class="notice" style="background:rgba(222,32,16,.09)">
        <div class="stack">
          <span class="bold small">${waiting} job${waiting === 1 ? '' : 's'} waiting for you to release payment</span>
          <span class="tiny muted">The worker has finished and attached both proof photos. Their money
            is sitting in escrow until you confirm.</span>
        </div>
      </div>` : ''}

    <div class="grid">
    ${list.map(p => {
      const st = POST_STATUS[p.status];
      const selected = state.detail && state.detail.type === 'post' && state.detail.id === p.id;
      return `
        <div class="card tap ${selected ? 'selected' : ''}" onclick="open_('post','${p.id}')">
          <div class="row top" style="margin-bottom:7px">
            <div class="row wrap" style="flex:1">
              <span class="pill">${categoryEmoji(p.category)} ${esc(categoryLabel(p.category))}</span>
              <span class="${st.cls}">${st.label}</span>
            </div>
            <span class="bold" style="white-space:nowrap">${KWACHA(p.pay)}</span>
          </div>
          <div class="bold" style="font-size:14.5px;line-height:1.35">${esc(p.title)}</div>
          <div class="small muted" style="margin-top:5px">
            ${p.worker ? '👤 ' + esc(p.worker.name)
                       : p.applicants.length + ' applicant' + (p.applicants.length === 1 ? '' : 's')}
            · ${esc(p.due)}
          </div>
        </div>`;
    }).join('')}
    </div>`;
}

function postDetail(id) {
  const p = postById(id);
  if (!p) return '<div class="empty">That job is gone.</div>';
  const st = POST_STATUS[p.status];

  return `
    <div class="card">
      <div class="row wrap" style="margin-bottom:8px">
        <span class="pill">${categoryEmoji(p.category)} ${esc(categoryLabel(p.category))}</span>
        <span class="${st.cls}">${st.label}</span>
      </div>
      <div class="bold" style="font-size:18px;line-height:1.3">${esc(p.title)}</div>
      <div class="stat-row" style="margin-top:14px">
        <div><div class="v">${KWACHA(p.pay)}</div><div class="l">In escrow</div></div>
        <div><div class="v">${p.worker ? 1 : p.applicants.length}</div>
             <div class="l">${p.worker ? 'Hired' : 'Applicants'}</div></div>
        <div><div class="v" style="font-size:13px">${esc(p.due)}</div><div class="l">Due</div></div>
      </div>
    </div>

    ${p.status === 'awaiting_release' ? `
      <div class="notice copper" style="flex-direction:column;gap:9px">
        <div class="stack" style="width:100%">
          <span class="bold small">Both proof photos are attached</span>
          <span class="tiny muted">${esc(p.worker.name)} photographed the job before starting and after
            finishing, each stamped with the time and place. Releasing pays them
            ${KWACHA(p.pay)} instantly to mobile money.</span>
        </div>
        <button class="primary copper" onclick="releasePay('${p.id}')">Release ${KWACHA(p.pay)}</button>
      </div>` : ''}

    ${p.worker ? `
      <h2 class="section">Working on it</h2>
      <div class="card">
        <div class="row">
          <div class="stack" style="flex:1">
            <span class="bold small">${esc(p.worker.name)}</span>
            <span class="tiny copper">★ ${p.worker.rating.toFixed(1)} · ${p.worker.jobs} jobs on Nchito</span>
            ${p.worker.together ? `<span class="tiny green">${p.worker.together} jobs with you —
              your fee is ${Math.round(tierFor(p.worker.together).rate * 100)}%</span>` : ''}
          </div>
          <button class="link" onclick="go('chats')">Message</button>
        </div>
      </div>` : ''}

    ${p.applicants.length ? `
      <h2 class="section">${p.applicants.length} people applied</h2>
      ${p.applicants.map((a, i) => `
        <div class="card">
          <div class="row top">
            <div class="stack" style="flex:1">
              <span class="bold small">${esc(a.name)}${a.verified ? ' <span class="tiny green">✓ NRC</span>' : ''}</span>
              <span class="tiny copper">★ ${a.rating.toFixed(1)} · ${a.jobs} jobs · ${pct(a.onTime)} on time</span>
              ${a.together ? `<span class="tiny green">Worked with you ${a.together} time${a.together === 1 ? '' : 's'}</span>` : ''}
            </div>
            <div class="stack" style="text-align:right">
              <span class="bold">${KWACHA(a.quote)}</span>
              <span class="tiny muted">their quote</span>
            </div>
          </div>
          <div class="small muted" style="margin-top:8px">${esc(a.note)}</div>
          <div class="row" style="margin-top:10px;gap:8px">
            <button class="chip" onclick="go('chats')">Message</button>
            <button class="chip" style="background:var(--green);color:#fff;border-color:var(--green)"
                    onclick="hire('${p.id}',${i})">Hire ${esc(a.name.split(' ')[0])}</button>
          </div>
        </div>`).join('')}` : ''}

    ${p.status === 'settled' ? `
      <div class="notice grey">
        <div class="tiny muted">Paid and closed. This job is on ${esc(p.worker.name)}'s Work Record,
          signed and permanent — which is what makes their next quote worth trusting.</div>
      </div>` : ''}
  `;
}

const POST_DRAFT = { title: '', category: 'cleaning', pay: '', area: '', urgent: false, boost: false };

function postScreen() {
  const d = POST_DRAFT;
  const cat = CATEGORY_BY_ID[d.category];
  const group = cat.group;
  // The band is the median of comparable settled work — the same rule
  // price_band() applies in Postgres, with the same refusal to guess on thin
  // data (INNOVATION.md §5.1).
  const comparable = GIGS.filter(g => g.category === d.category).map(g => g.pay).sort((a, b) => a - b);
  const band = comparable.length >= 3
    ? { lo: comparable[Math.floor(comparable.length * 0.25)],
        mid: comparable[Math.floor(comparable.length * 0.5)],
        hi: comparable[Math.floor(comparable.length * 0.75)], n: comparable.length }
    : null;

  return `
    <div class="hero copper" style="text-align:left;padding:18px">
      <div class="bold">Hire someone today</div>
      <div class="small" style="opacity:.94;margin-top:3px">
        Your money sits in escrow until the job is done and photographed.
        Nothing leaves your wallet until you say so.
      </div>
    </div>

    <label class="lbl" for="pt">What needs doing?</label>
    <input class="field" id="pt" value="${esc(d.title)}"
           placeholder="e.g. Paint the shop front and fit new signage"
           oninput="POST_DRAFT.title=this.value">

    <label class="lbl">Which service?</label>
    <div class="chips">
      ${SERVICE_GROUPS.map(g => `
        <button class="chip" aria-pressed="${group === g.id}"
                onclick="POST_DRAFT.category = categoriesIn('${g.id}')[0].id; renderMain()">
          ${g.emoji} ${esc(g.label)}</button>`).join('')}
    </div>
    <div class="chips">
      ${categoriesIn(group).map(c => `
        <button class="chip copper" aria-pressed="${d.category === c.id}"
                onclick="POST_DRAFT.category='${c.id}'; renderMain()">${esc(c.label)}</button>`).join('')}
    </div>

    <label class="lbl" for="pp">What will you pay? (Kwacha)</label>
    <input class="field" id="pp" inputmode="decimal" value="${esc(d.pay)}"
           placeholder="${band ? band.mid : '500'}" oninput="POST_DRAFT.pay=this.value">

    ${band ? `
      <div class="notice" style="margin-top:10px;flex-direction:column;gap:6px">
        <div class="row" style="width:100%">
          <span class="bold small">Similar ${esc(cat.label.toLowerCase())} jobs pay</span>
          <span class="spacer"></span>
          <span class="bold green">${KWACHA(band.mid)}</span>
        </div>
        <div class="tiny muted">${KWACHA(band.lo)} – ${KWACHA(band.hi)} across ${band.n} comparable
          jobs. Posting below the range usually means no applicants, not a saving.</div>
      </div>`
    : `<div class="notice grey" style="margin-top:10px">
        <div class="tiny muted">Not enough comparable ${esc(cat.label.toLowerCase())} jobs yet to
          suggest a price. We'd rather say nothing than guess at your money.</div>
      </div>`}

    <label class="lbl" for="pa">Where?</label>
    <input class="field" id="pa" value="${esc(d.area)}" placeholder="e.g. Kabwata, Lusaka"
           oninput="POST_DRAFT.area=this.value">

    <div class="card" style="margin-top:14px">
      <div class="row">
        <div class="stack" style="flex:1">
          <span class="bold small">Mark as urgent</span>
          <span class="tiny muted">Shown first to people who can start today.</span>
        </div>
        <button class="chip" aria-pressed="${d.urgent}"
                onclick="POST_DRAFT.urgent=!POST_DRAFT.urgent; renderMain()">${d.urgent ? 'On' : 'Off'}</button>
      </div>
    </div>
    <div class="card">
      <div class="row">
        <div class="stack" style="flex:1">
          <span class="bold small">Feature this job — K25</span>
          <span class="tiny muted">Pinned to the top of the feed for 48 hours.</span>
        </div>
        <button class="chip copper" aria-pressed="${d.boost}"
                onclick="POST_DRAFT.boost=!POST_DRAFT.boost; renderMain()">${d.boost ? 'On' : 'Off'}</button>
      </div>
    </div>

    <div style="margin-top:14px">
      <button class="primary copper" onclick="publishPost()">
        Post job${d.pay ? ' · hold ' + KWACHA(Number(d.pay) + (d.boost ? 25 : 0)) + ' in escrow' : ''}
      </button>
    </div>
    <div class="tiny muted" style="margin-top:9px;text-align:center">
      Not sure how to word it? The
      <button class="link" onclick="useAssistantFor('gigpost')">Office Assistant</button>
      will draft it for you.
    </div>`;
}

// ---------- Screens: money ----------

function walletScreen() {
  const adv = Object.entries(state.advances)[0];
  const hiring = state.mode === 'hire';
  const held = state.posts.filter(p => p.status !== 'settled').reduce((s, p) => s + p.pay, 0);

  return `
    <div class="hero ${hiring ? 'copper' : ''}">
      <div class="small" style="opacity:.9">${hiring ? 'Held in escrow' : 'Available balance'}</div>
      <div class="amount">${KWACHA(hiring ? held : balance())}</div>
      ${hiring
        ? `<div class="tiny" style="opacity:.9;margin-top:6px">Across ${state.posts.filter(p => p.status !== 'settled').length} open jobs.
             Released only when you confirm the work.</div>`
        : `<button class="chip" style="margin-top:8px;background:#fff;color:var(--green);border:0"
                   onclick="cashOut()">Cash out to MTN MoMo</button>`}
    </div>

    ${hiring ? '' : `
    <div class="card tap" onclick="open_('agents',null)">
      <div class="stack">
        <span class="bold small">📍 Find cash near you</span>
        <span class="tiny green">Which agents actually have float right now</span>
        <span class="tiny muted">Reported by other Nchito workers. A balance you can't withdraw isn't money.</span>
      </div>
    </div>`}

    ${adv && !hiring ? `
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
    <div class="grid">
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
    </div>

    <div class="notice">
      <div class="tiny muted">
        These reports come from other Nchito workers, not from the networks. Float changes
        through the day, so always check how recent a report is — and tell us what you find
        so the next person doesn't waste a trip.
      </div>
    </div>`;
}

// ---------- Screens: dashboard ----------

function dashboardScreen() {
  return state.mode === 'hire' ? hireDashboard() : workDashboard();
}

function workDashboard() {
  const m = metrics();
  const delta = m.delta4 === null
    ? { dir: 'flat', text: 'no earlier month' }
    : { dir: m.delta4 >= 0 ? 'up' : 'down', text: pct(Math.abs(m.delta4)) + ' vs last month' };

  return `
    <div class="kpis">
      ${kpi(KWACHA(m.last4), 'Earned, last 4 weeks', delta)}
      ${kpi(String(WORK_RECORD.length), 'Jobs settled')}
      ${kpi(pct(USER.onTimeRate), 'Delivered on time')}
      ${kpi(USER.rating.toFixed(1) + '★', 'Average rating')}
    </div>

    <div class="card">
      <div class="row" style="margin-bottom:4px">
        <span class="bold small">Earnings, 12 weeks</span>
        <span class="spacer"></span>
        <span class="tiny muted">${KWACHA(sum(m.weeks))} total</span>
      </div>
      ${sparkline(m.weeks)}
      <div class="tiny muted" style="margin-top:6px">
        You earned in ${m.activeWeeks} of the last 12 weeks, averaging
        ${KWACHA(m.perActiveWeek)} in a week you worked. Best week: ${KWACHA(m.bestWeek)}.
      </div>
    </div>

    <div class="card">
      <div class="bold small" style="margin-bottom:10px">Week by week</div>
      ${barChart(m.weeks, WEEK_LABELS)}
      <div class="tiny muted">Four of these weeks are empty. That gap is the thing worth
        working on — not the average.</div>
    </div>

    <div class="card">
      <div class="bold small" style="margin-bottom:12px">Where your money comes from</div>
      ${mixBars(m.mix)}
      <div class="tiny muted" style="margin-top:8px">
        ${m.mix.length >= 2
          ? `${esc(m.mix[0].name)} is ${pct(m.mix[0].value / sum(m.mix.map(r => r.value)))} of everything
             you've earned. Concentration pays well until that one client stops.`
          : 'One category so far — worth widening.'}
      </div>
    </div>

    <div class="card">
      <div class="bold small" style="margin-bottom:8px">Fees and loyalty</div>
      <div class="stat-row">
        <div><div class="v green">${Math.round(tierFor(0).rate * 100)}%</div><div class="l">New poster</div></div>
        <div><div class="v green">7%</div><div class="l">After 3 jobs</div></div>
        <div><div class="v green">5%</div><div class="l">After 10 jobs</div></div>
      </div>
      <div class="tiny muted" style="margin-top:10px">
        Your fee falls the longer you work with the same poster, which is the point:
        going off-platform to dodge a 10% cut stops being worth the risk once it's 5%.
        ${state.applied.size ? `On your current applications that's
          ${KWACHA(m.feeSaved)} saved versus the entry rate.` : ''}
      </div>
    </div>

    <div class="card tap" onclick="open_('record',null)">
      <div class="stack">
        <span class="bold small">📄 Open my Work Record</span>
        <span class="tiny muted">The signed version of these numbers — the one an employer
          or a lender can verify.</span>
      </div>
    </div>`;
}

function hireDashboard() {
  const m = metrics();
  const byCat = {};
  state.posts.forEach(p => { byCat[p.category] = (byCat[p.category] || 0) + p.pay; });
  const mix = Object.entries(byCat)
    .map(([id, v]) => ({ name: categoryLabel(id), value: v, display: KWACHA(v) }))
    .sort((a, b) => b.value - a.value);

  return `
    <div class="kpis">
      ${kpi(KWACHA(m.spendTotal), 'Spent, 12 weeks')}
      ${kpi(String(m.posts), 'Jobs posted')}
      ${kpi(pct(m.fillRate), 'Filled')}
      ${kpi(m.avgApplicants.toFixed(1), 'Applicants per job')}
    </div>

    <div class="card">
      <div class="row" style="margin-bottom:4px">
        <span class="bold small">What you've spent</span>
        <span class="spacer"></span>
        <span class="tiny muted">12 weeks</span>
      </div>
      ${sparkline(m.spend, { alt: true })}
      <div class="tiny muted" style="margin-top:6px">
        Spend is lumpy because hiring is lumpy. The two spikes are the wall and
        the bookkeeping catch-up.
      </div>
    </div>

    <div class="card">
      <div class="bold small" style="margin-bottom:10px">Week by week</div>
      ${barChart(m.spend, WEEK_LABELS, { alt: true })}
    </div>

    <div class="card">
      <div class="bold small" style="margin-bottom:12px">Spend by service</div>
      ${mixBars(mix, { alt: true })}
    </div>

    <div class="card">
      <div class="bold small" style="margin-bottom:8px">Repeat hiring</div>
      <div class="stat-row">
        <div><div class="v">${m.repeatWorkers}</div><div class="l">Repeat workers</div></div>
        <div><div class="v green">${Math.round(tierFor(11).rate * 100)}%</div><div class="l">Your best fee</div></div>
        <div><div class="v">${state.posts.filter(p => p.status === 'open').length}</div><div class="l">Still open</div></div>
      </div>
      <div class="tiny muted" style="margin-top:10px">
        Re-hiring someone you've used before costs you less in fees and takes less
        time to fill. It is the cheapest thing you can do on this app.
      </div>
    </div>`;
}

// ---------- Screens: office assistant ----------

/* Templates, not a language model. It runs offline, costs nothing, and says
 * exactly what it is — a form that fills in wording people otherwise pay a
 * secretary in town to type. Every output is editable before it is sent. */
const ASSIST = {
  gigpost: {
    noun: 'job post',
    label: 'Write a job post', emoji: '📋',
    blurb: 'Turn a few words into a post people actually apply to.',
    fields: [
      { k: 'what',   l: 'What needs doing?', ph: 'Paint the shop front and fit new signage' },
      { k: 'where',  l: 'Where?',            ph: 'Kabwata, Lusaka' },
      { k: 'when',   l: 'By when?',          ph: 'This Saturday' },
      { k: 'budget', l: 'Your budget (K)',   ph: '1800' },
      { k: 'extra',  l: 'Anything provided?', ph: 'Paint and brushes already bought' },
    ],
    build: f => [
      `${f.what || 'Job needed'}`,
      ``,
      `Where: ${f.where || '—'}`,
      `When: ${f.when || 'As soon as possible'}`,
      `Pay: K${f.budget || '—'}, held in Nchito escrow and released when the work is done.`,
      f.extra ? `Provided: ${f.extra}` : '',
      ``,
      `What I need from you:`,
      `• Tell me when you can start.`,
      `• Say roughly how long it will take.`,
      `• Mention similar work you have done.`,
      ``,
      `Please apply through Nchito so the payment is protected for both of us.`,
    ].filter(Boolean).join('\n'),
  },
  quote: {
    noun: 'quotation',
    label: 'Quote a customer', emoji: '🧾',
    blurb: 'An itemised quote with the total worked out for you.',
    fields: [
      { k: 'customer', l: 'Customer name', ph: 'Mrs Banda' },
      { k: 'job',      l: 'The job',       ph: 'Repaint 4-bedroom house, inside and out' },
      { k: 'materials',l: 'Materials (K)', ph: '2400' },
      { k: 'days',     l: 'Days of work',  ph: '6' },
      { k: 'rate',     l: 'Your day rate (K)', ph: '350' },
    ],
    build: f => {
      const mat = Number(f.materials) || 0;
      const days = Number(f.days) || 0;
      const rate = Number(f.rate) || 0;
      const labour = days * rate;
      return [
        `QUOTATION`,
        `For: ${f.customer || '—'}`,
        `Job: ${f.job || '—'}`,
        `Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        ``,
        `Materials                     K${mat.toFixed(2)}`,
        `Labour (${days} days @ K${rate})        K${labour.toFixed(2)}`,
        `----------------------------------------`,
        `TOTAL                         K${(mat + labour).toFixed(2)}`,
        ``,
        `Payment: half before starting, half on completion.`,
        `This quote is valid for 14 days.`,
        ``,
        `${USER.name}`,
        `${USER.phone}`,
      ].join('\n');
    },
  },
  invoice: {
    noun: 'invoice',
    label: 'Make an invoice', emoji: '💵',
    blurb: 'A numbered invoice with your mobile money details on it.',
    fields: [
      { k: 'customer', l: 'Customer name', ph: 'Chembe Hardware' },
      { k: 'job',      l: 'What you did',  ph: 'Six-page website, delivered 14 September' },
      { k: 'amount',   l: 'Amount (K)',    ph: '4500' },
      { k: 'momo',     l: 'Your mobile money number', ph: '097 000 0000' },
    ],
    build: f => {
      const num = 'INV-' + new Date().getFullYear() + '-' +
        String(Math.floor(Math.random() * 900) + 100);
      return [
        `INVOICE ${num}`,
        `Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        ``,
        `To: ${f.customer || '—'}`,
        `From: ${USER.name}`,
        ``,
        `Description: ${f.job || '—'}`,
        ``,
        `AMOUNT DUE: K${Number(f.amount || 0).toFixed(2)}`,
        ``,
        `Pay to mobile money: ${f.momo || USER.phone}`,
        `Please use ${num} as the reference.`,
        `Payment due within 14 days.`,
        ``,
        `Thank you for your business.`,
      ].join('\n');
    },
  },
  chase: {
    noun: 'follow-up message',
    label: 'Chase a late payment', emoji: '⏰',
    blurb: 'Firm, polite, and not a message you will regret sending.',
    fields: [
      { k: 'customer', l: 'Who owes you', ph: 'Chembe Hardware' },
      { k: 'job',      l: 'For what',     ph: 'the website delivered on 14 September' },
      { k: 'amount',   l: 'Amount (K)',   ph: '4500' },
      { k: 'days',     l: 'Days overdue', ph: '12' },
    ],
    build: f => [
      `Good morning ${f.customer || ''},`.trim(),
      ``,
      `I hope you are well. I am following up on my invoice for ${f.job || 'the work completed'},`,
      `K${Number(f.amount || 0).toFixed(2)}, which is now ${f.days || 'several'} days past the due date.`,
      ``,
      `If the payment has already been sent, please ignore this and let me know the`,
      `reference so I can check on my side.`,
      ``,
      `If not, could you let me know a date I can expect it? I am happy to discuss`,
      `a part payment if that is easier.`,
      ``,
      `Thank you,`,
      `${USER.name}`,
      `${USER.phone}`,
    ].join('\n'),
  },
  advert: {
    noun: 'advert',
    label: 'WhatsApp advert', emoji: '📣',
    blurb: 'A status or group post for the service you offer.',
    fields: [
      { k: 'service', l: 'What you do',   ph: 'Plumbing and borehole repairs' },
      { k: 'area',    l: 'Areas you cover', ph: 'Kabwata, Libala, Chilenje' },
      { k: 'from',    l: 'Prices from (K)', ph: '150' },
      { k: 'proof',   l: 'Why trust you', ph: '31 jobs completed, 4.8 stars on Nchito' },
    ],
    build: f => [
      `🔧 ${f.service || 'Services available'}`,
      ``,
      `📍 ${f.area || 'Lusaka and surrounding areas'}`,
      `💰 From K${f.from || '—'}`,
      `✅ ${f.proof || 'Verified on Nchito'}`,
      ``,
      `Call or WhatsApp: ${USER.phone}`,
      ``,
      `Book through Nchito and your payment is held safely until the job is done. 🇿🇲`,
    ].join('\n'),
  },
  receipt: {
    noun: 'receipt',
    label: 'Write a receipt', emoji: '🧻',
    blurb: 'Proof of payment for a customer who asks for one.',
    fields: [
      { k: 'customer', l: 'Received from', ph: 'Mrs Banda' },
      { k: 'amount',   l: 'Amount (K)',    ph: '1800' },
      { k: 'job',      l: 'For',           ph: 'Painting the shop front' },
      { k: 'method',   l: 'Paid by',       ph: 'MTN MoMo' },
    ],
    build: f => [
      `RECEIPT`,
      `No: R-${Date.now().toString().slice(-6)}`,
      `Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      ``,
      `Received from: ${f.customer || '—'}`,
      `The sum of: K${Number(f.amount || 0).toFixed(2)}`,
      `Being payment for: ${f.job || '—'}`,
      `Paid by: ${f.method || 'Mobile money'}`,
      ``,
      `Received with thanks,`,
      `${USER.name}`,
      `${USER.phone}`,
    ].join('\n'),
  },
};

function assistantScreen() {
  const a = state.assistant;
  const tpl = ASSIST[a.kind];
  return `
    <div class="notice grey">
      <div class="stack">
        <span class="bold small">📎 Office Assistant</span>
        <span class="tiny muted">Fills the paperwork a small business needs — quotes, invoices,
          receipts, adverts, job posts. It works offline from proven templates, not from
          a language model, so it costs you no data and never invents a number.
          Read it before you send it.</span>
      </div>
    </div>

    <div class="chips">
      ${Object.entries(ASSIST).map(([k, t]) => `
        <button class="chip" aria-pressed="${a.kind === k}" onclick="useAssistantFor('${k}')">
          ${t.emoji} ${esc(t.label)}</button>`).join('')}
    </div>

    <div class="card">
      <div class="bold small">${tpl.emoji} ${esc(tpl.label)}</div>
      <div class="tiny muted" style="margin-top:3px">${esc(tpl.blurb)}</div>

      ${tpl.fields.map(f => `
        <label class="lbl" for="af-${f.k}">${esc(f.l)}</label>
        <input class="field" id="af-${f.k}" placeholder="${esc(f.ph)}"
               value="${esc(a.fields[f.k] || '')}"
               oninput="state.assistant.fields['${f.k}']=this.value">`).join('')}

      <div style="margin-top:14px">
        <button class="primary" onclick="buildAssist()">Write it for me</button>
      </div>
    </div>

    ${a.output ? `
      <div class="card">
        <div class="row" style="margin-bottom:4px">
          <span class="bold small">Your ${esc(tpl.noun)}</span>
          <span class="spacer"></span>
          <button class="link" onclick="copyOut()">Copy</button>
        </div>
        <textarea class="out" id="assistout" rows="${Math.min(a.output.split('\n').length + 1, 26)}"
                  oninput="state.assistant.output=this.value"
                  aria-label="Generated text, editable">${esc(a.output)}</textarea>
        <div class="row" style="gap:8px;margin-top:10px">
          <button class="chip" onclick="shareOut()">Share to WhatsApp</button>
          <button class="chip" onclick="copyOut()">Copy</button>
        </div>
      </div>` : ''}`;
}

// ---------- Screens: profile & record ----------

function profileScreen() {
  const extra = navItems().filter(n => !PHONE_TABS[state.mode].includes(n.id) && n.id !== 'profile');
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

    <div class="card">
      <div class="stack">
        <span class="bold small">Am I working, or hiring?</span>
        <span class="tiny muted">Switch any time — it's the same account, the same wallet
          and the same Work Record.</span>
      </div>
      <div class="modeswitch" data-mode="${state.mode}" style="margin-top:11px">
        <div class="knob"></div>
        <button aria-pressed="${state.mode === 'work'}" onclick="setMode('work')">I'm looking for work</button>
        <button aria-pressed="${state.mode === 'hire'}" onclick="setMode('hire')">I'm hiring</button>
      </div>
    </div>

    ${extra.length ? `
      <h2 class="section">More</h2>
      <div class="grid">
        ${extra.map(n => `
          <div class="card tap" onclick="go('${n.id}')">
            <div class="row"><span class="bold small">${esc(n.title)}</span>
              <span class="spacer"></span><span class="muted">›</span></div>
          </div>`).join('')}
      </div>` : ''}

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
        <span class="tiny muted">Use Nchito from any handset — browse all 39 services, apply,
          check your balance and cash out, with no app and no data.</span>
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
                onclick="state.shareOn = !state.shareOn; renderMain()">
          ${state.shareOn ? 'On' : 'Off'}
        </button>
      </div>
      ${state.shareOn ? `
        <div class="notice" style="margin-top:10px">
          <span class="tiny" style="font-family:ui-monospace,monospace">nchito.zm/w/k7mq2xrp</span>
        </div>` : ''}
    </div>

    <h2 class="section">Completed work</h2>
    <div class="grid">
    ${WORK_RECORD.map(w => `
      <div class="card" style="padding:12px 14px">
        <div class="row">
          <div class="stack" style="flex:1">
            <span class="bold small">${esc(w.title)}</span>
            <span class="tiny muted">${esc(w.when)} · ${esc(categoryLabel(w.cat))} · ★ ${w.rating.toFixed(1)}${w.onTime ? '' : ' · late'}</span>
          </div>
          <div class="stack" style="text-align:right">
            <span class="bold small">${KWACHA(w.pay)}</span>
            <span class="tiny green">✓</span>
          </div>
        </div>
      </div>`).join('')}
    </div>

    <div class="notice">
      <div class="tiny muted">
        Every entry was paid through Nchito escrow and is cryptographically signed. Neither
        Nchito nor you can change a record once it's issued — that's what makes it worth showing.
      </div>
    </div>`;
}

// ---------- Chats ----------

function chatsScreen() {
  return `<div class="grid">${state.chats.map(c => {
    const last = c.messages[c.messages.length - 1];
    const selected = state.detail && state.detail.type === 'chat' && state.detail.id === c.id;
    return `
      <div class="card tap ${selected ? 'selected' : ''}" onclick="open_('chat','${c.id}')">
        <div class="row">
          <div class="stack" style="flex:1">
            <span class="bold small">${esc(c.name)}</span>
            <span class="tiny copper ellip">${esc(c.gig)}</span>
            <span class="tiny muted ellip">${last.mine ? 'You: ' : ''}${esc(last.body)}</span>
          </div>
          <span class="tiny muted">${esc(last.time)}</span>
        </div>
      </div>`;
  }).join('')}</div>`;
}

function chatThread(id) {
  const c = state.chats.find(x => x.id === id);
  if (!c) return '<div class="empty">Conversation not found.</div>';
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
      <input class="field" id="msg" placeholder="Message…" autocomplete="off" aria-label="Message">
      <button class="chip" style="background:var(--green);color:#fff;border-color:var(--green);padding:11px 15px">Send</button>
    </form>
  `;
}

// ---------- Actions ----------

function pickGroup(id) {
  const changed = state.group !== id;
  state.group = changed ? id : null;
  if (!state.group || (state.category && CATEGORY_BY_ID[state.category].group !== state.group)) {
    // A service from the family we just left would filter the feed to nothing
    // with no visible cause.
    state.category = null;
  }
  renderMain();
}

function clearFilters() {
  state.group = null; state.category = null; state.query = '';
  renderMain();
}

function applyTo(id) {
  state.applied.add(id);
  state.proofs[id] = state.proofs[id] || {};
  renderMain();
  toast('Applied — you’ll be notified if you’re picked');
}

function capture(id, kind) {
  state.proofs[id] = state.proofs[id] || {};
  state.proofs[id][kind] = true;
  renderMain();
  toast(kind === 'before' ? 'Before photo saved' : 'After photo saved — payment can be released');
}

function takeAdvance(id, cap) {
  const fee = Math.max(Math.round(cap * 0.04 * 100) / 100, 5);
  state.advances[id] = { amount: cap, fee };
  state.ledger.unshift({ kind: 'Early Payment', amount: cap, note: 'Early payment on ' + gigById(id).title });
  renderMain();
  toast(`${KWACHA(cap)} paid to your wallet now`);
}

function doTask(id) {
  const t = TASKS.find(x => x.id === id);
  state.done.add(id);
  state.ledger.unshift({ kind: 'Task Reward', amount: t.reward, note: t.title });
  renderMain();
  toast(`+${KWACHA(t.reward)} added to your wallet 🎉`);
}

function cashOut() {
  const amount = Math.min(200, balance());
  if (amount <= 0) return toast('No balance to cash out yet');
  state.ledger.unshift({ kind: 'Cash Out', amount: -amount, note: 'Cash out to MTN MoMo' });
  renderMain();
  toast(`${KWACHA(amount)} sent to your mobile money`);
}

function hire(postId, index) {
  const p = postById(postId);
  const a = p.applicants[index];
  p.worker = { name: a.name, rating: a.rating, jobs: a.jobs, together: a.together };
  p.applicants = [];
  p.status = 'assigned';
  renderMain();
  toast(`${a.name} hired — ${KWACHA(p.pay)} is now held in escrow`);
}

function releasePay(postId) {
  const p = postById(postId);
  p.status = 'settled';
  state.ledger.unshift({ kind: 'Escrow Released', amount: -p.pay, note: `${p.title} — ${p.worker.name}` });
  renderMain();
  toast(`${KWACHA(p.pay)} released to ${p.worker.name}`);
}

function publishPost() {
  const d = POST_DRAFT;
  if (!d.title.trim()) return toast('Give the job a title first');
  if (!Number(d.pay)) return toast('Say what you will pay');
  state.posts.unshift({
    id: 'p' + (state.posts.length + 1) + Date.now().toString(36),
    title: d.title.trim(), category: d.category, pay: Number(d.pay),
    city: USER.city, area: d.area.trim() || USER.city,
    status: 'open', posted: 'Just now', due: d.urgent ? 'As soon as possible' : 'This week',
    applicants: [],
  });
  state.ledger.unshift({ kind: 'Escrow Held', amount: -Number(d.pay), note: d.title.trim() });
  d.title = ''; d.pay = ''; d.area = ''; d.urgent = false; d.boost = false;
  state.tab = 'myposts';
  render();
  toast('Posted — workers nearby are being notified');
}

function sendMsg(e, id) {
  e.preventDefault();
  const input = document.getElementById('msg');
  const body = input.value.trim();
  if (!body) return;
  const c = state.chats.find(x => x.id === id);
  const now = new Date();
  c.messages.push({ mine: true, body,
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` });
  renderMain();
  const box = document.getElementById('main');
  if (box) window.scrollTo(0, document.body.scrollHeight);
}

function reportAgent(i) {
  const a = state.agents[i];
  a.status = 'has_cash'; a.reports += 1; a.fresh = 'just now';
  renderMain();
  toast('Thanks — others will see this agent has cash');
}

function shareReferral() {
  const text = `Join me on Nchito 🇿🇲 — find gigs and quick tasks, get paid straight to mobile money. Use my code ${USER.referral} and we both earn K20!`;
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else { navigator.clipboard?.writeText(text); toast('Invite copied to clipboard'); }
}

function useAssistantFor(kind) {
  state.assistant = { kind, fields: {}, output: null };
  go('assistant');
}

function buildAssist() {
  const a = state.assistant;
  a.output = ASSIST[a.kind].build(a.fields);
  renderMain();
  toast('Drafted — read it through and change anything');
}

function copyOut() {
  const text = state.assistant.output || '';
  navigator.clipboard?.writeText(text)
    .then(() => toast('Copied — paste it wherever you need'))
    .catch(() => toast('Select the text and copy it'));
}

function shareOut() {
  const text = state.assistant.output || '';
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else { navigator.clipboard?.writeText(text); toast('Copied — paste it into WhatsApp'); }
}

// ---------- Render ----------

function detailTitle(d) {
  return ({ gig: 'Gig details', chat: 'Chat', agents: 'Find cash near you',
            record: 'Work Record', post: 'Job details' })[d.type] || '';
}

/* The screen behind a detail view. On a wide screen it stays on-screen beside
   the detail, which is why it is a function rather than something we discard. */
function tabBody() {
  switch (state.tab) {
    case 'gigs':      return gigsScreen();
    case 'tasks':     return tasksScreen();
    case 'chats':     return chatsScreen();
    case 'wallet':    return walletScreen();
    case 'dashboard': return dashboardScreen();
    case 'assistant': return assistantScreen();
    case 'profile':   return profileScreen();
    case 'post':      return postScreen();
    case 'myposts':   return myPostsScreen();
    default:          return gigsScreen();
  }
}

function detailBody(d) {
  switch (d.type) {
    case 'gig':    return gigDetail(d.id);
    case 'chat':   return chatThread(d.id);
    case 'agents': return agentsScreen();
    case 'record': return recordScreen();
    case 'post':   return postDetail(d.id);
    default:       return '';
  }
}

/* Whether the list stays visible beside the detail. Only lists benefit —
   opening a Work Record next to a gig feed would just be two things at once. */
const SPLITTABLE = { gig: 'gigs', chat: 'chats', post: 'myposts' };

function renderMain() {
  const d = state.detail;
  const main = document.getElementById('main');
  const split = d && isWide() && SPLITTABLE[d.type] === state.tab;

  main.innerHTML = split
    ? `<div class="split">
         <div class="split-list">${tabBody()}</div>
         <div class="split-detail">${detailBody(d)}</div>
       </div>`
    : (d ? detailBody(d) : tabBody());

  // Restart the entry animation: re-assigning the attribute is what makes the
  // browser replay it, since the node itself was not replaced.
  main.removeAttribute('data-anim');
  void main.offsetWidth;
  main.setAttribute('data-anim', state.anim);

  drawCharts(main);
}

/* A chart drawn for a 390px column is wrong in a 1240px one, so charts are the
   one thing that has to be redrawn when the window changes size. */
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const main = document.getElementById('main');
    if (main) drawCharts(main);
  }, 150);
});

function render() {
  const d = state.detail;
  const item = navItem(state.tab);
  const split = d && isWide() && SPLITTABLE[d.type] === state.tab;
  const title = d && !split ? detailTitle(d) : item.title;

  document.getElementById('bar').innerHTML = (d && !split)
    ? `<button class="back" onclick="back()">‹ Back</button><h1>${esc(title)}</h1>`
    : `<img class="logo" src="../brand/logo.svg" alt="Nchito">
       <h1>${esc(title)}</h1>
       <span class="spacer"></span>
       <span class="pill ${state.mode === 'hire' ? 'copper' : ''}">${state.mode === 'hire' ? 'Hiring' : 'Working'}</span>`;

  // Rail (desktop) — full navigation plus the mode switch.
  document.getElementById('rail').innerHTML = `
    <div class="brand"><img src="../brand/logo.svg" alt="Nchito"></div>
    <div class="modeswitch" data-mode="${state.mode}">
      <div class="knob"></div>
      <button aria-pressed="${state.mode === 'work'}" onclick="setMode('work')">Work</button>
      <button aria-pressed="${state.mode === 'hire'}" onclick="setMode('hire')">Hire</button>
    </div>
    <div class="nav">
      ${navItems().map(n => `
        <button onclick="go('${n.id}')" ${state.tab === n.id ? 'aria-current="page"' : ''}>
          ${icon(n.icon)}<span>${esc(n.label)}</span>
        </button>`).join('')}
    </div>
    <div class="railfoot">
      <div class="card" style="margin:0;padding:11px">
        <div class="stack">
          <span class="bold tiny">${esc(USER.name)}</span>
          <span class="tiny muted">${esc(USER.city)} · ★ ${USER.rating.toFixed(1)}</span>
        </div>
      </div>
    </div>`;

  // Tab bar (phone) — five destinations, the rest via Profile.
  const phone = PHONE_TABS[state.mode].map(id => navItem(id));
  document.getElementById('tabs').innerHTML = phone.map(n => `
    <button data-tab="${n.id}" onclick="go('${n.id}')"
            ${state.tab === n.id && !d ? 'aria-current="page"' : ''}>
      ${icon(n.icon)}<span>${esc(n.label)}</span>
    </button>`).join('') + `
    <button data-tab="profile" onclick="go('profile')"
            ${state.tab === 'profile' && !d ? 'aria-current="page"' : ''}>
      ${icon('profile')}<span>Profile</span>
    </button>`;

  renderMain();
}

/* Crossing the split threshold changes what belongs on screen, not just how it
   looks, so it is the one resize JavaScript has to care about. */
wideQuery.addEventListener('change', () => { state.anim = 'fade'; render(); });

render();

// Offline support. The app is built around intermittent Zambian connectivity,
// so it ought to survive losing signal itself.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
