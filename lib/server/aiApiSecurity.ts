import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

type RatePolicy = { windowSeconds: number; limit: number };
type Counter = { count: number; resetAt: number };
type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: number } | { allowed: false; unavailable: true };
type JsonBodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 | 415 };

const memoryCounters = new Map<string, Counter>();
const redisScript = `
local denied = 0
local retry = 0
local keyCount = #KEYS
for i = 1, keyCount do
  local count = redis.call("INCR", KEYS[i])
  local window = tonumber(ARGV[i])
  if count == 1 then redis.call("EXPIRE", KEYS[i], window) end
  local ttl = redis.call("TTL", KEYS[i])
  if ttl < 0 then redis.call("EXPIRE", KEYS[i], window); ttl = window end
  local limit = tonumber(ARGV[keyCount + i])
  if count > limit then
    denied = 1
    if ttl > retry then retry = ttl end
  end
end
return {1 - denied, retry}
`;

function clientAddress(request: NextRequest): string | null {
  const address = request.ip;
  if (!address && process.env.NODE_ENV !== "production") return "local-development";
  if (!address || address.length > 128 || /[\r\n\s]/.test(address)) return null;
  return address;
}

function digestAddress(address: string, secret: string): string {
  return createHmac("sha256", secret).update(address).digest("hex");
}

function memoryRateLimit(scope: string, digest: string, policies: RatePolicy[]): RateLimitResult {
  const now = Date.now();
  for (const [key, counter] of memoryCounters) {
    if (counter.resetAt <= now) memoryCounters.delete(key);
  }
  let retryAfter = 0;
  for (const policy of policies) {
    const bucket = Math.floor(now / (policy.windowSeconds * 1000));
    const key = `${scope}:${digest}:${policy.windowSeconds}:${bucket}`;
    const resetAt = (bucket + 1) * policy.windowSeconds * 1000;
    const counter = memoryCounters.get(key) || { count: 0, resetAt };
    counter.count += 1;
    memoryCounters.set(key, counter);
    if (counter.count > policy.limit) retryAfter = Math.max(retryAfter, Math.ceil((resetAt - now) / 1000));
  }
  if (memoryCounters.size > 5000) {
    for (const [key, counter] of memoryCounters) {
      if (counter.resetAt <= now) memoryCounters.delete(key);
    }
  }
  return retryAfter > 0 ? { allowed: false, retryAfter } : { allowed: true };
}

export async function checkAiRateLimit(request: NextRequest, scope: string, policies: RatePolicy[]): Promise<RateLimitResult> {
  const address = clientAddress(request);
  if (!address) return { allowed: false, unavailable: true };

  const endpoint = process.env.RATE_LIMIT_REDIS_REST_URL;
  const token = process.env.RATE_LIMIT_REDIS_REST_TOKEN;
  const secret = process.env.RATE_LIMIT_HMAC_SECRET;
  const production = process.env.NODE_ENV === "production";

  if (!endpoint && !token && !secret && !production) {
    return memoryRateLimit(scope, digestAddress(address, "shunya-local-rate-limit"), policies);
  }
  if (!endpoint || !token || !secret || secret.length < 32) return { allowed: false, unavailable: true };

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { allowed: false, unavailable: true };
  }
  if (url.protocol !== "https:") return { allowed: false, unavailable: true };

  const now = Date.now();
  const digest = digestAddress(address, secret);
  const keys = policies.map((policy) => {
    const bucket = Math.floor(now / (policy.windowSeconds * 1000));
    return `shunya:ai-limit:${scope}:${digest}:${policy.windowSeconds}:${bucket}`;
  });
  const command = [
    "EVAL", redisScript, keys.length, ...keys,
    ...policies.map((policy) => policy.windowSeconds),
    ...policies.map((policy) => policy.limit)
  ];

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) return { allowed: false, unavailable: true };
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !Array.isArray((payload as { result?: unknown }).result)) {
      return { allowed: false, unavailable: true };
    }
    const result = (payload as { result: unknown[] }).result;
    if (typeof result[0] !== "number" || typeof result[1] !== "number") return { allowed: false, unavailable: true };
    return result[0] === 1 ? { allowed: true } : { allowed: false, retryAfter: Math.max(1, result[1]) };
  } catch {
    return { allowed: false, unavailable: true };
  }
}

export async function readBoundedJson(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) return { ok: false, status: 400 };
    if (Number(contentLength) > maxBytes) return { ok: false, status: 413 };
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return { ok: false, status: 415 };
  if (!request.body) return { ok: false, status: 400 };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }
}

export function apiJson(body: unknown, status = 200, extraHeaders?: HeadersInit): NextResponse {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return NextResponse.json(body, { status, headers });
}

export function rateLimitResponse(result: Exclude<RateLimitResult, { allowed: true }>): NextResponse {
  if ("unavailable" in result) {
    return apiJson({ error: "AI service is temporarily unavailable." }, 503);
  }
  return apiJson({ error: "Too many requests. Please try again later." }, 429, {
    "Retry-After": String(result.retryAfter)
  });
}