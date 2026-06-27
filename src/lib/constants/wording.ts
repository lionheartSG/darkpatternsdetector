export const PROHIBITED_WORDS = [
  "scam",
  "fraud",
  "fraudulent",
  "criminal",
  "illegal",
  "unlawful",
  "cheating",
  "dishonest",
  "dishonest seller",
  "predatory business",
  "predatory",
  "deceptive",
  "deception",
  "confirmed deception",
  "guilty",
  "dark pattern",
  "fake",
  "misleading",
  "name-and-shame",
] as const;

export const CUE_EDUCATION = [
  {
    title: "Urgency",
    body: "Timers and expiry messages may encourage faster decisions before you compare alternatives or read terms.",
  },
  {
    title: "Scarcity",
    body: "Low-stock or limited-quantity claims can be useful when accurate, but are often difficult to verify from a single visit.",
  },
  {
    title: "Social proof",
    body: "Visitor counts and recent purchase messages may reflect real activity, but can also be hard to verify independently.",
  },
  {
    title: "Preselection",
    body: "Pre-checked boxes or add-ons can nudge users toward options they might not otherwise choose.",
  },
  {
    title: "Hidden costs",
    body: "Fees or add-ons shown late in checkout can make the final price unclear until the last step.",
  },
  {
    title: "Subscription friction",
    body: "Auto-renewal or cancellation steps may affect how easy it is to stop recurring charges later.",
  },
] as const;

export const SUGGESTED_ACTIONS: Record<string, string> = {
  URGENCY:
    "Pause before checkout. Compare prices and terms on other sites or at another time.",
  SCARCITY:
    "Consider checking independently whether stock or quantity claims appear elsewhere.",
  SOCIAL_PROOF:
    "Treat popularity messages as unverified unless you can confirm them from other sources.",
  MISDIRECTION:
    "Read decline options carefully. You can usually continue without accepting optional offers.",
  NAGGING:
    "Close repeated prompts and review the page at your own pace before deciding.",
  PRESELECTION:
    "Review pre-selected options and uncheck any add-ons or marketing consent you do not want.",
  SNEAKING:
    "Check the final total and itemised charges before confirming payment.",
  OBSTRUCTION:
    "Look for cancellation, refund, and renewal terms before subscribing or paying.",
  FORCED_ACTION:
    "Avoid sharing contact details unless you understand how they will be used.",
  PRICING_DECEPTION:
    "Confirm the final price, fees, and currency before completing checkout.",
  DEFAULT:
    "Review the evidence below and consider checking independently before deciding.",
};

export const SAFE_CONCERN_LABELS = {
  none: "No major concerns detected",
  low: "Some caution",
  moderate: "Moderate caution",
  high: "High caution",
  insufficient: "Insufficient evidence",
} as const;

export const CONFIDENCE_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  needsRescan: "Needs repeated scan",
} as const;

export const NEXT_STEPS = [
  "Compare prices on other sites before paying.",
  "Check cancellation, refund, and renewal terms.",
  "Search independent reviews from multiple sources.",
  "Pause before completing checkout or payment.",
  "Screenshot terms and pricing for your records.",
  "Consider using a payment method with dispute options.",
] as const;

export function buildSafeSummary(findingCount: number): string {
  if (findingCount === 0) {
    return "No major pressure cues were detected in this scan. The absence of findings does not mean a page is free from concerning design choices.";
  }

  const noun = findingCount === 1 ? "cue" : "cues";
  return `We found ${findingCount} potential pressure ${noun}. These cues are not proof of wrongdoing. Use the evidence below to make your own decision.`;
}

export function buildInsufficientEvidenceSummary(): string {
  return "Insufficient evidence from this scan. The page could not be fully loaded for automated analysis, so pressure cues visible in a normal browser may be missing.";
}

export function concernLabelFromScore(score: number): string {
  if (score <= 5) return SAFE_CONCERN_LABELS.none;
  if (score < 40) return SAFE_CONCERN_LABELS.low;
  if (score < 70) return SAFE_CONCERN_LABELS.moderate;
  return SAFE_CONCERN_LABELS.high;
}

export function confidenceLabelFromScore(confidence: number): string {
  if (confidence >= 0.75) return CONFIDENCE_LABELS.high;
  if (confidence >= 0.5) return CONFIDENCE_LABELS.medium;
  return CONFIDENCE_LABELS.low;
}

export function suggestedActionForCategory(category: string): string {
  return SUGGESTED_ACTIONS[category] ?? SUGGESTED_ACTIONS.DEFAULT;
}
