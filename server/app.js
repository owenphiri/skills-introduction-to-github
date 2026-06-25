'use strict';

/**
 * SafeGirl EduTrack — application server.
 * Wires together auth, students, attendance, performance, counseling,
 * messaging, awareness and analytics into a single REST API, and serves the
 * web dashboard from /public.
 */
const path = require('path');
const express = require('express');
const config = require('./config');
const db = require('./db');
const auth = require('./auth');
const messaging = require('./messaging');
const riskEngine = require('./riskEngine');
const templates = require('./templates');
const security = require('./security');
const scope = require('./scope');
const features = require('./features');
const reminders = require('./reminders');

const app = express();
app.set('trust proxy', true); // correct req.ip behind a load balancer / reverse proxy
app.use(security.securityHeaders);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false })); // aggregator delivery webhooks post form data
app.use(express.static(path.join(__dirname, '..', 'public')));

// Throttle authentication attempts per IP to blunt credential-stuffing.
const loginLimiter = security.rateLimit({ windowMs: 15 * 60_000, max: 20 });
// General API ceiling per IP.
app.use('/api', security.rateLimit({ windowMs: 60_000, max: 300 }));

// Small async wrapper so route handlers can throw / await safely.
const wrap = fn => (req, res) =>
  Promise.resolve(fn(req, res)).catch(err => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Internal error' });
  });

/* ------------------------------------------------------------------ AUTH -- */

app.post('/api/auth/login', loginLimiter, wrap((req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !auth.verifyPassword(password, user.password_hash)) {
    security.audit(req, 'login.failed', username ? `user:${username}` : null);
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = auth.createSession(user.id);
  req.user = user;
  security.audit(req, 'login.success', `user:${user.id}`);
  res.json({
    token,
    user: {
      id: user.id, full_name: user.full_name, role: user.role, username: user.username,
      package: features.schoolPackage(user.school_id),
      features: features.featuresForUser(user)
    }
  });
}));

app.post('/api/auth/logout', auth.authenticate, wrap((req, res) => {
  auth.destroySession(req.token);
  res.json({ ok: true });
}));

app.get('/api/auth/me', auth.authenticate, wrap((req, res) => res.json({
  user: {
    ...req.user,
    package: features.schoolPackage(req.user.school_id),
    features: features.featuresForUser(req.user)
  }
})));

/* ----------------------------------------------------------------- USERS -- */

app.post('/api/users', auth.authenticate, auth.requireRole('admin'), wrap((req, res) => {
  const { full_name, username, password, role, phone, school_id, district } = req.body || {};
  if (!full_name || !username || !password || !role) {
    return res.status(400).json({ error: 'full_name, username, password and role are required' });
  }
  const pwProblem = security.passwordProblem(password);
  if (pwProblem) return res.status(400).json({ error: pwProblem });
  try {
    const info = db.prepare(
      'INSERT INTO users (full_name, username, password_hash, role, phone, school_id, district) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(full_name, username, auth.hashPassword(password), role, phone || null, school_id || null, district || null);
    security.audit(req, 'user.create', `user:${info.lastInsertRowid}`, `role=${role}`);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Username already exists' });
  }
}));

app.get('/api/users', auth.authenticate, auth.requireRole('admin'), wrap((req, res) => {
  res.json(db.prepare('SELECT id, full_name, username, role, phone, created_at FROM users ORDER BY id').all());
}));

/* -------------------------------------------------------------- STUDENTS -- */

const STUDENT_FIELDS = ['full_name', 'nrc', 'grade', 'gender', 'date_of_birth',
  'parent_name', 'parent_phone', 'village', 'gps_lat', 'gps_lng',
  'vulnerability_status', 'health_info', 'emergency_contact', 'school_id'];

app.post('/api/students', auth.authenticate, auth.requireRole('admin', 'teacher'), wrap((req, res) => {
  const b = req.body || {};
  if (!b.full_name || !b.grade || !b.gender) {
    return res.status(400).json({ error: 'full_name, grade and gender are required' });
  }
  // A learner registered by school staff belongs to that staff member's school
  // unless an admin explicitly assigns one.
  if (b.school_id === undefined && req.user.school_id) b.school_id = req.user.school_id;
  const cols = STUDENT_FIELDS.filter(f => b[f] !== undefined);
  const info = db.prepare(
    `INSERT INTO students (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
  ).run(...cols.map(c => b[c]));
  security.audit(req, 'student.create', `student:${info.lastInsertRowid}`);
  res.status(201).json(db.prepare('SELECT * FROM students WHERE id = ?').get(info.lastInsertRowid));
}));

app.get('/api/students', auth.authenticate, wrap((req, res) => {
  const { grade, q } = req.query;
  const sc = scope.schoolClause(req.user);
  let sql = 'SELECT * FROM students WHERE active = 1' + sc.clause;
  const params = [...sc.params];
  if (grade) { sql += ' AND grade = ?'; params.push(grade); }
  if (q) { sql += ' AND full_name LIKE ?'; params.push(`%${q}%`); }
  sql += ' ORDER BY full_name';
  res.json(db.prepare(sql).all(...params));
}));

app.get('/api/students/:id', auth.authenticate, wrap((req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  // Enforce school scope: a user may only view learners within their scope.
  const allowed = scope.allowedSchoolIds(req.user);
  if (allowed !== null && !allowed.includes(student.school_id)) {
    return res.status(403).json({ error: 'This learner is outside your school/district scope' });
  }
  const attendance = db.prepare(
    'SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date DESC LIMIT 30'
  ).all(student.id);
  const performance = db.prepare(
    'SELECT term, subject, score FROM performance WHERE student_id = ? ORDER BY term DESC, subject'
  ).all(student.id);
  const counseling = db.prepare(
    'SELECT * FROM counseling WHERE student_id = ? ORDER BY created_at DESC'
  ).all(student.id);
  res.json({ student, attendance, performance, counseling, risk: riskEngine.assess(student.id) });
}));

app.put('/api/students/:id', auth.authenticate, auth.requireRole('admin', 'teacher'), wrap((req, res) => {
  const b = req.body || {};
  const cols = STUDENT_FIELDS.filter(f => b[f] !== undefined);
  if (cols.length === 0) return res.status(400).json({ error: 'No updatable fields supplied' });
  db.prepare(`UPDATE students SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`)
    .run(...cols.map(c => b[c]), req.params.id);
  res.json(db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id));
}));

/* ------------------------------------------------------------ ATTENDANCE -- */

/**
 * Mark attendance for one student/day. Automatically (a) notifies the parent
 * and (b) re-assesses risk, flagging via SMS when the student crosses into the
 * high-risk band. This is the "Smart Attendance Monitoring" module.
 */
app.post('/api/attendance', auth.authenticate, auth.requireRole('admin', 'teacher'), wrap(async (req, res) => {
  const { student_id, date, status, note, language = 'en', notify = true } = req.body || {};
  if (!student_id || !status) return res.status(400).json({ error: 'student_id and status are required' });
  const day = date || new Date().toISOString().slice(0, 10);

  db.prepare(`
    INSERT INTO attendance (student_id, date, status, marked_by, note)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status, note = excluded.note
  `).run(student_id, day, status, req.user.id, note || null);

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
  const out = { student_id, date: day, status, notifications: [] };

  if (notify && student.parent_phone && (status === 'present' || status === 'absent')) {
    const body = templates.render(status, language, { name: student.full_name });
    const msg = await messaging.send({
      studentId: student_id, phone: student.parent_phone,
      category: 'attendance', body, language
    });
    out.notifications.push(msg);
  }

  // Re-assess and auto-escalate a freshly high-risk student.
  const risk = riskEngine.assess(student_id);
  out.risk = risk;
  if (risk.level === 'high' && student.parent_phone) {
    const alert = `SafeGirl: ${student.full_name} is now flagged HIGH RISK for dropout. The school will be in touch about support.`;
    out.notifications.push(await messaging.send({
      studentId: student_id, phone: student.parent_phone, category: 'system', body: alert, language
    }));
  }
  res.status(201).json(out);
}));

/** Bulk register a whole class for a date in one request. */
app.post('/api/attendance/bulk', auth.authenticate, auth.requireRole('admin', 'teacher'), wrap(async (req, res) => {
  const { date, records = [], notify = true, language = 'en' } = req.body || {};
  const day = date || new Date().toISOString().slice(0, 10);
  const results = [];
  for (const r of records) {
    const stmt = db.prepare(`
      INSERT INTO attendance (student_id, date, status, marked_by)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status
    `);
    stmt.run(r.student_id, day, r.status, req.user.id);
    const student = db.prepare('SELECT full_name, parent_phone FROM students WHERE id = ?').get(r.student_id);
    if (notify && student?.parent_phone && (r.status === 'present' || r.status === 'absent')) {
      await messaging.send({
        studentId: r.student_id, phone: student.parent_phone, category: 'attendance',
        body: templates.render(r.status, language, { name: student.full_name }), language
      });
    }
    results.push({ student_id: r.student_id, status: r.status });
  }
  res.status(201).json({ date: day, count: results.length, records: results });
}));

/* ----------------------------------------------------------- PERFORMANCE -- */

app.post('/api/performance', auth.authenticate, auth.requireRole('admin', 'teacher'), wrap(async (req, res) => {
  const { student_id, term, subject, score, notify = false, language = 'en' } = req.body || {};
  if (!student_id || !term || !subject || score == null) {
    return res.status(400).json({ error: 'student_id, term, subject and score are required' });
  }
  db.prepare('INSERT INTO performance (student_id, term, subject, score, recorded_by) VALUES (?, ?, ?, ?, ?)')
    .run(student_id, term, subject, score, req.user.id);

  const out = { ok: true };
  if (notify) {
    const avg = db.prepare('SELECT AVG(score) AS a FROM performance WHERE student_id = ? AND term = ?')
      .get(student_id, term).a;
    const student = db.prepare('SELECT full_name, parent_phone FROM students WHERE id = ?').get(student_id);
    if (student?.parent_phone) {
      out.notification = await messaging.send({
        studentId: student_id, phone: student.parent_phone, category: 'results',
        body: templates.render('results', language, { name: student.full_name, avg: Math.round(avg) }), language
      });
    }
  }
  res.status(201).json(out);
}));

/* ------------------------------------------------------------ COUNSELING -- */

app.post('/api/counseling', auth.authenticate, auth.requireRole('admin', 'counselor', 'teacher'),
  features.requireFeature('counseling'), wrap((req, res) => {
  const { student_id, type, notes, scheduled_date, follow_up_date, status } = req.body || {};
  if (!student_id || !type) return res.status(400).json({ error: 'student_id and type are required' });
  const info = db.prepare(`
    INSERT INTO counseling (student_id, type, notes, counselor_id, scheduled_date, follow_up_date, status)
    VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, 'open'))
  `).run(student_id, type, notes || null, req.user.id, scheduled_date || null, follow_up_date || null, status || null);
  res.status(201).json(db.prepare('SELECT * FROM counseling WHERE id = ?').get(info.lastInsertRowid));
}));

app.put('/api/counseling/:id', auth.authenticate, auth.requireRole('admin', 'counselor'),
  features.requireFeature('counseling'), wrap((req, res) => {
  const { status, notes, follow_up_date } = req.body || {};
  db.prepare('UPDATE counseling SET status = COALESCE(?, status), notes = COALESCE(?, notes), follow_up_date = COALESCE(?, follow_up_date) WHERE id = ?')
    .run(status || null, notes || null, follow_up_date || null, req.params.id);
  res.json(db.prepare('SELECT * FROM counseling WHERE id = ?').get(req.params.id));
}));

app.get('/api/counseling', auth.authenticate, auth.requireRole('admin', 'counselor', 'teacher'),
  features.requireFeature('counseling'), wrap((req, res) => {
  const sc = scope.schoolClause(req.user, 's.school_id');
  res.json(db.prepare(`
    SELECT c.*, s.full_name AS student_name, s.grade
    FROM counseling c JOIN students s ON s.id = c.student_id
    WHERE 1=1${sc.clause}
    ORDER BY (c.scheduled_date IS NULL), c.scheduled_date DESC, c.created_at DESC LIMIT 200
  `).all(...sc.params));
}));

/** Manually trigger the counseling reminder dispatcher (also runs on a timer). */
app.post('/api/counseling/run-reminders', auth.authenticate, auth.requireRole('admin', 'counselor'),
  features.requireFeature('counseling'), wrap(async (req, res) => {
    const result = await reminders.runReminders({ language: req.body?.language || 'en' });
    security.audit(req, 'counseling.reminders', null, `scheduled=${result.scheduled} followup=${result.followup}`);
    res.json(result);
  }));

/* ------------------------------------------------------------- MESSAGING -- */

/** Send an awareness / custom broadcast. */
app.post('/api/messages/broadcast', auth.authenticate,
  auth.requireRole('admin', 'counselor', 'district', 'community'), wrap(async (req, res) => {
    const { category = 'awareness', body, language = 'en', grade, channel = 'sms' } = req.body || {};
    if (!body) return res.status(400).json({ error: 'body is required' });
    // Community leaders run awareness campaigns network-wide; school staff are
    // scoped to their own school; district officers to their district.
    const sc = req.user.role === 'community'
      ? { clause: '', params: [] }
      : scope.schoolClause(req.user, 'school_id');
    let sql = "SELECT id, parent_phone FROM students WHERE active = 1 AND parent_phone IS NOT NULL AND parent_phone <> ''" + sc.clause;
    const params = [...sc.params];
    if (grade) { sql += ' AND grade = ?'; params.push(grade); }
    const recipients = db.prepare(sql).all(...params);
    let sent = 0;
    for (const r of recipients) {
      await messaging.send({ studentId: r.id, phone: r.parent_phone, category, body, language, channel });
      sent++;
    }
    security.audit(req, 'message.broadcast', grade ? `grade:${grade}` : 'all', `sent=${sent} lang=${language}`);
    res.json({ sent, recipients: recipients.length });
  }));

app.get('/api/messages', auth.authenticate, wrap((req, res) => {
  const { category, limit = 100 } = req.query;
  let sql = 'SELECT * FROM messages';
  const params = [];
  if (category) { sql += ' WHERE category = ?'; params.push(category); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Number(limit));
  res.json(db.prepare(sql).all(...params));
}));

/* ----------------------------------------------- TEMPLATE REVIEW WORKFLOW -- */

/** List all message templates (grouped client-side by key), with review status. */
app.get('/api/templates', auth.authenticate,
  auth.requireRole('admin', 'counselor', 'reviewer'), wrap((req, res) => {
    const rows = db.prepare(`
      SELECT t.*, u.full_name AS reviewer_name
      FROM message_templates t LEFT JOIN users u ON u.id = t.reviewer_id
      ORDER BY t.key, t.language
    `).all();
    res.json(rows);
  }));

/** Items awaiting native-speaker review. */
app.get('/api/templates/pending', auth.authenticate,
  auth.requireRole('admin', 'counselor', 'reviewer'), wrap((req, res) => {
    res.json(db.prepare(
      "SELECT * FROM message_templates WHERE status IN ('draft','pending_review') ORDER BY language, key"
    ).all());
  }));

/** Edit a translation's wording. Editing resets it to 'pending_review'. */
app.put('/api/templates/:id', auth.authenticate,
  auth.requireRole('admin', 'counselor', 'reviewer'), wrap((req, res) => {
    const { body } = req.body || {};
    if (!body) return res.status(400).json({ error: 'body is required' });
    if (!/\{name\}|\{avg\}|\{date\}/.test(body) && /\{/.test(body)) {
      return res.status(400).json({ error: 'Unknown placeholder. Use {name}, {avg} or {date} only.' });
    }
    const tpl = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    db.prepare(
      "UPDATE message_templates SET body = ?, status = 'pending_review', reviewer_id = NULL, updated_at = datetime('now') WHERE id = ?"
    ).run(body, req.params.id);
    security.audit(req, 'template.edit', `template:${tpl.key}/${tpl.language}`);
    res.json(db.prepare('SELECT * FROM message_templates WHERE id = ?').get(req.params.id));
  }));

/** Approve or reject a translation. English approval is allowed; a non-English
 *  template can be approved by any authorised reviewer (in production, restrict
 *  reviewers to verified native speakers of that language). */
app.post('/api/templates/:id/review', auth.authenticate,
  auth.requireRole('admin', 'counselor', 'reviewer'), wrap((req, res) => {
    const { decision, note } = req.body || {};
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }
    const tpl = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    db.prepare(
      "UPDATE message_templates SET status = ?, reviewer_id = ?, review_note = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(decision, req.user.id, note || null, req.params.id);
    security.audit(req, `template.${decision}`, `template:${tpl.key}/${tpl.language}`, note || null);
    res.json(db.prepare('SELECT * FROM message_templates WHERE id = ?').get(req.params.id));
  }));

/* ------------------------------------------------------------- AWARENESS -- */

app.get('/api/awareness', auth.authenticate, wrap((req, res) => {
  const { language } = req.query;
  const sql = language ? 'SELECT * FROM awareness WHERE language = ?' : 'SELECT * FROM awareness';
  res.json((language ? db.prepare(sql).all(language) : db.prepare(sql).all()));
}));

/* ------------------------------------------------------- RISK & ANALYTICS -- */

app.get('/api/risk/:studentId', auth.authenticate, features.requireFeature('ai_risk'), wrap((req, res) => {
  const student = db.prepare('SELECT school_id FROM students WHERE id = ?').get(req.params.studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const allowed = scope.allowedSchoolIds(req.user);
  if (allowed !== null && !allowed.includes(student.school_id)) {
    return res.status(403).json({ error: 'This learner is outside your school/district scope' });
  }
  res.json(riskEngine.assess(Number(req.params.studentId)));
}));

app.get('/api/risk', auth.authenticate, features.requireFeature('ai_risk'), wrap((req, res) =>
  res.json(riskEngine.assessAll({
    minLevel: req.query.minLevel || 'medium',
    schoolIds: scope.allowedSchoolIds(req.user)
  }))));

/* ------------------------------------------------------- PARENT PORTAL -- */

/**
 * Read-only portal for guardians. A parent only ever sees their own linked
 * children, and is NEVER shown the internal vulnerability score (it could
 * stigmatise the child) — only attendance, results and messages they received.
 */
function childrenForGuardian(userId) {
  return db.prepare(
    'SELECT id, full_name, grade, gender FROM students WHERE guardian_user_id = ? AND active = 1'
  ).all(userId);
}

app.get('/api/portal/children', auth.authenticate, auth.requireRole('parent'), wrap((req, res) => {
  const kids = childrenForGuardian(req.user.id).map(c => {
    const since = new Date(); since.setDate(since.getDate() - 30);
    const att = db.prepare(`
      SELECT SUM(status='present') AS present, SUM(status='late') AS late, COUNT(*) AS total
      FROM attendance WHERE student_id = ? AND date >= ?
    `).get(c.id, since.toISOString().slice(0, 10));
    const recent = db.prepare(`
      SELECT AVG(score) AS avg FROM performance WHERE student_id = ?
        AND term = (SELECT term FROM performance WHERE student_id = ? ORDER BY term DESC LIMIT 1)
    `).get(c.id, c.id);
    return {
      ...c,
      attendanceRate: att.total ? Math.round((att.present + 0.5 * att.late) / att.total * 100) : null,
      recentAverage: recent.avg != null ? Math.round(recent.avg) : null
    };
  });
  res.json(kids);
}));

app.get('/api/portal/children/:id', auth.authenticate, auth.requireRole('parent'), wrap((req, res) => {
  const child = db.prepare(
    'SELECT id, full_name, grade, gender, village FROM students WHERE id = ? AND guardian_user_id = ?'
  ).get(req.params.id, req.user.id);
  if (!child) return res.status(404).json({ error: 'Child not found for this guardian' });
  const attendance = db.prepare(
    'SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date DESC LIMIT 30'
  ).all(child.id);
  const performance = db.prepare(
    'SELECT term, subject, score FROM performance WHERE student_id = ? ORDER BY term DESC, subject'
  ).all(child.id);
  const messages = db.prepare(
    'SELECT category, body, created_at FROM messages WHERE student_id = ? ORDER BY created_at DESC LIMIT 30'
  ).all(child.id);
  res.json({ child, attendance, performance, messages });
}));

/** Headline dashboard analytics (school-wide — not for individual guardians). */
app.get('/api/analytics/summary', auth.authenticate,
  auth.requireRole('admin', 'teacher', 'counselor', 'district', 'community'), wrap((req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const allowed = scope.allowedSchoolIds(req.user);
  const sStud = scope.schoolClause(req.user, 'school_id');  // direct on students
  const sJoin = scope.schoolClause(req.user, 's.school_id'); // via join

  const totalStudents = db.prepare('SELECT COUNT(*) AS n FROM students WHERE active = 1' + sStud.clause).get(...sStud.params).n;
  const girls = db.prepare("SELECT COUNT(*) AS n FROM students WHERE active = 1 AND gender = 'F'" + sStud.clause).get(...sStud.params).n;

  const todayRows = db.prepare(
    'SELECT a.status, COUNT(*) AS n FROM attendance a JOIN students s ON s.id = a.student_id WHERE a.date = ?'
    + sJoin.clause + ' GROUP BY a.status').all(today, ...sJoin.params);
  const todayMap = Object.fromEntries(todayRows.map(r => [r.status, r.n]));
  const marked = todayRows.reduce((s, r) => s + r.n, 0);
  const attendanceRateToday = marked ? Math.round(((todayMap.present || 0) + 0.5 * (todayMap.late || 0)) / marked * 100) : null;

  const atRisk = riskEngine.assessAll({ minLevel: 'medium', schoolIds: allowed });
  const high = atRisk.filter(a => a.level === 'high').length;
  const medium = atRisk.filter(a => a.level === 'medium').length;

  const interventions = db.prepare('SELECT COUNT(*) AS n FROM counseling c JOIN students s ON s.id = c.student_id WHERE 1=1' + sJoin.clause).get(...sJoin.params).n;
  const resolved = db.prepare("SELECT COUNT(*) AS n FROM counseling c JOIN students s ON s.id = c.student_id WHERE c.status = 'resolved'" + sJoin.clause).get(...sJoin.params).n;
  const messagesSent = db.prepare('SELECT COUNT(*) AS n FROM messages m JOIN students s ON s.id = m.student_id WHERE 1=1' + sJoin.clause).get(...sJoin.params).n;

  res.json({
    totalStudents, girls,
    attendanceRateToday, markedToday: marked,
    risk: { high, medium, low: totalStudents - high - medium },
    interventions, resolvedInterventions: resolved,
    messagesSent
  });
}));

/* --------------------------------------------------------------- REPORTS -- */

/** Minimal RFC-4180 CSV serialiser. */
function toCSV(headers, rows) {
  const esc = v => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\r\n');
}

function sendCSV(res, filename, headers, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCSV(headers, rows));
}

/** At-risk learners report (CSV) — for District Education Office returns. */
app.get('/api/reports/at-risk.csv', auth.authenticate,
  auth.requireRole('admin', 'counselor', 'district'), features.requireFeature('analytics'), wrap((req, res) => {
    const list = riskEngine.assessAll({
      minLevel: req.query.minLevel || 'medium', schoolIds: scope.allowedSchoolIds(req.user)
    });
    sendCSV(res, 'at-risk-learners.csv',
      ['Name', 'Grade', 'Sex', 'Village', 'Score', 'Level', 'AttendanceRate%', 'TopFactor', 'PrimaryAction'],
      list.map(a => [
        a.student.full_name, a.student.grade, a.student.gender, a.student.village,
        a.score, a.level, a.metrics.attendanceRate,
        a.factors[0]?.label || '', a.recommendations[0] || ''
      ]));
  }));

/** Attendance summary per learner over a window (CSV). */
app.get('/api/reports/attendance.csv', auth.authenticate,
  auth.requireRole('admin', 'teacher', 'district'), features.requireFeature('analytics'), wrap((req, res) => {
    const days = Math.min(180, Number(req.query.days) || 30);
    const since = new Date(); since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString().slice(0, 10);
    const sc = scope.schoolClause(req.user, 's.school_id');
    const rows = db.prepare(`
      SELECT s.full_name, s.grade,
        SUM(a.status = 'present') AS present,
        SUM(a.status = 'absent')  AS absent,
        SUM(a.status = 'late')    AS late,
        COUNT(a.id)               AS total
      FROM students s LEFT JOIN attendance a
        ON a.student_id = s.id AND a.date >= ?
      WHERE s.active = 1${sc.clause}
      GROUP BY s.id ORDER BY s.grade, s.full_name
    `).all(sinceISO, ...sc.params);
    sendCSV(res, `attendance-${days}d.csv`,
      ['Name', 'Grade', 'Present', 'Absent', 'Late', 'Total', 'Rate%'],
      rows.map(r => [r.full_name, r.grade, r.present, r.absent, r.late, r.total,
        r.total ? Math.round((r.present + 0.5 * r.late) / r.total * 100) : '']));
  }));

/* --------------------------------------------------------------- AUDIT -- */

app.get('/api/audit', auth.authenticate, auth.requireRole('admin'), wrap((req, res) => {
  res.json(db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all());
}));

/** Daily attendance-rate trend for the dashboard chart. */
app.get('/api/analytics/attendance-trend', auth.authenticate, wrap((req, res) => {
  const days = Math.min(60, Number(req.query.days) || 14);
  const sc = scope.schoolClause(req.user, 's.school_id');
  const rows = db.prepare(`
    SELECT a.date AS date,
      SUM(a.status = 'present') AS present,
      SUM(a.status = 'late')    AS late,
      COUNT(*)                  AS total
    FROM attendance a JOIN students s ON s.id = a.student_id
    WHERE a.date >= date('now', ?)${sc.clause}
    GROUP BY a.date ORDER BY a.date
  `).all(`-${days} days`, ...sc.params);
  res.json(rows.map(r => ({
    date: r.date,
    rate: r.total ? Math.round((r.present + 0.5 * r.late) / r.total * 100) : null
  })));
}));

/** Geo-located at-risk learners for GIS mapping (only those with coordinates). */
app.get('/api/analytics/gis', auth.authenticate,
  auth.requireRole('admin', 'counselor', 'district'), features.requireFeature('gis'), wrap((req, res) => {
    const list = riskEngine.assessAll({ minLevel: 'low', schoolIds: scope.allowedSchoolIds(req.user) });
    res.json(list
      .map(a => {
        const s = db.prepare('SELECT gps_lat, gps_lng FROM students WHERE id = ?').get(a.studentId);
        return { ...a, gps_lat: s.gps_lat, gps_lng: s.gps_lng };
      })
      .filter(a => a.gps_lat != null && a.gps_lng != null));
  }));

/**
 * Term-over-term academic analytics: overall averages & pass rates per term,
 * per-subject trend lines, top/low performers and the steepest decliners.
 */
app.get('/api/analytics/academic', auth.authenticate,
  auth.requireRole('admin', 'teacher', 'counselor', 'district'), features.requireFeature('academic_reports'), wrap((req, res) => {
    const sc = scope.schoolClause(req.user, 's.school_id');
    const J = 'performance p JOIN students s ON s.id = p.student_id';
    const terms = db.prepare(`SELECT DISTINCT p.term FROM ${J} WHERE 1=1${sc.clause} ORDER BY p.term`)
      .all(...sc.params).map(r => r.term);

    const overall = db.prepare(`
      SELECT p.term AS term, ROUND(AVG(p.score), 1) AS avg,
        ROUND(100.0 * SUM(p.score >= 50) / COUNT(*), 1) AS passRate,
        COUNT(*) AS entries
      FROM ${J} WHERE 1=1${sc.clause} GROUP BY p.term ORDER BY p.term
    `).all(...sc.params);

    const subjects = db.prepare(`SELECT DISTINCT p.subject FROM ${J} WHERE 1=1${sc.clause} ORDER BY p.subject`)
      .all(...sc.params).map(r => r.subject);
    const bySubject = subjects.map(subject => ({
      subject,
      byTerm: terms.map(term => {
        const row = db.prepare(`SELECT ROUND(AVG(p.score),1) AS avg FROM ${J} WHERE p.subject = ? AND p.term = ?${sc.clause}`)
          .get(subject, term, ...sc.params);
        return { term, avg: row.avg };
      })
    }));

    const latest = terms[terms.length - 1];
    const perStudentLatest = latest ? db.prepare(`
      SELECT s.id, s.full_name, s.grade, ROUND(AVG(p.score),1) AS avg
      FROM ${J} WHERE p.term = ?${sc.clause} GROUP BY s.id ORDER BY avg DESC
    `).all(latest, ...sc.params) : [];

    // Steepest term-over-term decline (last two terms).
    let decliners = [];
    if (terms.length >= 2) {
      const prev = terms[terms.length - 2];
      const a = db.prepare(`SELECT p.student_id AS student_id, AVG(p.score) AS avg FROM ${J} WHERE p.term = ?${sc.clause} GROUP BY p.student_id`).all(prev, ...sc.params);
      const b = db.prepare(`SELECT p.student_id AS student_id, AVG(p.score) AS avg FROM ${J} WHERE p.term = ?${sc.clause} GROUP BY p.student_id`).all(latest, ...sc.params);
      const prevMap = Object.fromEntries(a.map(r => [r.student_id, r.avg]));
      decliners = b.map(r => {
        const drop = (prevMap[r.student_id] ?? r.avg) - r.avg;
        const s = db.prepare('SELECT full_name, grade FROM students WHERE id = ?').get(r.student_id);
        return { ...s, drop: Math.round(drop), from: Math.round(prevMap[r.student_id] ?? r.avg), to: Math.round(r.avg) };
      }).filter(r => r.drop > 0).sort((x, y) => y.drop - x.drop).slice(0, 5);
    }

    res.json({
      terms, overall, bySubject,
      topPerformers: perStudentLatest.slice(0, 5),
      lowPerformers: perStudentLatest.slice(-5).reverse(),
      decliners,
      latestTerm: latest
    });
  }));

/* --------------------------------------------------- SCHOOLS & DISTRICT -- */

/** List schools within the caller's scope. */
app.get('/api/schools', auth.authenticate, wrap((req, res) => {
  if (req.user.role === 'admin') {
    return res.json(db.prepare('SELECT * FROM schools ORDER BY district, name').all());
  }
  if (req.user.role === 'district' && req.user.district) {
    return res.json(db.prepare('SELECT * FROM schools WHERE district = ? ORDER BY name').all(req.user.district));
  }
  if (req.user.school_id) {
    return res.json(db.prepare('SELECT * FROM schools WHERE id = ?').all(req.user.school_id));
  }
  res.json([]);
}));

/** Register a new school (admin). */
app.post('/api/schools', auth.authenticate, auth.requireRole('admin'), wrap((req, res) => {
  const { name, district, province, package: pkg } = req.body || {};
  if (!name || !district) return res.status(400).json({ error: 'name and district are required' });
  const info = db.prepare('INSERT INTO schools (name, district, province, package) VALUES (?, ?, ?, COALESCE(?, ?))')
    .run(name, district, province || null, pkg || null, 'bronze');
  security.audit(req, 'school.create', `school:${info.lastInsertRowid}`, `${name} (${district})`);
  res.status(201).json(db.prepare('SELECT * FROM schools WHERE id = ?').get(info.lastInsertRowid));
}));

/**
 * Per-school breakdown for the District Education Officer / national dashboard.
 * Scoped: admin sees all schools, a district officer sees only their district.
 */
app.get('/api/analytics/by-school', auth.authenticate,
  auth.requireRole('admin', 'district'), wrap((req, res) => {
    const allowed = scope.allowedSchoolIds(req.user); // null for admin
    let schools = allowed === null
      ? db.prepare('SELECT * FROM schools ORDER BY district, name').all()
      : (allowed.length
          ? db.prepare(`SELECT * FROM schools WHERE id IN (${allowed.map(() => '?').join(',')}) ORDER BY name`).all(...allowed)
          : []);
    const today = new Date().toISOString().slice(0, 10);
    const rows = schools.map(school => {
      const students = db.prepare('SELECT COUNT(*) AS n FROM students WHERE active = 1 AND school_id = ?').get(school.id).n;
      const girls = db.prepare("SELECT COUNT(*) AS n FROM students WHERE active = 1 AND gender = 'F' AND school_id = ?").get(school.id).n;
      const atRisk = riskEngine.assessAll({ minLevel: 'medium', schoolIds: [school.id] });
      const high = atRisk.filter(a => a.level === 'high').length;
      const medium = atRisk.filter(a => a.level === 'medium').length;
      const att = db.prepare(`
        SELECT SUM(a.status='present') AS present, SUM(a.status='late') AS late, COUNT(*) AS total
        FROM attendance a JOIN students s ON s.id = a.student_id
        WHERE a.date = ? AND s.school_id = ?
      `).get(today, school.id);
      return {
        id: school.id, name: school.name, district: school.district, package: school.package,
        students, girls, high, medium,
        attendanceToday: att.total ? Math.round((att.present + 0.5 * att.late) / att.total * 100) : null
      };
    });
    res.json(rows);
  }));

/* --------------------------------------------------------------- WEBHOOKS -- */

/**
 * Inbound SMS delivery-report webhook (called by the aggregator, e.g. Africa's
 * Talking). Public endpoint — protected by a shared secret when configured.
 * Updates the outbox so the dashboard shows true delivered/failed status.
 */
app.post('/api/webhooks/sms/delivery', wrap((req, res) => {
  if (config.messaging.webhookSecret) {
    const provided = req.get('X-Webhook-Secret') || req.query.token;
    if (provided !== config.messaging.webhookSecret) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
  }
  const b = req.body || {};
  const updated = messaging.applyDeliveryReport({
    providerRef: b.id || b.messageId || b.provider_ref,
    status: b.status
  });
  res.json({ ok: true, updated });
}));

/* ----------------------------------------------------------------- MISC -- */

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'safegirl-edutrack', time: new Date().toISOString() }));

// SPA fallback for non-API routes.
app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

if (require.main === module) {
  app.listen(config.port, config.host, () => {
    console.log(`SafeGirl EduTrack running at http://${config.host}:${config.port}`);
    console.log(`Messaging provider: ${config.messaging.provider}`);
  });
  // Counseling reminder dispatcher — runs on startup and on a timer.
  reminders.runReminders().then(r => {
    if (r.scheduled + r.followup > 0) console.log(`Reminders dispatched: ${JSON.stringify(r)}`);
  }).catch(err => console.error('reminder run failed:', err.message));
  setInterval(() => {
    reminders.runReminders().catch(err => console.error('reminder run failed:', err.message));
  }, config.reminderIntervalMs).unref();
}

module.exports = app;
