import type { PageHighlight } from "./types/scan";

const PATTERN_TYPE_GROUPS: readonly string[][] = [
  ["RepeatedPopupOrStickyBanner", "RepeatedPrompt", "StickyPressureBanner"],
  ["ActivityNotifications", "ActivityNotification", "LiveActivityMessage"],
  ["RequiredEnrollment", "Confirmshaming"],
  ["LimitedTimeMessage", "LimitedTimeOffer", "LimitedTimePromotion"],
  ["MisleadingPrice", "DripPricing", "UnclearDiscount"],
];

const STICKY_OVERLAY_CATEGORIES = new Set(["OBSTRUCTION", "NAGGING"]);

export function patternTypesMatch(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }

  for (const group of PATTERN_TYPE_GROUPS) {
    if (group.includes(a) && group.includes(b)) {
      return true;
    }
  }

  return false;
}

function normalizeEvidence(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function evidencePhrases(evidence: string): string[] {
  const phrases = new Set<string>();

  const quoted = evidence.matchAll(/["“'](.+?)["”']/g);
  for (const match of quoted) {
    const inner = match[1].trim();
    if (inner.length >= 3) {
      phrases.add(inner);
      for (const segment of inner.split("|")) {
        const part = segment.trim();
        if (part.length >= 3) {
          phrases.add(part);
        }
      }
    }
  }

  for (const match of evidence.matchAll(/`([^`]+)`/g)) {
    const inner = match[1].trim();
    if (inner.length >= 3) {
      phrases.add(inner);
    }
  }

  const visibleText = evidence.match(
    /Visible text:\s*["“']?([^"”'\n.]+?)["”']?(?:\.|$|\n)/i,
  )?.[1];
  if (visibleText?.trim()) {
    phrases.add(visibleText.trim());
  }

  const cleaned = evidence.replace(/\s+/g, " ").trim();
  if (cleaned.length >= 4) {
    phrases.add(cleaned.slice(0, Math.min(80, cleaned.length)));
  }

  return [...phrases];
}

export function evidenceOverlaps(a: string, b: string): boolean {
  const left = normalizeEvidence(a);
  const right = normalizeEvidence(b);

  if (left.includes(right) || right.includes(left)) {
    return true;
  }

  for (const phrase of evidencePhrases(a)) {
    const normalized = normalizeEvidence(phrase);
    if (normalized.length >= 4 && right.includes(normalized)) {
      return true;
    }
  }

  for (const phrase of evidencePhrases(b)) {
    const normalized = normalizeEvidence(phrase);
    if (normalized.length >= 4 && left.includes(normalized)) {
      return true;
    }
  }

  return false;
}

export function matchHighlightToDetection(
  highlights: PageHighlight[],
  detection: {
    category: string;
    patternType: string;
    evidence: string;
  },
): PageHighlight | undefined {
  const byPattern = highlights.filter(
    (highlight) =>
      highlight.category === detection.category &&
      patternTypesMatch(highlight.patternType, detection.patternType),
  );

  if (byPattern.length === 1) {
    return byPattern[0];
  }

  if (byPattern.length > 1) {
    const byEvidence = byPattern.find(
      (highlight) =>
        highlight.evidence &&
        evidenceOverlaps(highlight.evidence, detection.evidence),
    );
    if (byEvidence) {
      return byEvidence;
    }
    return byPattern[0];
  }

  const byCategory = highlights.filter(
    (highlight) => highlight.category === detection.category,
  );

  if (byCategory.length === 1) {
    return byCategory[0];
  }

  if (byCategory.length > 1) {
    return (
      byCategory.find(
        (highlight) =>
          highlight.evidence &&
          evidenceOverlaps(highlight.evidence, detection.evidence),
      ) ?? byCategory[0]
    );
  }

  if (STICKY_OVERLAY_CATEGORIES.has(detection.category)) {
    const stickyHighlight = highlights.find(
      (highlight) =>
        STICKY_OVERLAY_CATEGORIES.has(highlight.category) ||
        patternTypesMatch(highlight.patternType, "StickyPressureBanner") ||
        patternTypesMatch(highlight.patternType, "RepeatedPopupOrStickyBanner"),
    );
    if (stickyHighlight) {
      return stickyHighlight;
    }
  }

  if (detection.category === "FORCED_ACTION") {
    const promoHighlight = highlights.find(
      (highlight) =>
        highlight.category === "FORCED_ACTION" ||
        highlight.category === "NAGGING" ||
        /sticky|promo|banner|ticker/i.test(highlight.label),
    );
    if (promoHighlight) {
      return promoHighlight;
    }
  }

  const byEvidenceOnly = highlights.find(
    (highlight) =>
      highlight.evidence &&
      evidenceOverlaps(highlight.evidence, detection.evidence),
  );
  if (byEvidenceOnly) {
    return byEvidenceOnly;
  }

  return undefined;
}
