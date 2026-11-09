import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
const EXAMS = ["JEE Main", "JEE Advanced", "NEET UG"] as const;
function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI Study Coach is not configured. Set OPENAI_API_KEY in the server environment and restart the app. Rule-based insights remain available." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (!isRecord(body) || typeof body.exam !== "string" || !EXAMS.includes(body.exam as typeof EXAMS[number]) || typeof body.question !== "string" || body.question.trim().length < 2 || body.question.length > 2000 || !isRecord(body.studentData)) return NextResponse.json({ error: "Select JEE Main, JEE Advanced, or NEET UG and enter a question." }, { status: 400 });
  const snapshot = body.studentData;
  const safeData = JSON.stringify({ exam: body.exam, subjects: snapshot.subjects, chapters: snapshot.chapters, attemptCount: snapshot.attemptCount, answeredCount: snapshot.answeredCount, overallAccuracy: snapshot.overallAccuracy, recentScores: snapshot.recentScores, focusTodaySeconds: snapshot.focusTodaySeconds, focusWeekSeconds: snapshot.focusWeekSeconds, pendingRevisions: snapshot.pendingRevisions, overdueRevisions: snapshot.overdueRevisions, dueRevisionChapters: snapshot.dueRevisionChapters, mistakes: snapshot.mistakes, revisionEvents: snapshot.revisionEvents, commitments: snapshot.commitments, recommendations: snapshot.recommendations }).slice(0, 18000);
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const system = `You are SHUNYA, a careful AI study coach for ${body.exam} only. Use only the student data JSON provided and never invent scores, study events, profile facts, or data. If evidence is missing, say so plainly. Distinguish your suggestions from measured facts. Give specific, manageable advice, explain what to do and cite the relevant figures or records. Focus hours do not prove mastery. If asked why performance is decreasing, do not claim a trend unless multiple dated submitted scores support it. Use concise Markdown. This is advisory, not official exam guidance.`;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, temperature: 0.3, messages: [{ role: "system", content: system }, { role: "user", content: `Student data (JSON): ${safeData}\n\nQuestion: ${body.question.trim()}` }] }), signal: AbortSignal.timeout(60000) });
    const result: unknown = await response.json();
    if (!response.ok) { const message = isRecord(result) && isRecord(result.error) && typeof result.error.message === "string" ? result.error.message : "AI provider request failed."; return NextResponse.json({ error: message }, { status: response.status === 429 ? 429 : 502 }); }
    const choices = isRecord(result) && Array.isArray(result.choices) ? result.choices : [];
    const choice = choices[0]; const rawMessage = isRecord(choice) && isRecord(choice.message) ? choice.message.content : null;
    const answer = typeof rawMessage === "string" ? rawMessage : "";
    if (!answer.trim()) return NextResponse.json({ error: "AI provider returned an empty answer. Please retry." }, { status: 502 });
    return NextResponse.json({ answer, model });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error && cause.name === "TimeoutError" ? "Coach request timed out. Please retry." : "Could not reach the AI provider. No answer was generated." }, { status: 502 }); }
}
