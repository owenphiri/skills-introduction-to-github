// Thin wrapper around the Anthropic Messages API — deliberately not the
// @anthropic-ai/sdk package, since every caller here only needs one
// request/response shape and a raw fetch keeps this a dependency-free,
// fast-cold-starting Vercel function (matching the rest of this project,
// which has no build step or bundler).
const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

class AIConfigError extends Error {}
class AIUpstreamError extends Error {}

// system: string system prompt. userText: the user turn (string), or an
// array of {role,content} turns for multi-turn use (coding tutor).
// Returns the assistant's text reply as a plain string.
async function callClaude({ system, userText, turns, maxTokens = 2000, temperature = 0.4 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AIConfigError(
      "ANTHROPIC_API_KEY is not set on this deployment. Add it under Vercel Project Settings > Environment Variables, then redeploy."
    );
  }
  const messages = turns || [{ role: "user", content: userText }];
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      temperature,
      system,
      messages,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error?.message || `Anthropic API returned HTTP ${res.status}`;
    throw new AIUpstreamError(msg);
  }
  const text = (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return text;
}

// Same as callClaude, but asks the model to reply with JSON only and
// parses it — used by the structured generators (quiz, scheme of work).
// Throws AIUpstreamError if the model didn't return valid JSON.
async function callClaudeJSON(args) {
  const text = await callClaude(args);
  const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new AIUpstreamError("The AI did not return valid JSON. Try again — occasionally happens with long requests.");
  }
}

module.exports = { callClaude, callClaudeJSON, AIConfigError, AIUpstreamError };
