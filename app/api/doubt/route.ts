import { NextRequest } from "next/server";
import { apiJson, checkAiRateLimit, rateLimitResponse, readBoundedJson } from "@/lib/server/aiApiSecurity";

export const runtime = "nodejs";
const EXAMS = ["JEE", "NEET", "CA", "UPSC"] as const;
const MODES = ["Explain Simply", "Step-by-Step Solution", "Concept Explanation", "Shortcut Method", "Similar Practice Questions"] as const;
const MAX_QUESTION_CHARS = 10000;
const MAX_IMAGE_BASE64_CHARS = 3_500_000;
const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024;
const MAX_REQUEST_BYTES = 3_750_000;

function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function validText(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= maxLength &&
    (allowEmpty || value.trim().length > 0) && !/[\u0000-\u001f\u007f]/.test(value);
}
function matchesImageSignature(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return mimeType === "image/webp" && bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return apiJson({ error: "AI service is temporarily unavailable." }, 503);

  const rateLimit = await checkAiRateLimit(request, "doubt", [
    { windowSeconds: 60, limit: 5 },
    { windowSeconds: 86400, limit: 40 }
  ]);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  const parsed = await readBoundedJson(request, MAX_REQUEST_BYTES);
  if (!parsed.ok) {
    const message = parsed.status === 413 ? "Request body exceeds the allowed size." : parsed.status === 415 ? "Request must use application/json." : "Request body must be valid JSON.";
    return apiJson({ error: message }, parsed.status);
  }
  const body = parsed.value;
  if (!isRecord(body)) return apiJson({ error: "Invalid request." }, 400);
  const { exam, subject, chapter, topic, mode, question, image } = body;
  if (typeof exam !== "string" || !EXAMS.includes(exam as typeof EXAMS[number]) || typeof mode !== "string" || !MODES.includes(mode as typeof MODES[number])) {
    return apiJson({ error: "Select a supported exam and learning mode." }, 400);
  }
  const hasImage = image !== undefined && image !== null;
  if (!validText(subject, 100) || !validText(question, MAX_QUESTION_CHARS, true) ||
    (question.trim().length < 2 && !hasImage) ||
    (chapter !== undefined && !validText(chapter, 100, true)) ||
    (topic !== undefined && !validText(topic, 100, true))) {
    return apiJson({ error: "Enter a valid subject and question; questions are limited to 10,000 characters." }, 400);
  }
  let imagePart: { type: "image_url"; image_url: { url: string; detail: "auto" } } | null = null;
  if (hasImage) {
    if (!isRecord(image) || typeof image.dataUrl !== "string" || typeof image.mimeType !== "string" || typeof image.name !== "string") {
      return apiJson({ error: "Invalid image upload." }, 400);
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.mimeType) || !validText(image.name, 160)) {
      return apiJson({ error: "Only named JPEG, PNG, and WebP images are supported." }, 400);
    }
    const prefix = `data:${image.mimeType};base64,`;
    if (!image.dataUrl.startsWith(prefix) || image.dataUrl.length > MAX_IMAGE_BASE64_CHARS) {
      return apiJson({ error: "Image is invalid or exceeds the 2.5 MB limit." }, 400);
    }
    const encoded = image.dataUrl.slice(prefix.length);
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      return apiJson({ error: "Image data is invalid." }, 400);
    }
    const imageBytes = Buffer.from(encoded, "base64");
    if (imageBytes.length === 0 || imageBytes.length > MAX_IMAGE_BYTES || imageBytes.toString("base64") !== encoded || !matchesImageSignature(imageBytes, image.mimeType)) {
      return apiJson({ error: "Image data is invalid or exceeds the 2.5 MB limit." }, 400);
    }
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
      return apiJson({ error: "AI provider is temporarily unavailable. Please try again later." }, upstream.status === 429 ? 503 : 502);
    }
    const choices = isRecord(result) && Array.isArray(result.choices) ? result.choices : [];
    const choice = choices[0];
    const message = isRecord(choice) && isRecord(choice.message) ? choice.message.content : null;
    const answer = typeof message === "string" ? message : Array.isArray(message) ? message.filter((part) => isRecord(part) && typeof part.text === "string").map((part) => (part as { text: string }).text).join("\n") : "";
    if (!answer.trim()) return apiJson({ error: "AI provider returned no answer. Please try again." }, 502);
    return apiJson({ answer, model });
  } catch {
    return apiJson({ error: "AI request failed. Please try again later." }, 502);
  }
}
