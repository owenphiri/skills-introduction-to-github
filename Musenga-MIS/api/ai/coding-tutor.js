const { callClaude } = require("../_lib/anthropic");
const { logUsage } = require("../_lib/usage");
const { jsonHandler, badRequest } = require("../_lib/handler");

const SYSTEM = `You are a patient, encouraging coding tutor for a secondary school student at Musenga Day Secondary School, studying Computer Studies. Teach Socratically: ask guiding questions, point out what's working before what isn't, and let the student write and fix their own code — do not just hand over a complete solution unless they are clearly stuck after a genuine attempt. Keep replies short (a few sentences plus a small code snippet at most) and encouraging. If the student pastes code, review it for bugs and explain the reasoning, not just the fix. Assume introductory level (variables, loops, conditionals, functions, basic Python or web basics) unless the conversation shows otherwise.`;

const MAX_TURNS = 20;

module.exports = jsonHandler(async (body) => {
  const history = Array.isArray(body.messages) ? body.messages : [];
  if (!history.length) throw badRequest("messages array is required.");
  const turns = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.trim() }));
  if (!turns.length || turns[turns.length - 1].role !== "user") {
    throw badRequest("The last message must be from the student (role: user).");
  }

  const reply = await callClaude({
    system: SYSTEM,
    turns,
    maxTokens: 800,
    temperature: 0.6,
  });

  await logUsage({ schoolId: body.schoolId, endpoint: "coding-tutor", role: body.role });
  return { reply };
});
