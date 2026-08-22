const { AIConfigError, AIUpstreamError } = require("./anthropic");

// Wraps a POST-only JSON handler with consistent method/error handling so
// each api/ai/*.js file only needs to write its actual logic.
function jsonHandler(fn) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed — use POST." });
      return;
    }
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const result = await fn(body, req);
      res.status(200).json(result);
    } catch (e) {
      if (e instanceof AIConfigError) {
        res.status(500).json({ error: e.message, code: "ai_not_configured" });
      } else if (e instanceof AIUpstreamError) {
        res.status(502).json({ error: e.message, code: "ai_upstream_error" });
      } else if (e && e.status === 400) {
        res.status(400).json({ error: e.message });
      } else {
        console.error(e);
        res.status(500).json({ error: "Unexpected server error." });
      }
    }
  };
}

function badRequest(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

module.exports = { jsonHandler, badRequest };
