export type PageAccessStatus = {
  blocked: boolean;
  httpStatus: number;
  reason: string | null;
};

const BLOCKED_HTTP_STATUSES = new Set([401, 403, 407, 451, 503]);

const BLOCKED_TEXT_PATTERNS = [
  /\b403\b.*\bforbidden\b/i,
  /\baccess denied\b/i,
  /\baccess to this page is forbidden\b/i,
  /\brequest blocked\b/i,
  /\battention required\b.*\bcloudflare\b/i,
  /\bplease enable javascript\b/i,
  /\bverify you are human\b/i,
  /\bjust a moment\b.*\bcloudflare\b/i,
  /\bbot detection\b/i,
  /\bsecurity check\b/i,
  /\bchecking the site connection security\b/i,
];

export function assessPageAccess(input: {
  httpStatus: number;
  pageTitle: string;
  visibleText: string;
}): PageAccessStatus {
  const combined = `${input.pageTitle}\n${input.visibleText}`.trim();

  if (BLOCKED_HTTP_STATUSES.has(input.httpStatus)) {
    return {
      blocked: true,
      httpStatus: input.httpStatus,
      reason: `HTTP ${input.httpStatus} response while loading the page`,
    };
  }

  for (const pattern of BLOCKED_TEXT_PATTERNS) {
    if (pattern.test(combined)) {
      return {
        blocked: true,
        httpStatus: input.httpStatus,
        reason:
          "The loaded page appears to be an access block or security interstitial",
      };
    }
  }

  if (/^403\b/i.test(input.pageTitle.trim())) {
    return {
      blocked: true,
      httpStatus: input.httpStatus,
      reason: "The page title indicates access was forbidden",
    };
  }

  if (/robot challenge screen/i.test(input.pageTitle.trim())) {
    return {
      blocked: true,
      httpStatus: input.httpStatus,
      reason:
        "The host's bot-protection challenge did not complete before the scan timed out",
    };
  }

  return {
    blocked: false,
    httpStatus: input.httpStatus,
    reason: null,
  };
}

export function buildAccessBlockedSummary(httpStatus: number): string {
  return `This scan could not access the full public page content. The website returned HTTP ${httpStatus} or an access block page, so design cues visible in a normal browser (such as countdown timers) may be missing from this report. Consider checking independently.`;
}

export function isUserScreenshotScan(scan: {
  pageTitle: string | null;
  summary: string | null;
}): boolean {
  return (
    scan.pageTitle === "Analysis from user-provided screenshot" ||
    /user-provided screenshot/i.test(scan.summary ?? "")
  );
}

export function isAccessBlockedScan(scan: {
  pageTitle: string | null;
  summary: string | null;
}): boolean {
  if (isUserScreenshotScan(scan)) {
    return false;
  }

  const combined = `${scan.pageTitle ?? ""}\n${scan.summary ?? ""}`;
  return (
    /^403\b/i.test(scan.pageTitle?.trim() ?? "") ||
    /could not access the full public page content/i.test(scan.summary ?? "") ||
    /access block page/i.test(scan.summary ?? "")
  );
}
