import { NextRequest } from "next/server";
import { apiJson, checkAiRateLimit, rateLimitResponse, readBoundedJson } from "@/lib/server/aiApiSecurity";

export const runtime = "nodejs";
const EXAMS = ["JEE Main", "JEE Advanced", "NEET UG"] as const;
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_CONTEXT_BYTES = 18_000;

function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function boundedString(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= maxLength &&
    (allowEmpty || value.trim().length > 0) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}
function count(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function finiteScore(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1_000_000_000; }
function nonNegativeScore(value: unknown): value is number { return finiteScore(value) && value >= 0; }
function percent(value: unknown): value is number | null { return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100); }
function validRows(value: unknown, maxLength: number, validate: (item: unknown) => boolean): value is unknown[] {
  return Array.isArray(value) && value.length <= maxLength && value.every(validate);
}
function validSubject(value: unknown): boolean {
  return isRecord(value) && boundedString(value.subject, 100) && count(value.attempted) &&
    count(value.correct) && value.correct <= value.attempted && percent(value.accuracy) &&
    count(value.testCount);
}
function validChapter(value: unknown): boolean {
  return isRecord(value) && boundedString(value.subject, 100) && boundedString(value.chapter, 160, true) &&
    count(value.attempted) && count(value.correct) && value.correct <= value.attempted &&
    percent(value.accuracy) && count(value.testCount) && percent(value.recentAccuracy) && percent(value.previousAccuracy);
}
function validRecentScore(value: unknown): boolean {
  return isRecord(value) && boundedString(value.test, 160) && boundedString(value.date, 40) &&
    finiteScore(value.marks) && nonNegativeScore(value.total) && percent(value.accuracy);
}
function validTextRecord(value: unknown, fields: string[]): boolean {
  return isRecord(value) && fields.every((field) => boundedString(value[field], field === "action" || field === "evidence" ? 1000 : 240));
}
function validStudentData(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return validRows(value.subjects, 12, validSubject) &&
    validRows(value.chapters, 100, validChapter) && count(value.attemptCount) && count(value.answeredCount) &&
    percent(value.overallAccuracy) && validRows(value.recentScores, 10, validRecentScore) &&
    count(value.focusTodaySeconds) && count(value.focusWeekSeconds) && count(value.pendingRevisions) &&
    count(value.overdueRevisions) &&
    validRows(value.dueRevisionChapters, 100, (item) => boundedString(item, 160)) &&
    validRows(value.mistakes, 100, (item) => validTextRecord(item, ["subject", "chapter", "topic", "category", "status"])) &&
    validRows(value.revisionEvents, 100, (item) => isRecord(item) && boundedString(item.subject, 100) &&
      boundedString(item.chapter, 160, true) && boundedString(item.date, 40) && count(item.durationMinutes)) &&
    validRows(value.commitments, 100, (item) => isRecord(item) && boundedString(item.title, 160) &&
      boundedString(item.subject, 100, true) && boundedString(item.chapter, 160, true) &&
      boundedString(item.date, 40) && boundedString(item.status, 40)) &&
    validRows(value.recommendations, 30, (item) => isRecord(item) && boundedString(item.id, 180) &&
      boundedString(item.title, 240) && boundedString(item.action, 1000) && boundedString(item.reason, 1000) &&
      boundedString(item.evidence, 1000) && (item.subject === undefined || boundedString(item.subject, 100)) &&
      (item.chapter === undefined || boundedString(item.chapter, 160)));
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return apiJson({ error: "AI service is temporarily unavailable." }, 503);

  const rateLimit = await checkAiRateLimit(request, "study-coach", [
    { windowSeconds: 60, limit: 8 },
    { windowSeconds: 86400, limit: 60 }
  ]);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  const parsed = await readBoundedJson(request, MAX_REQUEST_BYTES);
  if (!parsed.ok) {
    const message = parsed.status === 413 ? "Request body exceeds the allowed size." : parsed.status === 415 ? "Request must use application/json." : "Request body must be valid JSON.";
    return apiJson({ error: message }, parsed.status);
  }
  const body = parsed.value;
  if (!isRecord(body) || typeof body.exam !== "string" || !EXAMS.includes(body.exam as typeof EXAMS[number]) ||
    !boundedString(body.question, 2000) || !validStudentData(body.studentData)) {
    return apiJson({ error: "Select a supported exam, enter a question, and provide a valid study snapshot." }, 400);
  }
  const snapshot = body.studentData;
  const safeData = JSON.stringify({ exam: body.exam, subjects: snapshot.subjects, chapters: snapshot.chapters, attemptCount: snapshot.attemptCount, answeredCount: snapshot.answeredCount, overallAccuracy: snapshot.overallAccuracy, recentScores: snapshot.recentScores, focusTodaySeconds: snapshot.focusTodaySeconds, focusWeekSeconds: snapshot.focusWeekSeconds, pendingRevisions: snapshot.pendingRevisions, overdueRevisions: snapshot.overdueRevisions, dueRevisionChapters: snapshot.dueRevisionChapters, mistakes: snapshot.mistakes, revisionEvents: snapshot.revisionEvents, commitments: snapshot.commitments, recommendations: snapshot.recommendations });
  if (new TextEncoder().encode(safeData).byteLength > MAX_CONTEXT_BYTES) {
    return apiJson({ error: "Study snapshot exceeds the allowed size. Please reduce the data and retry." }, 400);
  }
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const system = `You are SHUNYA, a careful AI study coach for ${body.exam} only. Use only the student data JSON provided and never invent scores, study events, profile facts, or data. If evidence is missing, say so plainly. Distinguish your suggestions from measured facts. Give specific, manageable advice, explain what to do and cite the relevant figures or records. Focus hours do not prove mastery. If asked why performance is decreasing, do not claim a trend unless multiple dated submitted scores support it. Use concise Markdown. This is advisory, not official exam guidance.`;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, temperature: 0.3, messages: [{ role: "system", content: system }, { role: "user", content: `Student data (JSON): ${safeData}\n\nQuestion: ${body.question.trim()}` }] }), signal: AbortSignal.timeout(60000) });
    const result: unknown = await response.json();
    if (!response.ok) return apiJson({ error: "AI provider is temporarily unavailable. Please try again later." }, response.status === 429 ? 503 : 502);
    const choices = isRecord(result) && Array.isArray(result.choices) ? result.choices : [];
    const choice = choices[0]; const rawMessage = isRecord(choice) && isRecord(choice.message) ? choice.message.content : null;
    const answer = typeof rawMessage === "string" ? rawMessage : "";
    if (!answer.trim()) return apiJson({ error: "AI provider returned no answer. Please retry." }, 502);
    return apiJson({ answer, model });
  } catch { return apiJson({ error: "AI request failed. Please try again later." }, 502); }
}
