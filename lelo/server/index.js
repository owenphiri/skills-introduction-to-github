'use strict';

/** Local / container entry point. Vercel uses api/index.js instead. */
const app = require('./app');
const config = require('./config');

app.listen(config.port, config.host, () => {
  console.log(`${config.serviceName} listening on http://${config.host}:${config.port}`);
  console.log(`USSD webhook:     POST /api/ussd`);
  console.log(`WhatsApp webhook: GET|POST /api/whatsapp/webhook`);
  console.log(`PSP webhook:      POST /api/payments/webhook`);
});
