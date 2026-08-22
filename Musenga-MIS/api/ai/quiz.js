const { callClaudeJSON, AIUpstreamError } = require("../_lib/anthropic");
const { logUsage } = require("../_lib/usage");
const { jsonHandler, badRequest } = require("../_lib/handler");

const SYSTEM = `You are a quiz-writing assistant for a Zambian secondary school (Musenga Day Secondary School). Write multiple-choice practice questions pitched correctly for the stated grade level, each with exactly 4 answer choices, one correct answer, and a short explanation a student can learn from. Reply with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:
{"subject":string,"topic":string,"grade":string,"questions":[{"question":string,"choices":[string,string,string,string],"correctIndex":number,"explanation":string}]}
correctIndex is 0-based (0,1,2, or 3), pointing into that question's own "choices" array.`;

module.exports = jsonHandler(async (body) => {
  const subject = String(body.subject || "").trim();
  const topic = String(body.topic || "").trim();
  const grade = String(body.grade || "").trim();
  const count = Math.min(20, Math.max(3, parseInt(body.count, 10) || 10));
  const difficulty = ["easy", "medium", "hard"].includes(body.difficulty) ? body.difficulty : "medium";
  if (!subject || !topic || !grade) throw badRequest("subject, topic and grade are required.");

  const quiz = await callClaudeJSON({
    system: SYSTEM,
    userText: `Subject: ${subject}\nTopic: ${topic}\nGrade/Class: ${grade}\nDifficulty: ${difficulty}\nNumber of questions: ${count}\n\nProduce the full quiz now.`,
    maxTokens: 3500,
  });

  // Belt-and-braces validation: a malformed correctIndex would silently
  // break client-side grading, so reject rather than ship a broken quiz.
  if (!Array.isArray(quiz.questions) || !quiz.questions.length) throw new AIUpstreamError("The AI returned no questions. Try again.");
  for (const q of quiz.questions) {
    if (!Array.isArray(q.choices) || q.choices.length !== 4 || typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 3) {
      throw new AIUpstreamError("The AI returned a malformed question. Try again.");
    }
  }

  await logUsage({ schoolId: body.schoolId, endpoint: "quiz", role: body.role });
  return quiz;
});
