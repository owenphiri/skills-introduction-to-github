'use strict';

/**
 * Counseling reminder dispatcher.
 *
 * Sends an SMS to the guardian when a counseling session is due (scheduled_date
 * on/before today) and again for a follow-up (follow_up_date on/before today),
 * exactly once each — tracked by the reminded_scheduled / reminded_followup
 * flags so the dispatcher is safe to run repeatedly (idempotent).
 *
 * Runs on a timer (see app.js) and can be triggered manually by an admin.
 */
const db = require('./db');
const messaging = require('./messaging');
const templates = require('./templates');

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Dispatch all due reminders.
 * @returns {Promise<{scheduled:number, followup:number}>} counts sent.
 */
async function runReminders({ language = 'en' } = {}) {
  const t = today();
  let scheduled = 0;
  let followup = 0;

  // Due sessions not yet reminded, for open/in-progress cases only.
  const due = db.prepare(`
    SELECT c.id, c.scheduled_date, c.follow_up_date, c.reminded_scheduled, c.reminded_followup,
           s.full_name, s.parent_phone, s.id AS student_id
    FROM counseling c JOIN students s ON s.id = c.student_id
    WHERE c.status IN ('open','in_progress')
      AND s.parent_phone IS NOT NULL AND s.parent_phone <> ''
  `).all();

  for (const c of due) {
    if (c.scheduled_date && c.scheduled_date <= t && !c.reminded_scheduled) {
      await messaging.send({
        studentId: c.student_id, phone: c.parent_phone, category: 'counseling',
        body: templates.render('counseling', language, { name: c.full_name, date: c.scheduled_date }),
        language
      });
      db.prepare('UPDATE counseling SET reminded_scheduled = 1 WHERE id = ?').run(c.id);
      scheduled++;
    }
    if (c.follow_up_date && c.follow_up_date <= t && !c.reminded_followup) {
      await messaging.send({
        studentId: c.student_id, phone: c.parent_phone, category: 'counseling',
        body: templates.render('counseling', language, { name: c.full_name, date: c.follow_up_date }),
        language
      });
      db.prepare('UPDATE counseling SET reminded_followup = 1 WHERE id = ?').run(c.id);
      followup++;
    }
  }
  return { scheduled, followup };
}

module.exports = { runReminders };
