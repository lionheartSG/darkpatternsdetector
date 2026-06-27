export type ScanErrorCode =
  | "RATE_LIMIT"
  | "VALIDATION"
  | "DATABASE_CONFIG"
  | "DATABASE_CONNECTION"
  | "DATABASE_MIGRATION"
  | "BROWSER_LAUNCH"
  | "PAGE_FETCH_TIMEOUT"
  | "PAGE_FETCH"
  | "AI_ANALYSIS"
  | "UNKNOWN";

export type ClassifiedScanError = {
  code: ScanErrorCode;
  message: string;
  detail: string;
};

function includesAny(text: string, needles: string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((needle) => lower.includes(needle.toLowerCase()));
}

export function classifyScanError(error: unknown): ClassifiedScanError {
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";

  if (includesAny(detail, ["database_url is not defined"])) {
    return {
      code: "DATABASE_CONFIG",
      message:
        "Scan storage is not configured on the server (DATABASE_URL is missing).",
      detail,
    };
  }

  if (
    includesAny(detail, [
      "can't reach database",
      "connection refused",
      "connection timed out",
      "p1001",
      "p1000",
      "p1017",
      "server closed the connection",
      "connect econnrefused",
      "getaddrinfo enotfound",
    ])
  ) {
    return {
      code: "DATABASE_CONNECTION",
      message: "Could not connect to the scan database. Try again in a moment.",
      detail,
    };
  }

  if (
    includesAny(detail, [
      "does not exist",
      "p2021",
      "p3009",
      "relation",
      "migration",
      "no such table",
    ])
  ) {
    return {
      code: "DATABASE_MIGRATION",
      message:
        "The scan database is not initialized. Run Prisma migrations on the server.",
      detail,
    };
  }

  if (
    includesAny(detail, [
      "executable doesn't exist",
      "failed to launch",
      "browserType.launch",
      "spawn enoent",
      "libnspr4",
      "libatk",
      "chromium",
      "chromium-min",
      "playwright",
      "@sparticuz/chromium",
      "@sparticuz/chromium-min",
    ])
  ) {
    return {
      code: "BROWSER_LAUNCH",
      message:
        "The scan browser failed to start on the server. Serverless hosts often need extra Chromium setup, or use Zo Computer / screenshot upload instead.",
      detail,
    };
  }

  if (
    includesAny(detail, [
      "timeout",
      "timed out",
      "etimedout",
      "function_invocation_timeout",
      "504",
    ])
  ) {
    return {
      code: "PAGE_FETCH_TIMEOUT",
      message:
        "The page took too long to load during scanning. Try again or upload a screenshot from your browser.",
      detail,
    };
  }

  if (
    includesAny(detail, [
      "net::err",
      "navigation failed",
      "page.goto",
      "ns_error",
      "ssl",
      "cert",
    ])
  ) {
    return {
      code: "PAGE_FETCH",
      message:
        "Could not load that webpage during scanning. Check the URL is public and reachable.",
      detail,
    };
  }

  if (
    includesAny(detail, [
      "openai_api_key",
      "incorrect api key",
      "invalid api key",
      "rate limit",
      "insufficient_quota",
      "vision",
    ])
  ) {
    return {
      code: "AI_ANALYSIS",
      message:
        detail.includes("OPENAI_API_KEY") || detail.includes("api key")
          ? "AI analysis is not configured (OPENAI_API_KEY missing or invalid)."
          : "AI analysis failed. The server could not complete the scan.",
      detail,
    };
  }

  return {
    code: "UNKNOWN",
    message:
      "We couldn't analyze that website. Check the URL and try again, or upload a screenshot.",
    detail,
  };
}

export function logScanFailure(input: {
  code: ScanErrorCode;
  detail: string;
  url?: string;
  scanId?: string;
  error: unknown;
}): void {
  const payload = {
    code: input.code,
    url: input.url,
    scanId: input.scanId,
    detail: input.detail,
  };

  if (input.error instanceof Error && input.error.stack) {
    console.error("[submitScan] failed:", payload, input.error.stack);
    return;
  }

  console.error("[submitScan] failed:", payload, input.error);
}

export function getSubmitScanClientError(error: unknown): {
  message: string;
  code: ScanErrorCode;
} {
  const classified = classifyScanError(error);

  console.error("[submitScan] server action threw:", {
    code: classified.code,
    detail: classified.detail,
    error,
  });

  if (classified.code !== "UNKNOWN") {
    return { message: classified.message, code: classified.code };
  }

  return {
    code: "UNKNOWN",
    message:
      "The scan request failed before the server finished responding. This usually means a server or database configuration problem.",
  };
}
