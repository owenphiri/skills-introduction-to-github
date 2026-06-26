'use strict';
/* PrimeAxis Smart Poultry — landing page + dashboard app (vanilla JS, no build). */

const State = { token: localStorage.getItem('pa_token'), user: null };
const $ = s => document.querySelector(s);

/* ============================ API ============================ */
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(State.token ? { Authorization: 'Bearer ' + State.token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) { logout(); throw new Error('Session expired'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function money(n) { return 'ZMW ' + Number(n || 0).toLocaleString(); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function flash(msg) { let e = $('.flash'); if (!e) { e = document.createElement('div'); e.className = 'flash'; document.body.appendChild(e); } e.textContent = msg; e.classList.add('show'); setTimeout(() => e.classList.remove('show'), 2600); }

/* ============================ LANDING ============================ */
const MODULES = [
  ['🐔', 'Broiler Management', 'Daily weight, feed, mortality & market-ready tracking.'],
  ['🥚', 'Layer Management', 'Egg collection, broken eggs, HDEP & flock health.'],
  ['🌾', 'Feed Tracking', 'Stock balance, consumption & feed conversion ratio.'],
  ['💉', 'Vaccination Records', 'Schedules, reminders & administered history.'],
  ['📉', 'Mortality Monitoring', 'Daily losses, survival rate & early disease alerts.'],
  ['💰', 'Sales & Revenue', 'Bird & egg sales, customers and revenue per bird.'],
  ['🧾', 'Expense Management', 'Feed, medication, labour & utilities in one place.'],
  ['📊', 'Executive Dashboards', 'Growth, profitability & productivity at a glance.']
];
const SLIDES = [
  { ic: '🐔', title: 'Broiler Performance System', sub: 'Grow Faster, Sell Smarter', points: ['Daily weight gain & ADG', 'Feed usage & FCR', 'Mortality rate', 'Market-ready birds', 'Sales performance'], metrics: [['1.38', 'Feed Conversion Ratio'], ['70 g', 'Avg daily gain'], ['92.7%', 'Survival rate']] },
  { ic: '🥚', title: 'Layer Farm Management', sub: 'Increase Egg Production, Reduce Losses', points: ['Daily egg collection', 'Broken eggs & egg sales', 'Feed consumption', 'Vaccination schedules', 'Layer performance trends'], metrics: [['84%', 'Hen-day production'], ['658', 'Eggs / day'], ['2%', 'Breakage rate']] },
  { ic: '💵', title: 'Financial Dashboard', sub: 'Track Every Kwacha', points: ['Gross & net profit', 'Cash flow', 'Expense breakdown', 'Profit margins', 'Revenue & profit per bird'], metrics: [['ZMW 75k', 'Revenue (30d)'], ['11.1%', 'Net margin'], ['ZMW 43.9', 'Revenue / bird']] },
  { ic: '🤖', title: 'AI Prediction Engine', sub: 'Smart Predictions, Better Decisions', points: ['Predict feed requirements', 'Forecast egg production', 'Forecast revenue & profit', 'Detect disease anomalies', 'Smart recommendations'], metrics: [['7-day', 'Feed forecast'], ['Early', 'Disease alerts'], ['30-day', 'Revenue forecast']] }
];
const AI_FEATURES = ['Predict disease outbreaks', 'Predict feed requirements', 'Predict egg production', 'Predict revenue & profit', 'Detect performance anomalies', 'Smart recommendations'];

function buildLanding() {
  $('#featureGrid').innerHTML = MODULES.map(([ic, t, d]) =>
    `<div class="feature-card reveal"><div class="ic">${ic}</div><h3>${t}</h3><p>${d}</p></div>`).join('');
  $('#aiList').innerHTML = AI_FEATURES.map(x => `<li>${x}</li>`).join('');
  $('#slides').innerHTML = SLIDES.map(s => `
    <div class="slide">
      <div class="slide-copy"><div class="ic">${s.ic}</div><h3>${s.title}</h3>
        <p class="muted">${s.sub}</p><ul>${s.points.map(p => `<li>${p}</li>`).join('')}</ul></div>
      <div class="slide-visual">${s.metrics.map(m => `<div class="slide-metric"><b>${m[0]}</b><span>${m[1]}</span></div>`).join('')}</div>
    </div>`).join('');
  $('#slideDots').innerHTML = SLIDES.map((_, i) => `<span class="dot${i === 0 ? ' on' : ''}" data-action="slide" data-i="${i}"></span>`).join('');
  loadPricing();
  initReveal();
  initSlider();
}

async function loadPricing() {
  try {
    const pkgs = await api('/packages');
    $('#priceGrid').innerHTML = pkgs.map(p => `
      <div class="price-card reveal${p.key === 'gold' ? ' featured' : ''}">
        ${p.key === 'gold' ? '<div class="ribbon">POPULAR</div>' : ''}
        <div class="tier">${p.label}</div>
        <div class="tagline">${p.tagline}</div>
        <div class="amt">ZMW ${p.price.toLocaleString()}${p.key === 'platinum' ? '+' : ''}</div>
        <div class="muted" style="font-size:.8rem">${p.users === 'Unlimited' ? 'Unlimited users' : 'Up to ' + p.users + ' user' + (p.users > 1 ? 's' : '')}</div>
        <ul>${p.features.slice(0, 8).map(f => `<li>${f.replace(/_/g, ' ')}</li>`).join('')}</ul>
        <button class="btn-primary" style="width:100%" data-action="open-login">Choose ${p.label}</button>
      </div>`).join('');
    initReveal();
  } catch (e) { /* offline */ }
}

let slideIdx = 0, slideTimer = null;
function initSlider() {
  const go = i => {
    slideIdx = (i + SLIDES.length) % SLIDES.length;
    $('#slides').style.transform = `translateX(-${slideIdx * 100}%)`;
    document.querySelectorAll('.dot').forEach((d, j) => d.classList.toggle('on', j === slideIdx));
  };
  window._goSlide = go;
  clearInterval(slideTimer);
  slideTimer = setInterval(() => go(slideIdx + 1), 4500);
}
function initReveal() {
  const obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } }), { threshold: .15 });
  document.querySelectorAll('.reveal:not(.in)').forEach(el => obs.observe(el));
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = +el.dataset.count; let n = 0; const step = Math.ceil(target / 40);
    const t = setInterval(() => { n += step; if (n >= target) { n = target; clearInterval(t); } el.textContent = n.toLocaleString(); }, 30);
  });
}

/* ============================ AUTH ============================ */
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); $('#loginError').textContent = '';
  try {
    const d = await api('/auth/login', { method: 'POST', body: { username: $('#username').value, password: $('#password').value } });
    State.token = d.token; State.user = d.user; localStorage.setItem('pa_token', d.token);
    enterApp();
  } catch (err) { $('#loginError').textContent = err.message; }
});
function logout() {
  api('/auth/logout', { method: 'POST' }).catch(() => {});
  State.token = null; State.user = null; localStorage.removeItem('pa_token');
  $('#app').classList.add('hidden'); $('#site').classList.remove('hidden');
}

/* ============================ APP NAV ============================ */
const NAV = ['dashboard', 'flocks', 'feed', 'vaccinations', 'sales', 'expenses', 'employees', 'financial', 'executive', 'ai'];
const NAV_LABEL = { dashboard: 'Dashboard', flocks: 'Flocks', feed: 'Feed', vaccinations: 'Vaccinations', sales: 'Sales', expenses: 'Expenses', employees: 'Employees', financial: 'Financials', executive: 'Executive', ai: 'AI Predictions' };
const NAV_FEATURE = { feed: 'feed_tracking', vaccinations: 'vaccination', sales: 'sales', expenses: 'expense_tracking', employees: 'employees', financial: 'financial_reports', executive: 'executive_dashboard', ai: 'ai_predictions' };
const hasFeature = f => !f || (State.user.features || []).includes(f);
const VIEWS = {};

function buildNav() {
  const tabs = NAV.filter(t => hasFeature(NAV_FEATURE[t]));
  $('#nav').innerHTML = tabs.map(t => `<a data-action="nav" data-tab="${t}">${NAV_LABEL[t]}</a>`).join('');
}
async function enterApp() {
  if (!State.user) { State.user = (await api('/auth/me')).user; }
  $('#site').classList.add('hidden'); $('#loginOverlay').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#userLabel').innerHTML = `${esc(State.user.full_name)} · ${esc(State.user.farm || '')} <span class="badge gray">${State.user.package}</span>`;
  buildNav();
  go('dashboard');
}
function go(tab) {
  $('#nav').querySelectorAll('a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  (VIEWS[tab] || VIEWS.dashboard)();
}
function setView(h) { $('#view').innerHTML = h; }
const stat = (cls, n, l) => `<div class="card stat ${cls}"><div class="n">${n}</div><div class="l">${l}</div></div>`;
function table(headers, rows) { return rows.length ? `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p class="muted">No records yet.</p>'; }

/* ---------------- Operations dashboard ---------------- */
VIEWS.dashboard = async function () {
  setView('<h2>Farm Dashboard</h2><p class="sub">Loading…</p>');
  const d = await api('/dashboard/operations');
  setView(`
    <h2>Farm Dashboard</h2>
    <p class="sub">${esc(State.user.farm)} · live operations overview</p>
    <div class="grid">
      ${stat('violet', d.totalBirds.toLocaleString(), 'Total birds')}
      ${stat('', d.activeFlocks, 'Active flocks')}
      ${stat(d.avgMortalityRate > 8 ? 'red' : 'green', d.avgMortalityRate + '%', 'Avg mortality')}
      ${stat('gold', d.eggsToday.toLocaleString(), 'Eggs today')}
    </div>
    <h3 class="section-title">Flock performance</h3>
    <div class="grid">${d.flockKpis.map(flockCard).join('')}</div>
    ${d.upcomingVax.length ? `<h3 class="section-title">💉 Upcoming vaccinations</h3>
      ${table(['Date', 'Flock', 'Vaccine'], d.upcomingVax.map(v => [v.scheduled_date, esc(v.flock_name), esc(v.vaccine)]))}` : ''}
  `);
};
function flockCard(k) {
  const metrics = k.type === 'broiler'
    ? `FCR <b>${k.fcr ?? '—'}</b> · ADG <b>${k.adg ?? '—'}g</b> · Wt <b>${k.avgWeightG ?? '—'}g</b>${k.marketReady ? ' <span class="badge green">market ready</span>' : ''}`
    : `HDEP <b>${k.henDayProduction}%</b> · Eggs/day <b>${k.eggsPerDay}</b> · Broken <b>${k.brokenRate}%</b>`;
  return `<div class="card">
    <div style="display:flex;justify-content:space-between"><b>${esc(k.name)}</b><span class="badge ${k.type === 'broiler' ? 'amber' : 'violet'}">${k.type}</span></div>
    <p class="muted" style="margin:6px 0">${esc(k.breed || '')} · ${k.ageDays}d · ${k.currentCount}/${k.initialCount} birds</p>
    <div class="bar"><span style="width:${k.survivalRate}%"></span></div>
    <p class="muted" style="font-size:.82rem;margin:6px 0 8px">Survival ${k.survivalRate}%</p>
    <p style="font-size:.86rem;margin:0">${metrics}</p>
    <button class="appbtn sm" data-action="flock" data-id="${k.id}" style="margin-top:10px">Open flock</button>
  </div>`;
}

/* ---------------- Flocks ---------------- */
VIEWS.flocks = async function () {
  const flocks = await api('/flocks');
  setView(`
    <h2>Flocks</h2><p class="sub">Broiler batches & layer flocks.</p>
    <div class="toolbar">
      <input id="fName" placeholder="Flock name" />
      <select id="fType"><option value="broiler">Broiler</option><option value="layer">Layer</option></select>
      <input id="fBreed" placeholder="Breed" />
      <input id="fCount" type="number" placeholder="Birds placed" />
      <input id="fDate" type="date" />
      <button class="appbtn sm" data-action="flock-add">+ Add flock</button>
    </div>
    <div class="grid">${flocks.map(f => flockCard(f.kpis)).join('')}</div>
  `);
};
window.addFlock = async function () {
  try {
    await api('/flocks', { method: 'POST', body: { name: $('#fName').value, type: $('#fType').value, breed: $('#fBreed').value, initial_count: Number($('#fCount').value), start_date: $('#fDate').value || new Date().toISOString().slice(0, 10) } });
    flash('Flock added.'); VIEWS.flocks();
  } catch (e) { flash(e.message); }
};
window.openFlock = async function (id) {
  const d = await api('/flocks/' + id); const k = d.kpis; const f = d.flock;
  const isB = f.type === 'broiler';
  setView(`
    <p><a data-action="nav" data-tab="flocks" style="color:var(--violet);cursor:pointer">← Flocks</a></p>
    <h2>${esc(f.name)} <span class="badge ${isB ? 'amber' : 'violet'}">${f.type}</span></h2>
    <p class="sub">${esc(f.breed || '')} · ${esc(f.house || '')} · started ${f.start_date}</p>
    <div class="grid">
      ${stat('violet', k.currentCount, 'Current birds')}
      ${stat(k.mortalityRate > 8 ? 'red' : 'green', k.survivalRate + '%', 'Survival rate')}
      ${stat('', k.feedKg + 'kg', 'Feed consumed')}
      ${isB ? stat('gold', (k.fcr ?? '—'), 'FCR') : stat('gold', k.henDayProduction + '%', 'Hen-day prod.')}
    </div>
    <div class="row" style="margin-top:18px">
      <div class="col card">
        <h3>Log today's record</h3>
        <div class="toolbar">
          <input id="lMort" type="number" placeholder="Mortality" style="width:110px" />
          <input id="lFeed" type="number" step="0.1" placeholder="Feed kg" style="width:110px" />
          ${isB ? '<input id="lWeight" type="number" placeholder="Avg weight g" style="width:130px" />'
                : '<input id="lEggs" type="number" placeholder="Eggs" style="width:110px" /><input id="lBroken" type="number" placeholder="Broken" style="width:110px" />'}
          <button class="appbtn sm" data-action="log-add" data-id="${id}">Save</button>
        </div>
      </div>
    </div>
    <h3 class="section-title">Recent daily records</h3>
    ${table(isB ? ['Date', 'Mortality', 'Feed kg', 'Avg weight g'] : ['Date', 'Mortality', 'Feed kg', 'Eggs', 'Broken'],
      d.logs.map(l => isB ? [l.date, l.mortality, l.feed_kg, l.avg_weight_g ?? '—'] : [l.date, l.mortality, l.feed_kg, l.eggs_collected ?? '—', l.eggs_broken ?? '—']))}
  `);
};
window.addLog = async function (id) {
  const isB = !!$('#lWeight');
  const body = { mortality: Number($('#lMort').value || 0), feed_kg: Number($('#lFeed').value || 0) };
  if (isB) body.avg_weight_g = $('#lWeight').value ? Number($('#lWeight').value) : null;
  else { body.eggs_collected = $('#lEggs').value ? Number($('#lEggs').value) : null; body.eggs_broken = $('#lBroken').value ? Number($('#lBroken').value) : null; }
  await api(`/flocks/${id}/logs`, { method: 'POST', body }); flash('Record saved.'); openFlock(id);
};

/* ---------------- Feed ---------------- */
VIEWS.feed = async function () {
  const d = await api('/feed');
  setView(`
    <h2>Feed Tracking</h2><p class="sub">Stock balance & consumption.</p>
    <div class="grid">
      ${stat('violet', d.stockKg + 'kg', 'Feed in stock')}
      ${stat('', d.purchasedKg + 'kg', 'Total purchased')}
      ${stat('gold', d.consumedKg + 'kg', 'Total consumed')}
    </div>
    <div class="toolbar" style="margin-top:18px">
      <input id="ftType" placeholder="Feed type (e.g. Grower)" />
      <input id="ftQty" type="number" placeholder="kg" style="width:100px" />
      <input id="ftCost" type="number" step="0.1" placeholder="Unit cost" style="width:120px" />
      <button class="appbtn sm" data-action="feed-add">+ Add purchase</button>
    </div>
    <h3 class="section-title">Purchases</h3>
    ${table(['Date', 'Type', 'Qty kg', 'Unit cost', 'Total'], d.purchases.map(p => [p.purchased_at, esc(p.feed_type), p.quantity_kg, money(p.unit_cost), money(p.quantity_kg * p.unit_cost)]))}
  `);
};
window.addFeed = async function () { await api('/feed', { method: 'POST', body: { feed_type: $('#ftType').value, quantity_kg: Number($('#ftQty').value), unit_cost: Number($('#ftCost').value || 0) } }); flash('Feed added.'); VIEWS.feed(); };

/* ---------------- Vaccinations ---------------- */
VIEWS.vaccinations = async function () {
  const list = await api('/vaccinations');
  setView(`
    <h2>Vaccinations</h2><p class="sub">Schedules & administered records.</p>
    ${table(['Scheduled', 'Flock', 'Vaccine', 'Status', 'Action'], list.map(v => [
      v.scheduled_date, esc(v.flock_name), esc(v.vaccine),
      `<span class="badge ${v.status === 'done' ? 'green' : v.status === 'missed' ? 'red' : 'amber'}">${v.status}</span>`,
      v.status === 'scheduled' ? `<button class="appbtn sm" data-action="vax-done" data-id="${v.id}">Mark done</button>` : '—'
    ]))}
  `);
};
window.vaxDone = async function (id) { await api('/vaccinations/' + id, { method: 'PUT', body: { status: 'done' } }); flash('Marked done.'); VIEWS.vaccinations(); };

/* ---------------- Sales ---------------- */
VIEWS.sales = async function () {
  const list = await api('/sales');
  setView(`
    <h2>Sales & Revenue</h2><p class="sub">Bird & egg sales.</p>
    <div class="toolbar">
      <select id="sCat"><option value="eggs">Eggs</option><option value="birds">Birds</option><option value="manure">Manure</option><option value="other">Other</option></select>
      <input id="sQty" type="number" placeholder="Qty" style="width:90px" />
      <input id="sPrice" type="number" step="0.01" placeholder="Unit price" style="width:120px" />
      <input id="sCust" placeholder="Customer" />
      <button class="appbtn sm" data-action="sale-add">+ Record sale</button>
    </div>
    ${table(['Date', 'Category', 'Qty', 'Unit price', 'Amount', 'Customer'], list.map(s => [s.date, s.category, s.quantity, money(s.unit_price), money(s.amount), esc(s.customer || '—')]))}
  `);
};
window.addSale = async function () { await api('/sales', { method: 'POST', body: { category: $('#sCat').value, quantity: Number($('#sQty').value), unit_price: Number($('#sPrice').value || 0), customer: $('#sCust').value } }); flash('Sale recorded.'); VIEWS.sales(); };

/* ---------------- Expenses ---------------- */
VIEWS.expenses = async function () {
  const list = await api('/expenses');
  setView(`
    <h2>Expense Management</h2><p class="sub">Track every cost.</p>
    <div class="toolbar">
      <select id="eCat"><option>feed</option><option>medication</option><option>labour</option><option>utilities</option><option>equipment</option><option>transport</option><option>other</option></select>
      <input id="eAmt" type="number" step="0.01" placeholder="Amount" style="width:120px" />
      <input id="eNote" placeholder="Note" />
      <button class="appbtn sm" data-action="expense-add">+ Add expense</button>
    </div>
    ${table(['Date', 'Category', 'Amount', 'Note'], list.map(e => [e.date, e.category, money(e.amount), esc(e.note || '—')]))}
  `);
};
window.addExpense = async function () { await api('/expenses', { method: 'POST', body: { category: $('#eCat').value, amount: Number($('#eAmt').value), note: $('#eNote').value } }); flash('Expense added.'); VIEWS.expenses(); };

/* ---------------- Employees ---------------- */
VIEWS.employees = async function () {
  const list = await api('/employees');
  setView(`
    <h2>Employees</h2><p class="sub">Farm staff & payroll.</p>
    <div class="toolbar">
      <input id="emName" placeholder="Full name" />
      <input id="emRole" placeholder="Role" />
      <input id="emPhone" placeholder="Phone" />
      <input id="emSalary" type="number" placeholder="Salary" style="width:110px" />
      <button class="appbtn sm" data-action="emp-add">+ Add</button>
    </div>
    ${table(['Name', 'Role', 'Phone', 'Salary'], list.map(e => [esc(e.full_name), esc(e.role || '—'), esc(e.phone || '—'), money(e.salary)]))}
  `);
};
window.addEmp = async function () { await api('/employees', { method: 'POST', body: { full_name: $('#emName').value, role: $('#emRole').value, phone: $('#emPhone').value, salary: Number($('#emSalary').value || 0) } }); flash('Employee added.'); VIEWS.employees(); };

/* ---------------- Financial ---------------- */
VIEWS.financial = async function () {
  const d = await api('/dashboard/financial');
  setView(`
    <h2>Financial Dashboard</h2><p class="sub">Last ${d.days} days.</p>
    <div class="grid">
      ${stat('green', money(d.revenue), 'Revenue')}
      ${stat('red', money(d.totalExpenses), 'Expenses')}
      ${stat(d.netProfit >= 0 ? 'green' : 'red', money(d.netProfit), 'Net profit')}
      ${stat('gold', d.netMargin + '%', 'Net margin')}
      ${stat('violet', money(d.revenuePerBird), 'Revenue / bird')}
      ${stat('violet', money(d.profitPerBird), 'Profit / bird')}
    </div>
    <h3 class="section-title">Revenue vs expenses (14 days)</h3>
    <div class="card">${cashflowChart(d.cashflow)}</div>
    <h3 class="section-title">Expense breakdown</h3>
    ${table(['Category', 'Amount'], Object.entries(d.expensesByCategory).map(([c, v]) => [c, money(v)]).concat([['feed (purchases)', money(d.feedPurchases)]]))}
  `);
};
function cashflowChart(data) {
  if (!data.length) return '<p class="muted">No data.</p>';
  const W = 640, H = 170, pad = 24, bw = (W - pad * 2) / data.length;
  const max = Math.max(1, ...data.map(d => Math.max(d.revenue, d.expense)));
  const bars = data.map((d, i) => {
    const x = pad + i * bw;
    const rh = (d.revenue / max) * (H - pad * 2), eh = (d.expense / max) * (H - pad * 2);
    return `<rect x="${x + 3}" y="${H - pad - rh}" width="${bw / 2 - 3}" height="${rh}" fill="var(--green)" rx="2"><title>${d.date} revenue ${money(d.revenue)}</title></rect>
      <rect x="${x + bw / 2 + 1}" y="${H - pad - eh}" width="${bw / 2 - 3}" height="${eh}" fill="var(--red)" rx="2"><title>${d.date} expense ${money(d.expense)}</title></rect>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%"><line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="#e9e7f2"/>${bars}</svg>
    <p class="muted" style="font-size:.8rem"><span style="color:var(--green)">■</span> Revenue &nbsp; <span style="color:var(--red)">■</span> Expense</p>`;
}

/* ---------------- Executive ---------------- */
VIEWS.executive = async function () {
  const d = await api('/dashboard/executive');
  setView(`
    <h2>Executive Dashboard</h2><p class="sub">Strategic performance & trends.</p>
    <div class="grid">
      ${stat('green', money(d.revenue30d), 'Revenue (30d)')}
      ${stat(d.netProfit30d >= 0 ? 'green' : 'red', money(d.netProfit30d), 'Net profit (30d)')}
      ${stat('gold', (d.revenueGrowthRate ?? '—') + '%', 'Revenue growth')}
      ${stat('violet', d.avgFcr ?? '—', 'Avg broiler FCR')}
      ${stat('violet', (d.avgHenDayProduction ?? '—') + '%', 'Avg hen-day prod.')}
      ${stat('green', (d.survivalRate ?? '—') + '%', 'Survival rate')}
      ${stat('gold', money(d.profitPerBird), 'Profit / bird')}
    </div>
  `);
};

/* ---------------- AI Predictions ---------------- */
VIEWS.ai = async function () {
  const d = await api('/predictions');
  setView(`
    <h2>🤖 AI Prediction Engine</h2><p class="sub">Explainable, trend-based forecasts & early-warning alerts.</p>
    <div class="grid">
      ${stat('violet', d.feedRequirement7dKg + 'kg', 'Feed needed (7d)')}
      ${stat('gold', d.eggForecast7d.toLocaleString(), 'Egg forecast (7d)')}
      ${stat('green', money(d.revenueForecast30d), 'Revenue forecast (30d)')}
    </div>
    <h3 class="section-title">Alerts & recommendations</h3>
    <div class="grid">${d.alerts.map(a => `
      <div class="card" style="border-left:4px solid ${a.level === 'high' ? 'var(--red)' : a.level === 'medium' ? 'var(--amber)' : 'var(--green)'}">
        <span class="badge ${a.level === 'high' ? 'red' : a.level === 'medium' ? 'amber' : 'green'}">${a.level}</span>
        <p style="margin:8px 0 0">${esc(a.message)}</p>
      </div>`).join('')}</div>
  `);
};

/* ============================ DELEGATION ============================ */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const { action, id, tab, i } = el.dataset;
  const map = {
    'open-login': () => { $('#loginOverlay').classList.remove('hidden'); },
    'close-login': () => { $('#loginOverlay').classList.add('hidden'); },
    'logout': logout,
    'nav': () => go(tab),
    'flock': () => openFlock(Number(id)),
    'flock-add': addFlock,
    'log-add': () => addLog(Number(id)),
    'feed-add': addFeed,
    'vax-done': () => vaxDone(Number(id)),
    'sale-add': addSale,
    'expense-add': addExpense,
    'emp-add': addEmp,
    'slide': () => window._goSlide(Number(i))
  };
  if (map[action]) { e.preventDefault(); map[action](); }
});

/* ============================ BOOT ============================ */
buildLanding();
if (State.token) enterApp().catch(() => logout());
