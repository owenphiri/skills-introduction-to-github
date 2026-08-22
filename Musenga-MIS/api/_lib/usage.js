// Optional, fire-and-forget usage logging to Supabase. This exists purely
// to make the AI layer multi-tenant-ready (every row is scoped by
// school_id) without requiring a Supabase project to use the AI features
// at all — if SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren't set, or the
// request fails, this silently no-ops. Never throws, never blocks the
// actual API response on its own success/failure.
async function logUsage({ schoolId, endpoint, role }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return; // Supabase not configured — fine, AI features still work.
  try {
    await fetch(`${url.replace(/\/+$/, "")}/rest/v1/ai_usage`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: key,
        authorization: `Bearer ${key}`,
        prefer: "return=minimal",
      },
      body: JSON.stringify({
        school_id: schoolId || "musenga",
        endpoint,
        role: role || "unknown",
        created_at: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("usage logging failed (non-fatal):", e.message);
  }
}

module.exports = { logUsage };
