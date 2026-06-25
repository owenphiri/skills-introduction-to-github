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

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Small async wrapper so route handlers can throw / await safely.
const wrap = fn => (req, res) =>
  Promise.resolve(fn(req, res)).catch(err => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Internal error' });
  });

/* ------------------------------------------------------------------ AUTH -- */

app.post('/api/auth/login', wrap((req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !auth.verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = auth.createSession(user.id);
  res.json({
    token,
    user: { id: user.id, full_name: user.full_name, role: user.role, username: user.username }
  });
}));

app.post('/api/auth/logout', auth.authenticate, wrap((req, res) => {
  auth.destroySession(req.token);
  res.json({ ok: true });
}));

app.get('/api/auth/me', auth.authenticate, wrap((req, res) => res.json({ user: req.user })));

/* ----------------------------------------------------------------- USERS -- */

app.post('/api/users', auth.authenticate, auth.requireRole('admin'), wrap((req, res) => {
  const { full_name, username, password, role, phone } = req.body || {};
  if (!full_name || !username || !password || !role) {
    return res.status(400).json({ error: 'full_name, username, password and role are required' });
  }
  try {
    const info = db.prepare(
      'INSERT INTO users (full_name, username, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)'
    ).run(full_name, username, auth.hashPassword(password), role, phone || null);
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
  const cols = STUDENT_FIELDS.filter(f => b[f] !== undefined);
  const info = db.prepare(
    `INSERT INTO students (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
  ).run(...cols.map(c => b[c]));
  res.status(201).json(db.prepare('SELECT * FROM students WHERE id = ?').get(info.lastInsertRowid));
}));

app.get('/api/students', auth.authenticate, wrap((req, res) => {
  const { grade, q } = req.query;
  let sql = 'SELECT * FROM students WHERE active = 1';
  const params = [];
  if (grade) { sql += ' AND grade = ?'; params.push(grade); }
  if (q) { sql += ' AND full_name LIKE ?'; params.push(`%${q}%`); }
  sql += ' ORDER BY full_name';
  res.json(db.prepare(sql).all(...params));
}));

app.get('/api/students/:id', auth.authenticate, wrap((req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
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
    const body = templates.render(status, language, student.full_name);
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
        body: templates.render(r.status, language, student.full_name), language
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
        body: templates.render('results', language, student.full_name, Math.round(avg)), language
      });
    }
  }
  res.status(201).json(out);
}));

/* ------------------------------------------------------------ COUNSELING -- */

app.post('/api/counseling', auth.authenticate, auth.requireRole('admin', 'counselor', 'teacher'), wrap((req, res) => {
  const { student_id, type, notes, scheduled_date, follow_up_date, status } = req.body || {};
  if (!student_id || !type) return res.status(400).json({ error: 'student_id and type are required' });
  const info = db.prepare(`
    INSERT INTO counseling (student_id, type, notes, counselor_id, scheduled_date, follow_up_date, status)
    VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, 'open'))
  `).run(student_id, type, notes || null, req.user.id, scheduled_date || null, follow_up_date || null, status || null);
  res.status(201).json(db.prepare('SELECT * FROM counseling WHERE id = ?').get(info.lastInsertRowid));
}));

app.put('/api/counseling/:id', auth.authenticate, auth.requireRole('admin', 'counselor'), wrap((req, res) => {
  const { status, notes, follow_up_date } = req.body || {};
  db.prepare('UPDATE counseling SET status = COALESCE(?, status), notes = COALESCE(?, notes), follow_up_date = COALESCE(?, follow_up_date) WHERE id = ?')
    .run(status || null, notes || null, follow_up_date || null, req.params.id);
  res.json(db.prepare('SELECT * FROM counseling WHERE id = ?').get(req.params.id));
}));

app.get('/api/counseling', auth.authenticate, auth.requireRole('admin', 'counselor', 'teacher'), wrap((req, res) => {
  res.json(db.prepare(`
    SELECT c.*, s.full_name AS student_name, s.grade
    FROM counseling c JOIN students s ON s.id = c.student_id
    ORDER BY c.created_at DESC LIMIT 200
  `).all());
}));

/* ------------------------------------------------------------- MESSAGING -- */

/** Send an awareness / custom broadcast. */
app.post('/api/messages/broadcast', auth.authenticate,
  auth.requireRole('admin', 'counselor', 'district', 'community'), wrap(async (req, res) => {
    const { category = 'awareness', body, language = 'en', grade, channel = 'sms' } = req.body || {};
    if (!body) return res.status(400).json({ error: 'body is required' });
    let sql = "SELECT id, parent_phone FROM students WHERE active = 1 AND parent_phone IS NOT NULL AND parent_phone <> ''";
    const params = [];
    if (grade) { sql += ' AND grade = ?'; params.push(grade); }
    const recipients = db.prepare(sql).all(...params);
    let sent = 0;
    for (const r of recipients) {
      await messaging.send({ studentId: r.id, phone: r.parent_phone, category, body, language, channel });
      sent++;
    }
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

/* ------------------------------------------------------------- AWARENESS -- */

app.get('/api/awareness', auth.authenticate, wrap((req, res) => {
  const { language } = req.query;
  const sql = language ? 'SELECT * FROM awareness WHERE language = ?' : 'SELECT * FROM awareness';
  res.json((language ? db.prepare(sql).all(language) : db.prepare(sql).all()));
}));

/* ------------------------------------------------------- RISK & ANALYTICS -- */

app.get('/api/risk/:studentId', auth.authenticate, wrap((req, res) =>
  res.json(riskEngine.assess(Number(req.params.studentId)))));

app.get('/api/risk', auth.authenticate, wrap((req, res) =>
  res.json(riskEngine.assessAll({ minLevel: req.query.minLevel || 'medium' }))));

/** Headline dashboard analytics. */
app.get('/api/analytics/summary', auth.authenticate, wrap((req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const totalStudents = db.prepare('SELECT COUNT(*) AS n FROM students WHERE active = 1').get().n;
  const girls = db.prepare("SELECT COUNT(*) AS n FROM students WHERE active = 1 AND gender = 'F'").get().n;

  const todayRows = db.prepare('SELECT status, COUNT(*) AS n FROM attendance WHERE date = ? GROUP BY status').all(today);
  const todayMap = Object.fromEntries(todayRows.map(r => [r.status, r.n]));
  const marked = todayRows.reduce((s, r) => s + r.n, 0);
  const attendanceRateToday = marked ? Math.round(((todayMap.present || 0) + 0.5 * (todayMap.late || 0)) / marked * 100) : null;

  const atRisk = riskEngine.assessAll({ minLevel: 'medium' });
  const high = atRisk.filter(a => a.level === 'high').length;
  const medium = atRisk.filter(a => a.level === 'medium').length;

  const interventions = db.prepare('SELECT COUNT(*) AS n FROM counseling').get().n;
  const resolved = db.prepare("SELECT COUNT(*) AS n FROM counseling WHERE status = 'resolved'").get().n;
  const messagesSent = db.prepare('SELECT COUNT(*) AS n FROM messages').get().n;

  res.json({
    totalStudents, girls,
    attendanceRateToday, markedToday: marked,
    risk: { high, medium, low: totalStudents - high - medium },
    interventions, resolvedInterventions: resolved,
    messagesSent
  });
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
}

module.exports = app;
