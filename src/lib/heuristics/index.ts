import type { HeuristicSignal } from "@/types/scan";

const URGENCY_PATTERNS = [
  /\b\d{1,2}:\d{2}(:\d{2})?\b/,
  /countdown/i,
  /deal ends (in|soon|today)/i,
  /limited time only/i,
  /offer expires/i,
  /ends in \d+/i,
  /sale ends/i,
];

const SCARCITY_PATTERNS = [
  /only \d+ left/i,
  /low stock/i,
  /selling fast/i,
  /high demand/i,
  /people (are )?viewing/i,
  /in \d+ carts?/i,
  /almost sold out/i,
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
    );

  return [
    {
      category: "URGENCY",
      patternType: hasTimer ? "CountdownTimer" : "LimitedTimeMessage",
      severity: hasTimer ? "HIGH" : "MEDIUM",
      description: hasTimer
        ? "Page contains countdown or timer language that may pressure users."
        : "Page uses limited-time messaging that may create artificial urgency.",
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
        ? "Page displays low-stock messaging that may exaggerate scarcity."
        : "Page displays high-demand messaging that may exaggerate scarcity.",
      evidence: matches.slice(0, 2).join("; "),
      confidence: 0.75,
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
        "Page may use pre-selected options that nudge users toward add-ons or marketing consent.",
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
    ...detectPreselection(page.interactiveHtml),
  ];
}
