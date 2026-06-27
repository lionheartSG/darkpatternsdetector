const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REQUESTS) {
    return false;
  }

  entry.count += 1;
  return true;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function corsHeaders(origin: string | null): HeadersInit {
  const allowedOrigin =
    process.env.EXTENSION_CORS_ORIGIN === "*"
      ? (origin ?? "*")
      : ((origin?.startsWith("chrome-extension://") ? origin : null) ??
        process.env.EXTENSION_CORS_ORIGIN ??
        "*");

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-Extension-Key, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function validateExtensionKey(request: Request): boolean {
  const expected = process.env.EXTENSION_API_KEY;
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("x-extension-key") === expected;
}
