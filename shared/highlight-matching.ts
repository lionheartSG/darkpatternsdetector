import type { PageHighlight } from "./types/scan";

const PATTERN_TYPE_GROUPS: readonly string[][] = [
  ["RepeatedPopupOrStickyBanner", "RepeatedPrompt", "StickyPressureBanner"],
  ["ActivityNotifications", "ActivityNotification", "LiveActivityMessage"],
  ["RequiredEnrollment", "Confirmshaming"],
];

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

  const quoted = evidence.match(/["“'](.+?)["”']/g);
  if (quoted) {
    for (const match of quoted) {
      const inner = match.slice(1, -1).trim();
      if (inner.length >= 3) {
        phrases.add(inner);
      }
    }
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

  return undefined;
}
