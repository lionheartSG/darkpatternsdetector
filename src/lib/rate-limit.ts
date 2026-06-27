type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const scanLimits = new Map<string, RateLimitEntry>();

const SCAN_LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;

export function checkScanRateLimit(
  key: string,
): { allowed: true } | { allowed: false; error: string } {
  const now = Date.now();
  const entry = scanLimits.get(key);

  if (!entry || now >= entry.resetAt) {
    scanLimits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= SCAN_LIMIT) {
    return {
      allowed: false,
      error: "Too many scans from this connection. Please try again later.",
    };
  }

  entry.count += 1;
  scanLimits.set(key, entry);
  return { allowed: true };
}

export function getRateLimitKey(headersList: Headers): string {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return headersList.get("x-real-ip") ?? "unknown";
}
