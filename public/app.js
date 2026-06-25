'use strict';
/* SafeGirl EduTrack — single-page dashboard (vanilla JS, no build step). */

const State = { token: localStorage.getItem('sg_token'), user: null };

/* ---------------------------------------------------------------- API ---- */
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(State.token ? { Authorization: 'Bearer ' + State.token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) { logout(); throw new Error('Session expired'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* -------------------------------------------------------------- AUTH ----- */
const $ = sel => document.querySelector(sel);

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#loginError').textContent = '';
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { username: $('#username').value, password: $('#password').value }
    });
    State.token = data.token; State.user = data.user;
    localStorage.setItem('sg_token', data.token);
    enterApp();
  } catch (err) { $('#loginError').textContent = err.message; }
});

$('#logoutBtn').addEventListener('click', logout);
function logout() {
  api('/auth/logout', { method: 'POST' }).catch(() => {});
  State.token = null; localStorage.removeItem('sg_token');
  $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
}

/* -------------------------------------------------------------- NAV ------ */
const ROLE_NAV = {
  admin:     ['dashboard', 'students', 'risk', 'map', 'attendance', 'counseling', 'awareness', 'messages', 'reports', 'audit'],
  teacher:   ['dashboard', 'students', 'attendance', 'risk', 'counseling'],
  counselor: ['dashboard', 'risk', 'map', 'counseling', 'students', 'awareness'],
  district:  ['dashboard', 'risk', 'map', 'awareness', 'messages', 'reports'],
  community: ['dashboard', 'awareness', 'messages'],
  parent:    ['dashboard', 'awareness']
};
const VIEWS = {};

function buildNav() {
  const tabs = ROLE_NAV[State.user.role] || ['dashboard'];
  $('#nav').innerHTML = tabs.map(t =>
    `<a href="#${t}" data-tab="${t}">${cap(t)}</a>`).join('');
  $('#nav').querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => setTimeout(route, 0)));
}

function route() {
  const tab = (location.hash.slice(1) || 'dashboard');
  $('#nav').querySelectorAll('a').forEach(a =>
    a.classList.toggle('active', a.dataset.tab === tab));
  const view = VIEWS[tab] || VIEWS.dashboard;
  view();
}
window.addEventListener('hashchange', route);

async function enterApp() {
  if (!State.user) { const me = await api('/auth/me'); State.user = me.user; }
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#userLabel').textContent = `${State.user.full_name} · ${cap(State.user.role)}`;
  buildNav();
  if (!location.hash) location.hash = 'dashboard';
  route();
}

/* ------------------------------------------------------------- VIEWS ----- */
VIEWS.dashboard = async function () {
  setView('<h2>Dashboard</h2><p class="sub">Loading…</p>');
  const s = await api('/analytics/summary');
  setView(`
    <h2>National Early-Warning Dashboard</h2>
    <p class="sub">Real-time welfare &amp; attendance overview · Keeping Girls in School</p>
    <div class="grid">
      ${stat('green', s.totalStudents, 'Active learners')}
      ${stat('green', s.girls, 'Girls enrolled')}
      ${stat(s.attendanceRateToday >= 85 ? 'green' : 'amber', s.attendanceRateToday != null ? s.attendanceRateToday + '%' : '—', 'Attendance today')}
      ${stat('red', s.risk.high, 'High-risk learners')}
      ${stat('amber', s.risk.medium, 'Medium-risk learners')}
      ${stat('green', s.interventions, 'Interventions logged')}
      ${stat('green', s.resolvedInterventions, 'Cases resolved')}
      ${stat('green', s.messagesSent, 'Messages to parents')}
    </div>
    <h3 class="section-title">Attendance trend (last 14 days)</h3>
    <div class="card" id="trendCard">Loading…</div>
    <h3 class="section-title">Priority: learners needing intervention</h3>
    <div id="riskMini"></div>
  `);
  const trend = await api('/analytics/attendance-trend?days=14');
  $('#trendCard').innerHTML = barChart(trend);
  renderRiskTable('#riskMini', await api('/risk?minLevel=high'), true);
};

/* Dependency-free SVG bar chart of daily attendance rate. */
function barChart(points) {
  const data = points.filter(p => p.rate != null);
  if (!data.length) return '<p class="muted">No attendance recorded yet.</p>';
  const W = 640, H = 160, pad = 24, bw = (W - pad * 2) / data.length;
  const bars = data.map((p, i) => {
    const h = (p.rate / 100) * (H - pad * 2);
    const x = pad + i * bw, y = H - pad - h;
    const color = p.rate >= 85 ? 'var(--green)' : p.rate >= 70 ? 'var(--amber)' : 'var(--red)';
    return `<rect x="${x + 2}" y="${y}" width="${bw - 4}" height="${h}" rx="3" fill="${color}">
      <title>${p.date}: ${p.rate}%</title></rect>
      <text x="${x + bw / 2}" y="${H - 8}" font-size="9" text-anchor="middle" fill="#6b7a87">${p.date.slice(5)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Attendance trend">
    <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="#e3e9e7"/>
    <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${H - pad}" stroke="#e3e9e7"/>
    ${bars}</svg>`;
}

VIEWS.map = async function () {
  setView('<h2>GIS — Vulnerable Learner Map</h2><p class="sub">Geo-located by village, coloured by risk level.</p><div class="card" id="mapCard">Loading…</div>');
  const pts = await api('/analytics/gis');
  $('#mapCard').innerHTML = scatterMap(pts);
};

/* Lightweight SVG scatter "map" (no external tiles — works fully offline). */
function scatterMap(pts) {
  if (!pts.length) return '<p class="muted">No geo-located learners yet.</p>';
  const lats = pts.map(p => p.gps_lat), lngs = pts.map(p => p.gps_lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const W = 640, H = 380, pad = 30;
  const sx = v => pad + ((v - minLng) / ((maxLng - minLng) || 1)) * (W - pad * 2);
  const sy = v => H - pad - ((v - minLat) / ((maxLat - minLat) || 1)) * (H - pad * 2);
  const color = l => l === 'high' ? 'var(--red)' : l === 'medium' ? 'var(--amber)' : 'var(--green)';
  const dots = pts.map(p => `
    <circle cx="${sx(p.gps_lng).toFixed(1)}" cy="${sy(p.gps_lat).toFixed(1)}" r="${p.level==='high'?9:6}"
      fill="${color(p.level)}" fill-opacity="0.75" stroke="#fff" stroke-width="1"
      style="cursor:pointer" onclick="openStudent(${p.studentId})">
      <title>${esc(p.student.full_name)} — ${p.level} (${p.score}) · ${esc(p.student.village||'')}</title>
    </circle>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="background:#eef5f0;border-radius:8px">${dots}</svg>
    <p class="pill" style="margin-top:8px">
      <span class="badge high">High</span> <span class="badge medium">Medium</span> <span class="badge low">Low</span>
      · click a learner to open their profile</p>`;
}

VIEWS.reports = async function () {
  setView(`
    <h2>Reports &amp; Exports</h2>
    <p class="sub">Download CSV returns for District Education Office &amp; M&amp;E.</p>
    <div class="grid">
      <div class="card">
        <h3>At-risk learners</h3>
        <p class="muted">All medium &amp; high-risk learners with scores and recommended actions.</p>
        <button class="sm" onclick="downloadReport('/reports/at-risk.csv','at-risk-learners.csv')">Download CSV</button>
      </div>
      <div class="card">
        <h3>Attendance summary (30 days)</h3>
        <p class="muted">Per-learner present/absent/late counts and attendance rate.</p>
        <button class="sm" onclick="downloadReport('/reports/attendance.csv?days=30','attendance-30d.csv')">Download CSV</button>
      </div>
    </div>
  `);
};

/* Authenticated file download (fetch with bearer token → blob). */
window.downloadReport = async function (path, filename) {
  const res = await fetch('/api' + path, { headers: { Authorization: 'Bearer ' + State.token } });
  if (!res.ok) { flash('Report failed: ' + res.status); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  flash('Report downloaded.');
};

VIEWS.students = async function () {
  setView(`
    <h2>Student Register</h2>
    <p class="sub">Confidential — safeguarding data. Access is logged.</p>
    <div class="toolbar">
      <input id="search" placeholder="Search by name…" />
      ${can('admin','teacher') ? '<button id="addBtn" class="sm">+ Register student</button>' : ''}
    </div>
    <div id="studentList"></div>
  `);
  const load = async q => {
    const list = await api('/students' + (q ? '?q=' + encodeURIComponent(q) : ''));
    $('#studentList').innerHTML = renderTable(
      ['Name', 'Grade', 'Sex', 'Village', 'Guardian phone', 'Status'],
      list.map(st => [
        `<a href="#student/${st.id}" onclick="openStudent(${st.id});return false;">${esc(st.full_name)}</a>`,
        st.grade, st.gender, esc(st.village || '—'), esc(st.parent_phone || '—'),
        st.vulnerability_status !== 'none'
          ? `<span class="badge medium">${st.vulnerability_status}</span>`
          : '<span class="pill">—</span>'
      ])
    );
  };
  $('#search').addEventListener('input', e => load(e.target.value));
  if ($('#addBtn')) $('#addBtn').addEventListener('click', addStudentForm);
  await load('');
};

window.openStudent = async function (id) {
  const d = await api('/students/' + id);
  const r = d.risk;
  const att = d.attendance.slice(0, 12).reverse();
  setView(`
    <p><a href="#students" onclick="VIEWS.students();return false;">&larr; Back to register</a></p>
    <h2>${esc(d.student.full_name)} <span class="badge ${r.level}">${r.level.toUpperCase()} RISK · ${r.score}</span></h2>
    <p class="sub">Grade ${d.student.grade} · ${d.student.gender === 'F' ? 'Female' : 'Male'} · ${esc(d.student.village || '')}</p>
    <div class="row">
      <div class="col card">
        <h3>Vulnerability assessment</h3>
        <div class="bar"><span style="width:${r.score}%;background:${r.level==='high'?'var(--red)':r.level==='medium'?'var(--amber)':'var(--green)'}"></span></div>
        <p class="muted" style="margin-top:8px">Attendance ${r.metrics.attendanceRate}% · ${r.metrics.consecutiveAbsences} consecutive absences · recent avg ${r.metrics.recentAverage ?? '—'}%</p>
        <h4>Contributing factors</h4>
        ${r.factors.length ? '<ul class="recs">' + r.factors.map(f =>
          `<li><b>${esc(f.label)}</b> (+${f.points}) <span class="muted">${esc(f.detail||'')}</span></li>`).join('') + '</ul>'
          : '<p class="muted">None — routine monitoring.</p>'}
        <h4>Recommended interventions</h4>
        <ul class="recs">${r.recommendations.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        ${can('admin','teacher','counselor') ? `<button class="sm" onclick="logCounseling(${id})">+ Log counseling / welfare action</button>` : ''}
      </div>
      <div class="col card">
        <h3>Recent attendance</h3>
        <p>${att.map(a => `<span title="${a.date}" class="badge ${a.status==='present'?'low':a.status==='late'?'medium':'high'}" style="margin:2px">${a.status[0].toUpperCase()}</span>`).join('')}</p>
        <h3>Performance</h3>
        ${renderTable(['Term','Subject','Score'], d.performance.map(p => [p.term, p.subject, p.score + '%']))}
      </div>
    </div>
    <h3 class="section-title">Counseling &amp; welfare history</h3>
    ${renderTable(['Date','Type','Status','Notes'], d.counseling.map(c =>
      [c.created_at.slice(0,10), c.type, `<span class="badge ${c.status==='resolved'?'low':'medium'}">${c.status}</span>`, esc(c.notes||'')]))}
  `);
};

VIEWS.risk = async function () {
  setView('<h2>AI Early-Warning Engine</h2><p class="sub">Girl Child Vulnerability Score · explainable model</p><div class="toolbar"><select id="lvl"><option value="medium">Medium &amp; above</option><option value="high">High only</option><option value="low">All learners</option></select></div><div id="riskList">Loading…</div>');
  const load = async () => renderRiskTable('#riskList', await api('/risk?minLevel=' + $('#lvl').value), false);
  $('#lvl').addEventListener('change', load);
  await load();
};

VIEWS.attendance = async function () {
  const students = await api('/students');
  const today = new Date().toISOString().slice(0, 10);
  setView(`
    <h2>Smart Attendance</h2>
    <p class="sub">Mark today's register — parents are notified automatically by SMS.</p>
    <div class="toolbar">
      <input id="attDate" type="date" value="${today}" />
      <label class="pill"><input type="checkbox" id="notify" checked style="width:auto"> Notify parents</label>
      <button id="saveAtt">Save register</button>
    </div>
    ${renderTable(['Learner','Grade','Status'], students.map(st => [
      esc(st.full_name), st.grade,
      `<select data-sid="${st.id}">
         <option value="present">Present</option>
         <option value="absent">Absent</option>
         <option value="late">Late</option>
       </select>`
    ]))}
  `);
  $('#saveAtt').addEventListener('click', async () => {
    const records = [...document.querySelectorAll('select[data-sid]')]
      .map(s => ({ student_id: Number(s.dataset.sid), status: s.value }));
    const r = await api('/attendance/bulk', {
      method: 'POST',
      body: { date: $('#attDate').value, records, notify: $('#notify').checked }
    });
    flash(`Register saved for ${r.count} learners — parents notified.`);
  });
};

VIEWS.counseling = async function () {
  const list = await api('/counseling');
  setView(`
    <h2>Counseling &amp; Welfare</h2>
    <p class="sub">Guidance sessions, home visits, parent meetings &amp; welfare cases.</p>
    ${renderTable(['Date','Learner','Grade','Type','Status','Notes'], list.map(c => [
      c.created_at.slice(0,10), esc(c.student_name), c.grade, c.type,
      `<span class="badge ${c.status==='resolved'?'low':c.status==='escalated'?'high':'medium'}">${c.status}</span>`,
      esc(c.notes||'')
    ]))}
  `);
};

VIEWS.awareness = async function () {
  const list = await api('/awareness');
  setView(`
    <h2>Community Awareness Centre</h2>
    <p class="sub">Multilingual education content — English, Bemba, Nyanja, Tonga, Lozi.</p>
    <div class="grid">${list.map(a => `
      <div class="card">
        <span class="badge gray">${a.language.toUpperCase()} · ${a.category.replace('_',' ')}</span>
        <h3 style="margin:8px 0 4px">${esc(a.title)}</h3>
        <p class="muted">${esc(a.body)}</p>
      </div>`).join('')}
    </div>
  `);
};

VIEWS.messages = async function () {
  const msgs = await api('/messages?limit=80');
  setView(`
    <h2>Messaging &amp; Broadcasts</h2>
    <p class="sub">SMS / WhatsApp outbox &amp; community awareness campaigns.</p>
    ${can('admin','counselor','district','community') ? `
    <div class="card" style="margin-bottom:18px">
      <h3>Send awareness broadcast</h3>
      <select id="bLang">
        <option value="en">English</option><option value="bem">Bemba</option>
        <option value="nya">Nyanja</option><option value="toi">Tonga</option><option value="loz">Lozi</option>
      </select>
      <textarea id="bBody" rows="2" placeholder="Educating a girl child increases family income and community development. Keep girls in school."></textarea>
      <button id="bSend" class="sm">Broadcast to all guardians</button>
    </div>` : ''}
    <h3 class="section-title">Outbox</h3>
    <div id="outbox">${renderTable(['Time','Category','To','Channel','Status','Message'], msgs.map(m => [
      m.created_at.slice(5,16), m.category, esc(m.recipient_phone), m.channel,
      `<span class="badge ${m.delivery_status==='sent'||m.delivery_status==='delivered'?'low':m.delivery_status==='failed'?'high':'gray'}">${m.delivery_status}</span>`,
      esc(m.body)
    ]))}</div>
  `);
  if ($('#bSend')) $('#bSend').addEventListener('click', async () => {
    const body = $('#bBody').value.trim();
    if (!body) return;
    const r = await api('/messages/broadcast', { method: 'POST', body: { body, language: $('#bLang').value } });
    flash(`Broadcast queued to ${r.sent} guardians.`);
    VIEWS.messages();
  });
};

VIEWS.audit = async function () {
  const list = await api('/audit');
  setView(`
    <h2>Audit Trail</h2>
    <p class="sub">Tamper-evident log of sensitive actions — safeguarding &amp; Data Protection Act compliance.</p>
    ${renderTable(['Time', 'User', 'Action', 'Entity', 'IP', 'Detail'], list.map(e => [
      e.created_at, esc(e.username || '—'),
      `<span class="badge ${e.action.includes('failed') ? 'high' : 'gray'}">${esc(e.action)}</span>`,
      esc(e.entity || '—'), esc(e.ip || '—'), esc(e.detail || '')
    ]))}
  `);
};

/* ----------------------------------------------------------- FORMS ------ */
async function addStudentForm() {
  setView(`
    <p><a href="#students" onclick="VIEWS.students();return false;">&larr; Back</a></p>
    <h2>Register student</h2>
    <div class="card" style="max-width:520px">
      <input id="f_name" placeholder="Full name *" />
      <div class="row">
        <input id="f_grade" placeholder="Grade * (e.g. 9A)" />
        <select id="f_gender"><option value="F">Female</option><option value="M">Male</option></select>
      </div>
      <input id="f_nrc" placeholder="NRC / Birth certificate no." />
      <input id="f_parent" placeholder="Guardian name" />
      <input id="f_phone" placeholder="Guardian phone (e.g. 0977…)" />
      <input id="f_village" placeholder="Village / area" />
      <select id="f_vuln">
        <option value="none">No special vulnerability</option>
        <option value="orphan">Orphan</option>
        <option value="low_income">Low income household</option>
        <option value="disability">Disability</option>
        <option value="other">Other</option>
      </select>
      <button id="f_save">Register</button>
    </div>
  `);
  $('#f_save').addEventListener('click', async () => {
    await api('/students', { method: 'POST', body: {
      full_name: $('#f_name').value, grade: $('#f_grade').value, gender: $('#f_gender').value,
      nrc: $('#f_nrc').value, parent_name: $('#f_parent').value, parent_phone: $('#f_phone').value,
      village: $('#f_village').value, vulnerability_status: $('#f_vuln').value
    }});
    flash('Student registered.'); VIEWS.students();
  });
}

window.logCounseling = async function (studentId) {
  const notes = prompt('Describe the counseling / welfare action:');
  if (!notes) return;
  await api('/counseling', { method: 'POST', body: { student_id: studentId, type: 'session', notes } });
  flash('Counseling action logged.'); openStudent(studentId);
};

/* ----------------------------------------------------------- HELPERS ---- */
function renderRiskTable(sel, list, mini) {
  if (!list.length) { $(sel).innerHTML = '<p class="muted">No learners in this band. 🎉</p>'; return; }
  $(sel).innerHTML = renderTable(
    ['Learner', 'Grade', 'Score', 'Level', mini ? 'Top factor' : 'Recommended action'],
    list.map(a => [
      `<a href="#" onclick="openStudent(${a.studentId});return false;">${esc(a.student.full_name)}</a>`,
      a.student.grade,
      `${a.score}`,
      `<span class="badge ${a.level}">${a.level.toUpperCase()}</span>`,
      esc(mini ? (a.factors[0]?.label || '—') : (a.recommendations[0] || '—'))
    ])
  );
}
function renderTable(headers, rows) {
  if (!rows.length) return '<p class="muted">No records.</p>';
  return `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function stat(cls, n, label) {
  return `<div class="card stat ${cls}"><div class="n">${n}</div><div class="l">${label}</div></div>`;
}
function setView(html) { $('#view').innerHTML = html; }
function can(...roles) { return roles.includes(State.user.role); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function flash(msg) {
  let el = document.querySelector('.flash');
  if (!el) { el = document.createElement('div'); el.className = 'flash'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}

/* --------------------------------------------------------- BOOTSTRAP ---- */
if (State.token) enterApp().catch(() => logout());
