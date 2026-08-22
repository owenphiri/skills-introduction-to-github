const { callClaudeJSON } = require("../_lib/anthropic");
const { logUsage } = require("../_lib/usage");
const { jsonHandler, badRequest } = require("../_lib/handler");

const SYSTEM = `You are a curriculum-planning assistant for a Zambian secondary school (Musenga Day Secondary School), aligned with the Zambian Ministry of Education curriculum framework. You write schemes of work for a subject teacher to actually use in class — concrete, gradable, and appropriately paced for the stated grade level. Reply with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:
{"subject":string,"grade":string,"term":string,"weeks":[{"week":number,"topic":string,"objectives":[string],"activities":string,"resources":string,"assessment":string}]}`;

module.exports = jsonHandler(async (body) => {
  const subject = String(body.subject || "").trim();
  const grade = String(body.grade || "").trim();
  const term = String(body.term || "Term 1").trim();
  const weeks = Math.min(16, Math.max(1, parseInt(body.weeks, 10) || 12));
  if (!subject || !grade) throw badRequest("subject and grade are required.");

  const scheme = await callClaudeJSON({
    system: SYSTEM,
    userText: `Subject: ${subject}\nGrade/Class: ${grade}\nTerm: ${term}\nNumber of weeks: ${weeks}\n\nProduce the full ${weeks}-week scheme of work now.`,
    maxTokens: 4000,
  });

  await logUsage({ schoolId: body.schoolId, endpoint: "scheme-of-work", role: body.role });
  return scheme;
});
