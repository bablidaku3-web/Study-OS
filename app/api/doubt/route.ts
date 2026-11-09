import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const EXAMS = ["JEE", "NEET", "CA", "UPSC"] as const;
const MODES = ["Explain Simply", "Step-by-Step Solution", "Concept Explanation", "Shortcut Method", "Similar Practice Questions"] as const;
const MAX_QUESTION_CHARS = 10000;
const MAX_IMAGE_BASE64_CHARS = 3_500_000;

function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI is not configured. Add OPENAI_API_KEY to the server environment and restart the app." }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (!isRecord(body)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { exam, subject, chapter, topic, mode, question, image } = body;
  if (typeof exam !== "string" || !EXAMS.includes(exam as typeof EXAMS[number]) || typeof mode !== "string" || !MODES.includes(mode as typeof MODES[number])) {
    return NextResponse.json({ error: "Select a supported exam and learning mode." }, { status: 400 });
  }
  if (typeof subject !== "string" || subject.trim().length < 1 || subject.length > 100 || typeof question !== "string" || question.trim().length < 2 || question.length > MAX_QUESTION_CHARS) {
    return NextResponse.json({ error: "Subject and question are required; question must be at most 10,000 characters." }, { status: 400 });
  }
  let imagePart: { type: "image_url"; image_url: { url: string; detail: "auto" } } | null = null;
  if (image !== undefined && image !== null) {
    if (!isRecord(image) || typeof image.dataUrl !== "string" || typeof image.mimeType !== "string" || typeof image.name !== "string") {
      return NextResponse.json({ error: "Invalid image upload." }, { status: 400 });
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.mimeType)) return NextResponse.json({ error: "Only JPEG, PNG, and WebP images are supported." }, { status: 400 });
    const prefix = `data:${image.mimeType};base64,`;
    if (!image.dataUrl.startsWith(prefix) || image.dataUrl.length > MAX_IMAGE_BASE64_CHARS) return NextResponse.json({ error: "Image is invalid or exceeds the 2.5 MB limit." }, { status: 400 });
    imagePart = { type: "image_url", image_url: { url: image.dataUrl, detail: "auto" } };
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const context = `Exam: ${exam}. Subject: ${subject.trim()}. Chapter: ${typeof chapter === "string" ? chapter.slice(0, 100) : "not specified"}. Topic: ${typeof topic === "string" ? topic.slice(0, 100) : "not specified"}. Requested learning mode: ${mode}.`;
  const instruction = `You are a careful academic tutor for Indian exam preparation. Give accurate, age-appropriate help. Adapt depth to ${exam} and the selected subject. Use readable Markdown and display equations in LaTeX delimiters. If the image or question is unclear, say what is unclear and ask for a clearer question rather than guessing. Do not claim certainty where uncertain. Do not claim to know the student's thought process. For Similar Practice Questions, provide 3 new questions and do not invent a student's past performance. Context: ${context}`;
  const content = imagePart ? [{ type: "text", text: `${instruction}\n\nQuestion text: ${question.trim() || "Please read and solve the question in this image."}` }, imagePart] : `${instruction}\n\nQuestion: ${question.trim()}`;
  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content }], temperature: 0.2 }),
      signal: AbortSignal.timeout(60000)
    });
    const result: unknown = await upstream.json();
    if (!upstream.ok) {
      const providerMessage = isRecord(result) && isRecord(result.error) && typeof result.error.message === "string" ? result.error.message : "AI provider request failed.";
      return NextResponse.json({ error: providerMessage }, { status: upstream.status === 429 ? 429 : 502 });
    }
    const choices = isRecord(result) && Array.isArray(result.choices) ? result.choices : [];
    const choice = choices[0];
    const message = isRecord(choice) && isRecord(choice.message) ? choice.message.content : null;
    const answer = typeof message === "string" ? message : Array.isArray(message) ? message.filter((part) => isRecord(part) && typeof part.text === "string").map((part) => (part as { text: string }).text).join("\n") : "";
    if (!answer.trim()) return NextResponse.json({ error: "AI provider returned an empty answer. Please try again." }, { status: 502 });
    return NextResponse.json({ answer, model });
  } catch (cause) {
    const message = cause instanceof Error && cause.name === "TimeoutError" ? "The AI request timed out. Please try again." : "Could not reach the AI provider. Check server configuration and network access.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
