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
  admin:     ['dashboard', 'schools', 'students', 'risk', 'map', 'attendance', 'academics', 'counseling', 'awareness', 'messages', 'translations', 'reports', 'audit'],
  teacher:   ['dashboard', 'students', 'attendance', 'risk', 'academics', 'counseling'],
  counselor: ['dashboard', 'risk', 'map', 'counseling', 'students', 'awareness', 'translations'],
  district:  ['dashboard', 'schools', 'risk', 'map', 'academics', 'awareness', 'messages', 'reports'],
  community: ['dashboard', 'awareness', 'messages'],
  parent:    ['children', 'awareness']
};
// Nav tab → the package feature it requires (others are ungated).
const NAV_FEATURE = {
  risk: 'ai_risk', academics: 'academic_reports', counseling: 'counseling',
  map: 'gis', reports: 'analytics'
};
function hasFeature(f) { return !f || (State.user.features || []).includes(f); }
const VIEWS = {};

function buildNav() {
  const tabs = (ROLE_NAV[State.user.role] || ['dashboard'])
    .filter(t => hasFeature(NAV_FEATURE[t]));
  $('#nav').innerHTML = tabs.map(t =>
    `<a href="#${t}" data-tab="${t}">${cap(t)}</a>`).join('');
  $('#nav').querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => setTimeout(route, 0)));
}

function route() {
  const tabs = ROLE_NAV[State.user.role] || ['dashboard'];
  let tab = location.hash.slice(1).split('/')[0] || tabs[0];
  if (!tabs.includes(tab) && !VIEWS[tab]) tab = tabs[0]; // fall back to first allowed tab
  $('#nav').querySelectorAll('a').forEach(a =>
    a.classList.toggle('active', a.dataset.tab === tab));
  const view = VIEWS[tab] || VIEWS[tabs[0]] || (() => setView('<p>Not found</p>'));
  view();
}
window.addEventListener('hashchange', route);

async function enterApp() {
  if (!State.user) { const me = await api('/auth/me'); State.user = me.user; }
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  const pkg = State.user.package;
  const pkgBadge = (pkg && ['teacher', 'counselor'].includes(State.user.role))
    ? ` <span class="badge gray" title="School package">${pkg}</span>` : '';
  $('#userLabel').innerHTML = `${esc(State.user.full_name)} · ${cap(State.user.role)}${pkgBadge}`;
  buildNav();
  updateOfflineBadge();
  flushQueue();
  if (!location.hash) location.hash = (ROLE_NAV[State.user.role] || ['dashboard'])[0];
  route();
}

/* ------------------------------------------------------------- VIEWS ----- */
VIEWS.dashboard = async function () {
  setView('<h2>Dashboard</h2><p class="sub">Loading…</p>');
  const s = await api('/analytics/summary');
  const scopeLabel = State.user.role === 'admin' ? 'National'
    : State.user.role === 'district' ? 'District'
    : 'School';
  setView(`
    <h2>${scopeLabel} Early-Warning Dashboard</h2>
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
    ${hasFeature('ai_risk') ? `
      <h3 class="section-title">Priority: learners needing intervention</h3>
      <div id="riskMini"></div>`
      : `<div class="card" style="margin-top:18px;border-style:dashed">
           <h3>🔒 AI Early-Warning (Gold package)</h3>
           <p class="muted">Upgrade to the Gold package to unlock the Girl Child Vulnerability
           Score and automatic intervention recommendations.</p></div>`}
  `);
  const trend = await api('/analytics/attendance-trend?days=14');
  $('#trendCard').innerHTML = barChart(trend);
  if (hasFeature('ai_risk')) renderRiskTable('#riskMini', await api('/risk?minLevel=high'), true);
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

VIEWS.schools = async function () {
  setView('<h2>Schools &amp; District Overview</h2><p class="sub">Loading…</p>');
  const rows = await api('/analytics/by-school');
  const tot = rows.reduce((a, s) => ({
    students: a.students + s.students, girls: a.girls + s.girls,
    high: a.high + s.high, medium: a.medium + s.medium
  }), { students: 0, girls: 0, high: 0, medium: 0 });
  setView(`
    <h2>Schools &amp; District Overview</h2>
    <p class="sub">${rows.length} school(s) in scope · ${tot.students} learners · ${tot.girls} girls</p>
    <div class="grid">
      ${stat('green', rows.length, 'Schools')}
      ${stat('green', tot.students, 'Learners')}
      ${stat('red', tot.high, 'High-risk')}
      ${stat('amber', tot.medium, 'Medium-risk')}
    </div>
    <h3 class="section-title">Per-school breakdown</h3>
    ${renderTable(['School', 'District', 'Package', 'Learners', 'Girls', 'High', 'Medium', 'Attendance today'],
      rows.map(s => [
        esc(s.name), esc(s.district),
        `<span class="badge gray">${s.package}</span>`,
        s.students, s.girls,
        s.high ? `<span class="badge high">${s.high}</span>` : '0',
        s.medium ? `<span class="badge medium">${s.medium}</span>` : '0',
        s.attendanceToday != null
          ? `<b style="color:${s.attendanceToday>=85?'var(--green)':s.attendanceToday>=70?'var(--amber)':'var(--red)'}">${s.attendanceToday}%</b>`
          : '<span class="muted">—</span>'
      ]))}
    ${can('admin') ? '<p style="margin-top:14px"><button class="sm" data-action="add-school">+ Register school</button></p>' : ''}
  `);
};

window.addSchool = async function () {
  const name = prompt('School name:'); if (!name) return;
  const district = prompt('District:'); if (!district) return;
  const pkg = prompt('Package (bronze/silver/gold/platinum):', 'bronze') || 'bronze';
  try { await api('/schools', { method: 'POST', body: { name, district, package: pkg } }); flash('School registered.'); VIEWS.schools(); }
  catch (e) { flash('Error: ' + e.message); }
};

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
      style="cursor:pointer" data-action="student" data-id="${p.studentId}">
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
        <button class="sm" data-action="report" data-path="/reports/at-risk.csv" data-file="at-risk-learners.csv">Download CSV</button>
      </div>
      <div class="card">
        <h3>Attendance summary (30 days)</h3>
        <p class="muted">Per-learner present/absent/late counts and attendance rate.</p>
        <button class="sm" data-action="report" data-path="/reports/attendance.csv?days=30" data-file="attendance-30d.csv">Download CSV</button>
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
        `<a href="#" data-action="student" data-id="${st.id}">${esc(st.full_name)}</a>`,
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
    <p><a href="#students" data-action="students">&larr; Back to register</a></p>
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
        ${can('admin','teacher','counselor') ? `<button class="sm" data-action="counsel" data-id="${id}">+ Log counseling / welfare action</button>` : ''}
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
    const payload = { date: $('#attDate').value, records, notify: $('#notify').checked };
    try {
      if (!navigator.onLine) throw new Error('offline');
      const r = await api('/attendance/bulk', { method: 'POST', body: payload });
      flash(`Register saved for ${r.count} learners — parents notified.`);
    } catch (err) {
      queueAttendance(payload);
      flash('📴 Saved offline — will sync automatically when back online.');
    }
  });
};

/* -------------------------------------------------- OFFLINE SYNC QUEUE --- */
const QKEY = 'sg_att_queue';
function queueAttendance(payload) {
  const q = JSON.parse(localStorage.getItem(QKEY) || '[]');
  q.push(payload); localStorage.setItem(QKEY, JSON.stringify(q));
  updateOfflineBadge();
}
async function flushQueue() {
  if (!State.token || !navigator.onLine) return;
  let q = JSON.parse(localStorage.getItem(QKEY) || '[]');
  if (!q.length) return;
  const remaining = [];
  for (const payload of q) {
    try { await api('/attendance/bulk', { method: 'POST', body: payload }); }
    catch { remaining.push(payload); }
  }
  localStorage.setItem(QKEY, JSON.stringify(remaining));
  updateOfflineBadge();
  if (q.length && !remaining.length) flash(`✅ Synced ${q.length} offline register(s).`);
}
function updateOfflineBadge() {
  const n = JSON.parse(localStorage.getItem(QKEY) || '[]').length;
  let el = document.getElementById('offlineBadge');
  if (!el) {
    el = document.createElement('span'); el.id = 'offlineBadge';
    el.style.cssText = 'margin-left:8px;font-size:.78rem';
    (document.querySelector('.user-box') || document.body).prepend(el);
  }
  el.innerHTML = n ? `<span class="badge medium">${n} pending sync</span>` : '';
}
window.addEventListener('online', flushQueue);

VIEWS.counseling = async function () {
  const [list, students] = await Promise.all([api('/counseling'), api('/students')]);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = list.filter(c => c.scheduled_date && c.scheduled_date >= today
    && ['open', 'in_progress'].includes(c.status));
  setView(`
    <h2>Counseling &amp; Welfare</h2>
    <p class="sub">Schedule sessions, log welfare cases, and auto-remind guardians by SMS.</p>
    <div class="card" style="margin-bottom:16px">
      <h3>Schedule a session / log a case</h3>
      <div class="row">
        <select id="cStudent" class="col">${students.map(s => `<option value="${s.id}">${esc(s.full_name)} (${s.grade})</option>`).join('')}</select>
        <select id="cType" class="col">
          <option value="session">Counseling session</option>
          <option value="home_visit">Home visit</option>
          <option value="parent_meeting">Parent meeting</option>
          <option value="welfare_case">Welfare case</option>
          <option value="referral">Referral</option>
        </select>
      </div>
      <div class="row">
        <label class="col pill">Scheduled date <input id="cSched" type="date" /></label>
        <label class="col pill">Follow-up date <input id="cFollow" type="date" /></label>
      </div>
      <textarea id="cNotes" rows="2" placeholder="Notes…"></textarea>
      <button class="sm" data-action="counsel-save">Save</button>
      <button class="sm ghost-red" data-action="run-reminders" style="float:right">Send due reminders now</button>
    </div>
    ${upcoming.length ? `<h3 class="section-title">📅 Upcoming sessions</h3>
      ${renderTable(['Scheduled', 'Learner', 'Type', 'Follow-up', 'Reminded'], upcoming.map(c => [
        c.scheduled_date, esc(c.student_name), c.type, c.follow_up_date || '—',
        c.reminded_scheduled ? '<span class="badge low">sent</span>' : '<span class="badge gray">pending</span>'
      ]))}` : ''}
    <h3 class="section-title">All cases</h3>
    ${renderTable(['Logged', 'Scheduled', 'Learner', 'Grade', 'Type', 'Status', 'Notes'], list.map(c => [
      c.created_at.slice(0, 10), c.scheduled_date || '—', esc(c.student_name), c.grade, c.type,
      `<span class="badge ${c.status === 'resolved' ? 'low' : c.status === 'escalated' ? 'high' : 'medium'}">${c.status}</span>`,
      esc(c.notes || '')
    ]))}
  `);
};

window.saveCounseling = async function () {
  const body = {
    student_id: Number($('#cStudent').value), type: $('#cType').value,
    scheduled_date: $('#cSched').value || null, follow_up_date: $('#cFollow').value || null,
    notes: $('#cNotes').value || null
  };
  try { await api('/counseling', { method: 'POST', body }); flash('Saved.'); VIEWS.counseling(); }
  catch (e) { flash('Error: ' + e.message); }
};
window.runReminders = async function () {
  const r = await api('/counseling/run-reminders', { method: 'POST', body: {} });
  flash(`Reminders sent: ${r.scheduled} scheduled, ${r.followup} follow-up.`);
  VIEWS.counseling();
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

/* ------------------------------------------------ TRANSLATION REVIEW ---- */
const LANG_NAMES = { en: 'English', bem: 'Bemba', nya: 'Nyanja', toi: 'Tonga', loz: 'Lozi' };

VIEWS.translations = async function () {
  const all = await api('/templates');
  const byKey = {};
  for (const t of all) (byKey[t.key] = byKey[t.key] || []).push(t);
  const pending = all.filter(t => t.status === 'pending_review' || t.status === 'draft').length;
  setView(`
    <h2>Local-Language Message Review</h2>
    <p class="sub">Native speakers approve translations before any are sent to guardians.
      <span class="badge ${pending ? 'medium' : 'low'}">${pending} awaiting review</span></p>
    ${Object.entries(byKey).map(([key, rows]) => {
      const en = rows.find(r => r.language === 'en');
      return `<div class="card" style="margin-bottom:14px">
        <h3 style="text-transform:capitalize">${key} message</h3>
        <p class="muted">English (source): ${esc(en ? en.body : '—')}</p>
        ${renderTable(['Language', 'Translation', 'Status', 'Action'], rows.filter(r => r.language !== 'en').map(r => [
          LANG_NAMES[r.language] || r.language,
          `<span data-tpl-body="${r.id}">${esc(r.body)}</span>`,
          `<span class="badge ${r.status === 'approved' ? 'low' : r.status === 'rejected' ? 'high' : 'medium'}">${r.status.replace('_', ' ')}</span>`,
          `<button class="sm" data-action="tpl-edit" data-id="${r.id}">Edit</button>
           <button class="sm" data-action="tpl-approve" data-id="${r.id}">Approve</button>
           <button class="sm ghost-red" data-action="tpl-reject" data-id="${r.id}">Reject</button>`
        ]))}
      </div>`;
    }).join('')}
  `);
};

window.reviewTemplate = async function (id, decision) {
  const note = decision === 'rejected' ? (prompt('Reason for rejection (optional):') || '') : '';
  await api(`/templates/${id}/review`, { method: 'POST', body: { decision, note } });
  flash(`Translation ${decision}.`); VIEWS.translations();
};
window.editTemplate = async function (id) {
  const current = document.querySelector(`[data-tpl-body="${id}"]`)?.textContent || '';
  const body = prompt('Edit translation (keep placeholders like {name}, {avg}, {date}):', current);
  if (body == null) return;
  try { await api(`/templates/${id}`, { method: 'PUT', body: { body } }); flash('Saved — now pending review.'); VIEWS.translations(); }
  catch (e) { flash('Error: ' + e.message); }
};

/* ------------------------------------------------ ACADEMIC ANALYTICS ---- */
VIEWS.academics = async function () {
  setView('<h2>Academic Analytics</h2><p class="sub">Term-over-term performance trends.</p><p>Loading…</p>');
  const d = await api('/analytics/academic');
  setView(`
    <h2>Academic Analytics</h2>
    <p class="sub">Term-over-term performance across ${d.terms.length} term(s) · latest: ${d.latestTerm || '—'}</p>
    <div class="row">
      <div class="col card">
        <h3>Overall average &amp; pass rate</h3>
        ${renderTable(['Term', 'Avg %', 'Pass rate %', 'Entries'],
          d.overall.map(o => [o.term, o.avg, `<b style="color:${o.passRate>=75?'var(--green)':o.passRate>=50?'var(--amber)':'var(--red)'}">${o.passRate}%</b>`, o.entries]))}
      </div>
      <div class="col card">
        <h3>Subject averages by term</h3>
        ${lineChart(d.bySubject, d.terms)}
      </div>
    </div>
    <div class="row">
      <div class="col card"><h3>🏆 Top performers (${d.latestTerm || ''})</h3>
        ${renderTable(['Learner', 'Grade', 'Avg %'], d.topPerformers.map(s => [esc(s.full_name), s.grade, s.avg]))}</div>
      <div class="col card"><h3>📉 Steepest decline</h3>
        ${d.decliners.length ? renderTable(['Learner', 'Grade', 'From', 'To', 'Drop'],
          d.decliners.map(s => [esc(s.full_name), s.grade, s.from + '%', s.to + '%', `<span class="badge high">−${s.drop}</span>`]))
          : '<p class="muted">No decline detected. 🎉</p>'}</div>
    </div>
  `);
};

/* SVG multi-series line chart of subject averages across terms. */
function lineChart(series, terms) {
  if (!terms.length) return '<p class="muted">No data.</p>';
  const W = 460, H = 220, pad = 34;
  const colors = ['#1f8a4c', '#e6a700', '#d6453d', '#2b6cb0', '#7c3aed', '#0891b2'];
  const x = i => pad + (terms.length === 1 ? (W - pad * 2) / 2 : i * (W - pad * 2) / (terms.length - 1));
  const y = v => H - pad - (v / 100) * (H - pad * 2);
  const lines = series.map((s, si) => {
    const pts = s.byTerm.map((t, i) => t.avg != null ? `${x(i).toFixed(1)},${y(t.avg).toFixed(1)}` : null).filter(Boolean);
    const dots = s.byTerm.map((t, i) => t.avg != null
      ? `<circle cx="${x(i).toFixed(1)}" cy="${y(t.avg).toFixed(1)}" r="3" fill="${colors[si % colors.length]}"><title>${esc(s.subject)} ${t.term}: ${t.avg}%</title></circle>` : '').join('');
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="${colors[si % colors.length]}" stroke-width="2"/>${dots}`;
  }).join('');
  const xlabels = terms.map((t, i) => `<text x="${x(i)}" y="${H - 10}" font-size="9" text-anchor="middle" fill="#6b7a87">${t}</text>`).join('');
  const legend = series.map((s, si) =>
    `<span class="pill" style="margin-right:10px"><span style="display:inline-block;width:10px;height:10px;background:${colors[si % colors.length]};border-radius:2px"></span> ${esc(s.subject)}</span>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">
    <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="#e3e9e7"/>
    <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${H - pad}" stroke="#e3e9e7"/>
    <text x="6" y="${pad}" font-size="9" fill="#6b7a87">100</text>
    <text x="10" y="${H - pad}" font-size="9" fill="#6b7a87">0</text>
    ${lines}${xlabels}</svg><div style="margin-top:6px">${legend}</div>`;
}

/* ---------------------------------------------------- PARENT PORTAL ----- */
VIEWS.children = async function () {
  setView('<h2>My Children</h2><p class="sub">Loading…</p>');
  const kids = await api('/portal/children');
  if (!kids.length) { setView('<h2>My Children</h2><p class="muted">No children are linked to your account yet. Please contact the school.</p>'); return; }
  setView(`
    <h2>My Children</h2>
    <p class="sub">Attendance, results and school messages for your child(ren).</p>
    <div class="grid">${kids.map(c => `
      <div class="card">
        <h3>${esc(c.full_name)}</h3>
        <p class="muted">Grade ${c.grade}</p>
        <p>Attendance (30 days): <b>${c.attendanceRate != null ? c.attendanceRate + '%' : '—'}</b></p>
        <p>Recent average: <b>${c.recentAverage != null ? c.recentAverage + '%' : '—'}</b></p>
        <button class="sm" data-action="child" data-id="${c.id}">View details</button>
      </div>`).join('')}
    </div>
  `);
};

window.openChild = async function (id) {
  const d = await api('/portal/children/' + id);
  const att = d.attendance.slice(0, 14).reverse();
  setView(`
    <p><a href="#children" data-action="children">&larr; Back</a></p>
    <h2>${esc(d.child.full_name)}</h2>
    <p class="sub">Grade ${d.child.grade} · ${esc(d.child.village || '')}</p>
    <div class="row">
      <div class="col card">
        <h3>Recent attendance</h3>
        <p>${att.map(a => `<span title="${a.date}" class="badge ${a.status==='present'?'low':a.status==='late'?'medium':'high'}" style="margin:2px">${a.status[0].toUpperCase()}</span>`).join('') || '<span class="muted">No records</span>'}</p>
        <h3>Results</h3>
        ${renderTable(['Term', 'Subject', 'Score'], d.performance.map(p => [p.term, p.subject, p.score + '%']))}
      </div>
      <div class="col card">
        <h3>School messages</h3>
        ${renderTable(['Date', 'Type', 'Message'], d.messages.map(m => [m.created_at.slice(0,10), m.category, esc(m.body)]))}
      </div>
    </div>
  `);
};

/* ----------------------------------------------------------- FORMS ------ */
async function addStudentForm() {
  setView(`
    <p><a href="#students" data-action="students">&larr; Back</a></p>
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
      `<a href="#" data-action="student" data-id="${a.studentId}">${esc(a.student.full_name)}</a>`,
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

/* ------------------------------------------------- EVENT DELEGATION ----- */
/* No inline handlers — keeps the Content-Security-Policy strict (script-src 'self'). */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id, path, file } = el.dataset;
  if (action === 'student') { e.preventDefault(); openStudent(Number(id)); }
  else if (action === 'students') { e.preventDefault(); VIEWS.students(); }
  else if (action === 'counsel') { e.preventDefault(); logCounseling(Number(id)); }
  else if (action === 'report') { e.preventDefault(); downloadReport(path, file); }
  else if (action === 'child') { e.preventDefault(); openChild(Number(id)); }
  else if (action === 'children') { e.preventDefault(); VIEWS.children(); }
  else if (action === 'tpl-edit') { e.preventDefault(); editTemplate(Number(id)); }
  else if (action === 'tpl-approve') { e.preventDefault(); reviewTemplate(Number(id), 'approved'); }
  else if (action === 'tpl-reject') { e.preventDefault(); reviewTemplate(Number(id), 'rejected'); }
  else if (action === 'add-school') { e.preventDefault(); addSchool(); }
  else if (action === 'counsel-save') { e.preventDefault(); saveCounseling(); }
  else if (action === 'run-reminders') { e.preventDefault(); runReminders(); }
});

/* --------------------------------------------------------- BOOTSTRAP ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
if (State.token) enterApp().catch(() => logout());
