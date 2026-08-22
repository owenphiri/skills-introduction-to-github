const { callClaudeJSON } = require("../_lib/anthropic");
const { logUsage } = require("../_lib/usage");
const { jsonHandler, badRequest } = require("../_lib/handler");

const SYSTEM = `You are a lesson-planning assistant for a Zambian secondary school teacher (Musenga Day Secondary School). Produce one detailed, classroom-ready lesson plan for a single period. Be concrete: real activities, real questions, a real assessment task — not generic filler. Reply with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:
{"subject":string,"topic":string,"grade":string,"durationMins":number,"objectives":[string],"priorKnowledge":string,"introduction":string,"development":[{"step":string,"teacherActivity":string,"learnerActivity":string,"timeMins":number}],"assessment":string,"conclusion":string,"resources":[string],"homework":string}`;

module.exports = jsonHandler(async (body) => {
  const subject = String(body.subject || "").trim();
  const topic = String(body.topic || "").trim();
  const grade = String(body.grade || "").trim();
  const duration = Math.min(120, Math.max(20, parseInt(body.durationMins, 10) || 40));
  if (!subject || !topic || !grade) throw badRequest("subject, topic and grade are required.");

  const plan = await callClaudeJSON({
    system: SYSTEM,
    userText: `Subject: ${subject}\nTopic: ${topic}\nGrade/Class: ${grade}\nPeriod length: ${duration} minutes\n\nProduce the full lesson plan now.`,
    maxTokens: 2500,
  });

  await logUsage({ schoolId: body.schoolId, endpoint: "lesson-plan", role: body.role });
  return plan;
});
