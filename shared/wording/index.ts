import type { ConcernLevel } from "../types/scan";

export const HOME_DISCLAIMER =
  "This tool identifies potential pressure tactics and design cues. It does not determine whether a website is unlawful, fraudulent, or unsafe.";

export const REPORT_DISCLAIMER =
  "Findings are based on automated analysis and may be incomplete or incorrect.";

export const PROHIBITED_WORDS = [
  "scam",
  "fraud",
  "criminal",
  "illegal",
  "cheating",
  "dishonest seller",
  "predatory business",
  "predatory",
  "deceptive company",
] as const;

export const DECISION_CHECKLIST = [
  "Check refund terms.",
  "Compare prices elsewhere.",
  "Look for independent reviews.",
  "Avoid rushing because of timers.",
  "Check whether fees appear only at checkout.",
  "Save a copy of important terms before paying.",
] as const;

export function concernLevelFromScore(score: number | null): ConcernLevel {
  if (score === null) return "UNABLE";
  if (score >= 70) return "HIGH";
  if (score >= 50) return "MODERATE";
  if (score >= 25) return "SOME";
  return "LOW";
}

export function concernLevelLabel(level: ConcernLevel): string {
  switch (level) {
    case "LOW":
      return "Low concern";
    case "SOME":
      return "Some caution";
    case "MODERATE":
      return "Moderate caution";
    case "HIGH":
      return "High caution";
    case "UNABLE":
      return "Unable to assess";
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

export function suggestedActionForCategory(category: string): string {
  switch (category) {
    case "URGENCY":
      return "Consider revisiting the page later to check whether the offer changes.";
    case "SCARCITY":
      return "Compare availability on another channel before deciding.";
    case "SOCIAL_PROOF":
      return "Treat visitor or purchase counts as unverified social cues.";
    case "PRESELECTION":
      return "Review pre-selected options carefully before continuing.";
    case "FORCED_ACTION":
      return "Look for a clear way to decline without penalty.";
    default:
      return "Consider checking independently before paying.";
  }
}

export function sanitizeText(text: string): string {
  let result = text;
  for (const word of PROHIBITED_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(pattern, "potential pressure cue");
  }
  return result;
}
