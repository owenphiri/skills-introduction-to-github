'use strict';

/**
 * The daily run: charge, compose, deliver.
 *
 * Written as a resumable batch rather than a single sweep. A serverless
 * invocation has a wall-clock limit measured in seconds, and a subscriber
 * base measured in hundreds of thousands does not fit inside one. The caller
 * passes `afterId` from the previous response until `done` comes back true,
 * so the job survives a timeout without re-billing anyone (the ledger's
 * idempotency key does the rest).
 *
 * Order matters: charge first, deliver second. If delivery fails we can
 * re-send; if we deliver and then fail to charge, we have given the day away.
 * A charge with no delivery is refunded by the reversal path below.
 */
const db = require('./db');
const config = require('./config');
const money = require('./money');
const wallet = require('./wallet');
const content = require('./content');
const messaging = require('./messaging');

/**
 * One batch of the daily run.
 *
 * @returns {{date, processed, delivered, charged, trial, skipped, lowBalance, nudged, failed, lastId, done}}
 */
async function runDaily({ date = db.today(), batchSize = 200, afterId = 0, channel = 'sms' } = {}) {
  const stats = {
    date, processed: 0, delivered: 0, charged: 0, trial: 0,
    skipped: 0, lowBalance: 0, nudged: 0, failed: 0, segments: 0,
    lastId: afterId, done: false
  };

  const batch = db.prepare(`
    SELECT * FROM subscribers
     WHERE id > ?
       AND consent_at IS NOT NULL
       AND status != 'stopped'
     ORDER BY id
     LIMIT ?
  `).all(afterId, batchSize);

  for (const sub of batch) {
    stats.processed++;
    stats.lastId = sub.id;

    const charge = wallet.chargeDay(sub.id, date);

    if (!charge.ok) {
      if (charge.reason === 'no_credit') {
        stats.lowBalance++;
        // A subscriber out of credit gets one nudge, not a daily nag: the
        // per-day duplicate guard in messaging.send() enforces that, and the
        // nudge is only sent on the day the balance actually runs out.
        const ran_out_today = !messaging.alreadySentToday(sub.id, channel, date);
        if (ran_out_today) {
          const res = await messaging.send({
            subscriber: sub, channel, date,
            body: `${config.serviceName}: your credit is finished. ` +
                  `Dial ${config.shortCode} and choose Top up - K7 for a week, K30 for a month. ` +
                  'No credit, no charge.'
          });
          if (res.sent) stats.nudged++;
        }
      } else {
        stats.skipped++;
      }
      continue;
    }

    if (charge.reason === 'charged') stats.charged++;
    if (charge.reason === 'trial') stats.trial++;

    const digest = content.buildDigest(sub, date, {
      balanceNgwee: charge.reason === 'trial' ? null : charge.balance
    });

    // Nothing published for this subscriber's topics today. Do not send an
    // empty digest, and hand the day back — they were charged for content.
    if (digest.itemCount === 0) {
      if (charge.reason === 'charged') {
        wallet.post(sub.id, 'reversal', config.dailyPriceNgwee, `rev:${sub.id}:${date}`,
          `No content published ${date}`);
        stats.charged--;
      }
      stats.skipped++;
      continue;
    }

    const res = await messaging.send({ subscriber: sub, channel, date, body: digest.body });
    if (res.sent) {
      stats.delivered++;
      stats.segments += res.segments || 1;
    } else if (res.reason === 'already_sent') {
      stats.skipped++;
    } else {
      stats.failed++;
      // Delivery failed after a successful charge. Give the day back rather
      // than argue with a subscriber about a bulletin they never received.
      if (charge.reason === 'charged') {
        wallet.post(sub.id, 'reversal', config.dailyPriceNgwee, `rev:${sub.id}:${date}`,
          `Delivery failed ${date}`);
        stats.charged--;
      }
    }
  }

  stats.done = batch.length < batchSize;
  return stats;
}

/** Run every batch to completion. Used by the CLI and by a long-lived worker. */
async function runDailyToCompletion(opts = {}) {
  let afterId = 0;
  const total = { processed: 0, delivered: 0, charged: 0, trial: 0, skipped: 0, lowBalance: 0, nudged: 0, failed: 0, segments: 0 };
  for (;;) {
    const s = await runDaily({ ...opts, afterId });
    for (const k of Object.keys(total)) total[k] += s[k];
    afterId = s.lastId;
    if (s.done) break;
  }
  return { date: opts.date || db.today(), ...total };
}

/** Revenue and cost for one day, in ngwee. */
function dailySummary(date = db.today()) {
  const charged = db.prepare(
    "SELECT COALESCE(SUM(-amount_ngwee),0) AS n, COUNT(*) AS c FROM ledger_entries WHERE kind = 'daily_charge' AND ref LIKE ?"
  ).get(`day:%:${date}`);
  const reversed = db.prepare(
    "SELECT COALESCE(SUM(amount_ngwee),0) AS n FROM ledger_entries WHERE kind = 'reversal' AND ref LIKE ?"
  ).get(`rev:%:${date}`);
  const topups = db.prepare(
    "SELECT COALESCE(SUM(amount_ngwee),0) AS n, COUNT(*) AS c FROM payments WHERE status = 'succeeded' AND date(settled_at) = ?"
  ).get(date);
  const sent = db.prepare(
    "SELECT COUNT(*) AS c, COALESCE(SUM(segments),0) AS seg FROM deliveries WHERE sent_on = ? AND status != 'failed'"
  ).get(date);

  return {
    date,
    recognisedRevenueNgwee: charged.n - reversed.n,
    daysBilled: charged.c,
    reversalsNgwee: reversed.n,
    cashCollectedNgwee: topups.n,
    topupCount: topups.c,
    messagesSent: sent.c,
    smsSegments: sent.seg,
    // Deferred revenue: credit sold but not yet consumed. This is a liability,
    // not income, and the distinction matters to both ZRA and any investor.
    unearnedCreditNgwee: db.prepare('SELECT COALESCE(SUM(balance_ngwee),0) AS n FROM wallet_accounts').get().n
  };
}

module.exports = { runDaily, runDailyToCompletion, dailySummary };

/* CLI: npm run billing [YYYY-MM-DD] */
if (require.main === module) {
  const date = process.argv[2] || db.today();
  runDailyToCompletion({ date })
    .then(s => {
      console.log(`Daily run ${s.date}`);
      console.table(s);
      console.table(dailySummary(date));
      const sum = dailySummary(date);
      console.log(`Recognised revenue: ${money.format(sum.recognisedRevenueNgwee)}`);
    })
    .catch(err => { console.error(err); process.exit(1); });
}
