import type { HeuristicSignal, PageType } from "../types/scan";

const URGENCY_PATTERNS = [
  /countdown/i,
  /deal ends (in|soon|today)/i,
  /limited time only/i,
  /offer expires/i,
  /ends in \d+/i,
  /sale ends/i,
  /ends today/i,
  /last chance/i,
  /flash sale/i,
];

const SCARCITY_PATTERNS = [
  /in stock/i,
  /only \d+ left/i,
  /only \d+ remaining/i,
  /low stock/i,
  /selling fast/i,
  /high demand/i,
  /people (are )?viewing/i,
  /in \d+ carts?/i,
  /almost sold out/i,
  /limited quantity/i,
  /few left/i,
  /left in stock/i,
];

const SOCIAL_PROOF_PATTERNS = [
  /people (are )?viewing/i,
  /bought in the last/i,
  /someone just purchased/i,
  /recent(ly)? purchased/i,
  /\d+ (people|users|customers) (are )?(viewing|watching)/i,
];

const CONFIRMSHAMING_PATTERNS = [
  /no thanks,? i hate saving/i,
  /i don['']t want a discount/i,
  /no,? i['']ll pay full price/i,
  /continue without/i,
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

function pressureText(
  visibleText: string,
  interactiveHtml: string,
  pageType: PageType,
): string {
  if (pageType === "editorial") {
    return interactiveHtml;
  }
  return `${visibleText}\n${interactiveHtml}`;
}

function hasActiveTimer(html: string): boolean {
  return (
    /countdown|timer|ends in \d+/i.test(html) &&
    (/class="[^"]*(countdown|timer)[^"]*"/i.test(html) ||
      /data-countdown|role="timer"/i.test(html) ||
      /ends in \d+/i.test(html))
  );
}

export function detectUrgency(
  visibleText: string,
  html: string,
  pageType: PageType = "general",
): HeuristicSignal[] {
  const patternSource = pressureText(visibleText, html, pageType);
  const matches = matchPatterns(patternSource, URGENCY_PATTERNS);
  if (matches.length === 0) return [];

  const timerDetected = hasActiveTimer(html);

  return [
    {
      category: "URGENCY",
      patternType: timerDetected ? "CountdownTimer" : "LimitedTimeMessage",
      severity: timerDetected ? "HIGH" : "MEDIUM",
      description: timerDetected
        ? "Potential urgency cue detected. Countdown timers are common in marketing, but can create time pressure."
        : "Potential urgency cue detected. This may encourage faster decision-making.",
      evidence: matches.slice(0, 2).join("; "),
      confidence: timerDetected ? 0.85 : 0.7,
      source: "heuristic",
    },
  ];
}

export function detectScarcity(
  visibleText: string,
  pageType: PageType = "general",
  interactiveHtml = "",
): HeuristicSignal[] {
  const text =
    pageType === "editorial" ? interactiveHtml : visibleText;
  const matches = matchPatterns(text, SCARCITY_PATTERNS);
  if (matches.length === 0) return [];

  const isLowStock = /only \d+ left|low stock|almost sold out|in stock/i.test(
    text,
  );
  return [
    {
      category: "SCARCITY",
      patternType: isLowStock ? "LowStockMessage" : "HighDemandMessage",
      severity: "MEDIUM",
      description: isLowStock
        ? "Possible scarcity cue detected. Scarcity messages may be useful when accurate, but are hard for users to verify."
        : "Possible scarcity cue detected. High-demand messaging may exaggerate scarcity.",
      evidence: matches.slice(0, 2).join("; "),
      confidence: 0.75,
      source: "heuristic",
    },
  ];
}

export function detectSocialProof(
  visibleText: string,
  pageType: PageType = "general",
  interactiveHtml = "",
): HeuristicSignal[] {
  const text =
    pageType === "editorial" ? interactiveHtml : visibleText;
  const matches = matchPatterns(text, SOCIAL_PROOF_PATTERNS);
  if (matches.length === 0) return [];

  return [
    {
      category: "SOCIAL_PROOF",
      patternType: "ActivityNotifications",
      severity: "MEDIUM",
      description:
        "Possible social proof cue detected. Visitor count messages may create social proof.",
      evidence: matches.slice(0, 2).join("; "),
      confidence: 0.7,
      source: "heuristic",
    },
  ];
}

export function detectConfirmshaming(
  visibleText: string,
  pageType: PageType = "general",
  interactiveHtml = "",
): HeuristicSignal[] {
  const text =
    pageType === "editorial" ? interactiveHtml : visibleText;
  const matches = matchPatterns(text, CONFIRMSHAMING_PATTERNS);
  if (matches.length === 0) return [];

  return [
    {
      category: "FORCED_ACTION",
      patternType: "Confirmshaming",
      severity: "MEDIUM",
      description:
        "Possible pressure cue detected in decline or opt-out wording.",
      evidence: matches.slice(0, 2).join("; "),
      confidence: 0.75,
      source: "heuristic",
    },
  ];
}

export function detectPreselection(html: string): HeuristicSignal[] {
  const hasCheckedInput = /<input[^>]*\bchecked\b/i.test(html);
  const matches = matchPatterns(html, PRESELECTION_PATTERNS);

  if (!hasCheckedInput && matches.length === 0) return [];

  return [
    {
      category: "PRESELECTION",
      patternType: "PreCheckedBox",
      severity: "MEDIUM",
      description:
        "Possible preselection cue detected. Pre-selected options can nudge users toward add-ons or marketing consent.",
      evidence: hasCheckedInput
        ? "Pre-checked input elements detected in page markup."
        : matches.join("; "),
      confidence: hasCheckedInput ? 0.8 : 0.65,
      source: "heuristic",
    },
  ];
}

export function detectObstruction(
  html: string,
  pageType: PageType = "general",
): HeuristicSignal[] {
  if (pageType === "editorial") {
    return [];
  }

  const hasStickyOverlay =
    /position:\s*(fixed|sticky)/i.test(html) ||
    /class="[^"]*(modal|popup|overlay|sticky-banner)[^"]*"/i.test(html);

  if (!hasStickyOverlay) return [];

  return [
    {
      category: "OBSTRUCTION",
      patternType: "StickyPressureBanner",
      severity: "MEDIUM",
      description:
        "Possible obstruction cue detected. Sticky banners or overlays may keep checkout pressure visible.",
      evidence: "Fixed or sticky overlay-like elements detected.",
      confidence: 0.65,
      source: "heuristic",
    },
  ];
}

export function runHeuristics(page: {
  visibleText: string;
  interactiveHtml: string;
  pageType?: PageType;
}): HeuristicSignal[] {
  const pageType = page.pageType ?? "general";

  return [
    ...detectUrgency(page.visibleText, page.interactiveHtml, pageType),
    ...detectScarcity(page.visibleText, pageType, page.interactiveHtml),
    ...detectSocialProof(page.visibleText, pageType, page.interactiveHtml),
    ...detectConfirmshaming(
      page.visibleText,
      pageType,
      page.interactiveHtml,
    ),
    ...detectPreselection(page.interactiveHtml),
    ...detectObstruction(page.interactiveHtml, pageType),
  ];
}
