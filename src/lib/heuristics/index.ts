import type { HeuristicSignal } from "@/types/scan";

const URGENCY_PATTERNS = [
  /\b\d{1,2}:\d{2}(:\d{2})?\b/,
  /countdown/i,
  /deal ends (in|soon|today)/i,
  /limited time only/i,
  /offer expires/i,
  /ends in \d+/i,
  /sale ends/i,
  /ends today/i,
  /last chance/i,
  /flash sale/i,
  /offer ends/i,
];

const SCARCITY_PATTERNS = [
  /only \d+ left/i,
  /low stock/i,
  /selling fast/i,
  /high demand/i,
  /almost sold out/i,
  /limited quantity/i,
];

const SOCIAL_PROOF_PATTERNS = [
  /people (are )?viewing/i,
  /bought in the last/i,
  /someone just purchased/i,
  /recent(ly)? purchased/i,
  /\d+ (people|users|customers) (are )?viewing/i,
];

const CONFIRMSHAMING_PATTERNS = [
  /no thanks,? i hate saving/i,
  /i don['’]t want a discount/i,
  /no,? i (like|prefer) paying full price/i,
];

const NAGGING_PATTERNS = [
  /popup/i,
  /modal/i,
  /sticky (bar|banner|footer)/i,
  /don['’]t (go|leave)/i,
];

const PRESELECTION_PATTERNS = [
  /pre-checked/i,
  /checked by default/i,
  /opt.?out/i,
];

function matchPatterns(text: string, patterns: RegExp[]): string[] {
  return patterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source);
}

export function detectUrgency(text: string, html: string): HeuristicSignal[] {
  const combined = `${text}\n${html}`;
  const matches = matchPatterns(combined, URGENCY_PATTERNS);
  if (matches.length === 0) return [];

  const hasTimer =
    /countdown|timer|\d{1,2}:\d{2}/i.test(combined) ||
    /\[class\*='countdown'\]|\[id\*='countdown'\]|\[class\*='timer'\]/i.test(
      html,
    ) ||
    (/\d+\s*(days?|hrs?|hours?|mins?|minutes?|secs?|seconds?)/i.test(
      combined,
    ) &&
      /offer ends|sale ends|ends today|ends sunday|limited time|countdown|timer/i.test(
        combined,
      ));

  return [
    {
      category: "URGENCY",
      patternType: hasTimer ? "CountdownTimer" : "LimitedTimeMessage",
      severity: hasTimer ? "HIGH" : "MEDIUM",
      description: hasTimer
        ? "Potential urgency cue: countdown or timer language may encourage faster decision-making."
        : "Potential urgency cue: limited-time wording may encourage faster decision-making.",
      evidence: matches.slice(0, 2).join("; "),
      confidence: hasTimer ? 0.85 : 0.7,
      source: "heuristic",
    },
  ];
}

export function detectScarcity(text: string): HeuristicSignal[] {
  const matches = matchPatterns(text, SCARCITY_PATTERNS);
  if (matches.length === 0) return [];

  const isLowStock = /only \d+ left|low stock|almost sold out/i.test(text);
  return [
    {
      category: "SCARCITY",
      patternType: isLowStock ? "LowStockMessage" : "HighDemandMessage",
      severity: "MEDIUM",
      description: isLowStock
        ? "Possible scarcity cue: low-stock messaging may encourage faster decision-making."
        : "Possible scarcity cue: high-demand messaging may encourage faster decision-making.",
      evidence: matches.slice(0, 2).join("; "),
      confidence: 0.75,
      source: "heuristic",
    },
  ];
}

export function detectSocialProof(text: string): HeuristicSignal[] {
  const matches = matchPatterns(text, SOCIAL_PROOF_PATTERNS);
  if (matches.length === 0) return [];

  return [
    {
      category: "SOCIAL_PROOF",
      patternType: "ActivityNotification",
      severity: "MEDIUM",
      description:
        "Possible social proof cue: activity or popularity messaging may be difficult to verify independently.",
      evidence: matches.slice(0, 2).join("; "),
      confidence: 0.7,
      source: "heuristic",
    },
  ];
}

export function detectConfirmshaming(text: string): HeuristicSignal[] {
  const matches = matchPatterns(text, CONFIRMSHAMING_PATTERNS);
  if (matches.length === 0) return [];

  return [
    {
      category: "MISDIRECTION",
      patternType: "Confirmshaming",
      severity: "MEDIUM",
      description:
        "Design cue detected: dismissive opt-out wording may pressure users away from declining an offer.",
      evidence: matches.slice(0, 2).join("; "),
      confidence: 0.8,
      source: "heuristic",
    },
  ];
}

export function detectNagging(text: string, html: string): HeuristicSignal[] {
  const combined = `${text}\n${html}`;
  const matches = matchPatterns(combined, NAGGING_PATTERNS);
  if (matches.length === 0) return [];

  return [
    {
      category: "NAGGING",
      patternType: "RepeatedPopupOrStickyBanner",
      severity: "LOW",
      description:
        "Design cue detected: popup, modal, or sticky banner patterns may add checkout pressure.",
      evidence: matches.slice(0, 2).join("; "),
      confidence: 0.65,
      source: "heuristic",
    },
  ];
}

export function detectPreselection(html: string): HeuristicSignal[] {
  const hasCheckedInput = /<input[^>]*checked/i.test(html);
  const matches = matchPatterns(html, PRESELECTION_PATTERNS);

  if (!hasCheckedInput && matches.length === 0) return [];

  return [
    {
      category: "PRESELECTION",
      patternType: "PreCheckedBox",
      severity: "MEDIUM",
      description:
        "Design cue detected: pre-selected options may nudge users toward add-ons or marketing consent.",
      evidence: hasCheckedInput
        ? "Pre-checked input elements detected in page markup."
        : matches.join("; "),
      confidence: hasCheckedInput ? 0.8 : 0.65,
      source: "heuristic",
    },
  ];
}

export function runHeuristics(page: {
  visibleText: string;
  interactiveHtml: string;
}): HeuristicSignal[] {
  return [
    ...detectUrgency(page.visibleText, page.interactiveHtml),
    ...detectScarcity(page.visibleText),
    ...detectSocialProof(page.visibleText),
    ...detectConfirmshaming(page.visibleText),
    ...detectNagging(page.visibleText, page.interactiveHtml),
    ...detectPreselection(page.interactiveHtml),
  ];
}
