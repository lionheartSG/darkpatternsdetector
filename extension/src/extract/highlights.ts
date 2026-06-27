import type {
  DetectionCategory,
  PageHighlight,
  PageType,
} from "@darkpatterns/shared/types";
import { patternTypesMatch } from "@darkpatterns/shared/highlight-matching";

export const HIGHLIGHT_ID_ATTR = "data-dpd-highlight-id";
export const HIGHLIGHT_BOX_ATTR = "data-dpd-highlight-box";

const MAX_HIGHLIGHTS = 15;

const COUNTDOWN_SELECTORS = [
  '[class*="countdown"]',
  '[class*="timer"]',
  '[id*="countdown"]',
  '[id*="timer"]',
  '[role="timer"]',
].join(",");

const INTERACTIVE_SELECTORS = [
  "button",
  "a",
  "input",
  "select",
  "label",
  "textarea",
  '[role="dialog"]',
  '[class*="modal"]',
  '[class*="popup"]',
  '[class*="overlay"]',
  '[class*="banner"]',
  '[class*="price"]',
  '[class*="subscribe"]',
  '[class*="newsletter"]',
].join(",");

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
  /shop now before/i,
  /before it['']?s gone/i,
  /act now/i,
  /hurry/i,
  /don['']?t miss out/i,
  /get \d+\s*%\s*off/i,
  /\boff now\b/i,
  /\d+\s*%\s*off now/i,
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
  /sign up for .* (updates|newsletter)/i,
  /\bspecials\b/i,
];

const CONFIRMSHAMING_PATTERNS = [
  /no thanks,? i hate saving/i,
  /i don['']t want a discount/i,
  /no,? i['']ll pay full price/i,
  /continue without/i,
];

const PRICING_PATTERNS = [
  /was [\$£€S$]/i,
  /now [\$£€S$]/i,
  /[\$£€S$]\s?[\d,.]+[\s\S]{0,20}(was|before|compare|original|regular)/i,
  /(was|before|compare|original|regular)[\s\S]{0,20}[\$£€S$]\s?[\d,.]+/i,
  /save \d+\s*%/i,
  /\d+\s*%\s*off/i,
  /rrp|mrrp/i,
  /original price/i,
  /compare.?at/i,
  /regular price/i,
  /listed price/i,
  /\+ tax/i,
  /additional fees?/i,
  /starting at/i,
  /from [\$£€S$]/i,
  /[\$£€S$][\d,.]+\s*[\$£€S$][\d,.]+/,
];

const PRICE_CONTAINER_SELECTORS = [
  '[class*="price"]',
  '[class*="Price"]',
  '[class*="compare"]',
  '[class*="was-price"]',
  '[class*="was_price"]',
  '[class*="original"]',
  '[class*="regular"]',
  '[class*="sale-price"]',
  '[class*="sale_price"]',
  '[data-compare-price]',
  '[data-sale-price]',
  ".price",
  ".product-price",
].join(",");

const NAGGING_PATTERNS = [
  /subscribe/i,
  /sign up/i,
  /don't miss/i,
  /before you go/i,
  /wait!? don't leave/i,
  /enable notifications/i,
  /popup/i,
  /modal/i,
  /sticky (bar|banner|footer)/i,
];

const ENROLLMENT_PATTERNS = [
  /sign in/i,
  /log in/i,
  /register/i,
  /create account/i,
  /my orders/i,
  /my favorites/i,
  /join now/i,
];

const REVIEW_PATTERNS = [
  /review/i,
  /testimonial/i,
  /customer said/i,
  /★|⭐/,
  /rated \d/i,
  /\d out of 5/i,
];

const SNEAKING_PATTERNS = [
  /hidden fee/i,
  /auto.?renew/i,
  /free trial/i,
  /added to (cart|basket)/i,
  /pre.?selected add.?on/i,
];

type HighlightCandidate = Omit<PageHighlight, "id">;

export type HighlightDetection = {
  category: string;
  patternType: string;
  severity: PageHighlight["severity"];
  evidence: string;
};

export function isVisibleHighlightElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  if (Number.parseFloat(style.opacity) === 0) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) {
    return false;
  }

  if (typeof element.checkVisibility === "function") {
    return element.checkVisibility({
      checkOpacity: true,
      checkVisibilityCSS: true,
    });
  }

  if (style.position === "fixed" || style.position === "sticky") {
    return true;
  }

  return element.offsetParent !== null;
}

function assignHighlightId(element: Element): string {
  const existing = element.getAttribute(HIGHLIGHT_ID_ATTR);
  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID();
  element.setAttribute(HIGHLIGHT_ID_ATTR, id);
  return id;
}

function isInsideArticleBody(element: Element): boolean {
  const article = element.closest("article");
  if (!article) {
    return false;
  }

  if (element.closest('[role="dialog"], [class*="modal"], [class*="popup"]')) {
    return false;
  }

  const tag = element.tagName.toLowerCase();
  return !["input", "button", "select", "textarea", "form"].includes(tag);
}

function shouldSkipElement(element: Element, pageType: PageType): boolean {
  if (pageType === "editorial" && isInsideArticleBody(element)) {
    return true;
  }

  const root = document.getElementById("dpd-highlight-root");
  if (root?.contains(element)) {
    return true;
  }

  if (element instanceof HTMLElement && !isVisibleHighlightElement(element)) {
    return true;
  }

  return false;
}

function firstMatchingPattern(text: string, patterns: RegExp[]): RegExp | null {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return pattern;
    }
  }
  return null;
}

function highlightTarget(element: Element): Element {
  const dialog = element.closest('[role="dialog"], [class*="modal"], [class*="popup"]');
  if (dialog instanceof HTMLElement) {
    return dialog;
  }

  if (element instanceof HTMLInputElement) {
    return element.closest("label") ?? element;
  }

  if (element instanceof HTMLElement) {
    const text = (element.innerText ?? "").trim();
    if (text.length < 120) {
      const container = element.closest(
        'nav, header, footer, [role="banner"], [role="navigation"], form, [class*="countdown"], [class*="timer"]',
      );
      if (container instanceof HTMLElement) {
        return container;
      }
    }
  }

  return element;
}

function isNestedStickyElement(element: HTMLElement): boolean {
  let parent = element.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    if (style.position === "fixed" || style.position === "sticky") {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

function addCandidate(
  element: Element,
  candidate: HighlightCandidate,
  pageType: PageType,
  seen: Map<Element, PageHighlight>,
): void {
  const target = highlightTarget(element);
  if (!(target instanceof HTMLElement)) {
    return;
  }
  if (shouldSkipElement(target, pageType)) {
    return;
  }

  const existing = seen.get(target);
  if (existing) {
    if (severityRank(candidate.severity) > severityRank(existing.severity)) {
      seen.set(target, { ...candidate, id: existing.id });
    }
    return;
  }

  seen.set(target, {
    ...candidate,
    id: assignHighlightId(target),
  });
}

function severityRank(severity: PageHighlight["severity"]): number {
  switch (severity) {
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 1;
    default: {
      const _exhaustive: never = severity;
      return _exhaustive;
    }
  }
}

function collectCountdownHighlights(
  pageType: PageType,
  seen: Map<Element, PageHighlight>,
): void {
  for (const element of document.querySelectorAll(COUNTDOWN_SELECTORS)) {
    if (!(element instanceof HTMLElement)) continue;

    addCandidate(
      element,
      {
        category: "URGENCY",
        patternType: "CountdownTimer",
        severity: "HIGH",
        label: "Countdown timer",
      },
      pageType,
      seen,
    );
  }
}

function collectPreselectionHighlights(
  pageType: PageType,
  seen: Map<Element, PageHighlight>,
): void {
  for (const input of document.querySelectorAll<HTMLInputElement>(
    'input[type="checkbox"]:checked, input[type="radio"]:checked',
  )) {
    addCandidate(
      input,
      {
        category: "PRESELECTION",
        patternType: "PreCheckedBox",
        severity: "MEDIUM",
        label: "Pre-selected option",
      },
      pageType,
      seen,
    );
  }
}

function hasCurrencyText(text: string): boolean {
  return /[\$£€]|S\$|\d[\d,.]*\s*(?:was|now|off|save)/i.test(text);
}

function pricingContainerFor(element: Element): HTMLElement {
  const container = element.closest(PRICE_CONTAINER_SELECTORS);
  if (container instanceof HTMLElement) {
    return container;
  }
  if (element.parentElement instanceof HTMLElement) {
    return element.parentElement;
  }
  return element as HTMLElement;
}

function collectPricingHighlights(
  pageType: PageType,
  seen: Map<Element, PageHighlight>,
): void {
  for (const element of document.querySelectorAll<HTMLElement>("del, s")) {
    if (!isVisibleHighlightElement(element)) {
      continue;
    }

    const text = element.textContent ?? "";
    if (!hasCurrencyText(text) && !/[\d,.]+/.test(text)) {
      continue;
    }

    addCandidate(
      pricingContainerFor(element),
      {
        category: "PRICING_DECEPTION",
        patternType: "StrikethroughPrice",
        severity: "MEDIUM",
        label: "Pricing cue",
      },
      pageType,
      seen,
    );
  }

  for (const element of document.querySelectorAll<HTMLElement>(
    PRICE_CONTAINER_SELECTORS,
  )) {
    const text = (element.innerText ?? "").trim();
    if (text.length < 3 || text.length > 200) {
      continue;
    }

    const html = element.outerHTML;
    const combined = `${text}\n${html}`;
    const hasStrike =
      element.querySelector("del, s") !== null ||
      /line-through/i.test(window.getComputedStyle(element).textDecoration);

    if (
      firstMatchingPattern(combined, PRICING_PATTERNS) ||
      (hasStrike && hasCurrencyText(text))
    ) {
      addCandidate(
        element,
        {
          category: "PRICING_DECEPTION",
          patternType: hasStrike ? "StrikethroughPrice" : "MisleadingPrice",
          severity: "MEDIUM",
          label: "Pricing cue",
        },
        pageType,
        seen,
      );
    }
  }

  for (const element of document.querySelectorAll<HTMLElement>("*")) {
    if (!isVisibleHighlightElement(element)) {
      continue;
    }

    const text = (element.innerText ?? "").trim();
    if (text.length > 80) {
      continue;
    }

    const style = window.getComputedStyle(element);
    if (style.textDecorationLine.includes("line-through") && hasCurrencyText(text)) {
      addCandidate(
        pricingContainerFor(element),
        {
          category: "PRICING_DECEPTION",
          patternType: "StrikethroughPrice",
          severity: "MEDIUM",
          label: "Pricing cue",
        },
        pageType,
        seen,
      );
    }
  }
}

function collectStickyHighlights(
  pageType: PageType,
  seen: Map<Element, PageHighlight>,
): void {
  for (const element of document.querySelectorAll<HTMLElement>("*")) {
    const style = window.getComputedStyle(element);
    if (style.position !== "fixed" && style.position !== "sticky") {
      continue;
    }

    if (isNestedStickyElement(element)) {
      continue;
    }

    const text = element.innerText ?? "";
    if (text.length > 500) {
      continue;
    }

    const combined = `${text}\n${element.outerHTML}`;
    const urgency = firstMatchingPattern(combined, URGENCY_PATTERNS);
    const scarcity = firstMatchingPattern(combined, SCARCITY_PATTERNS);

    if (urgency) {
      addCandidate(
        element,
        {
          category: "URGENCY",
          patternType: /countdown|timer|ends in \d+/i.test(combined)
            ? "CountdownTimer"
            : "LimitedTimeMessage",
          severity: /countdown|timer|ends in \d+/i.test(combined)
            ? "HIGH"
            : "MEDIUM",
          label: "Urgency banner",
        },
        pageType,
        seen,
      );
      continue;
    }

    if (scarcity) {
      addCandidate(
        element,
        {
          category: "SCARCITY",
          patternType: /only \d+ left|low stock|almost sold out/i.test(text)
            ? "LowStockMessage"
            : "HighDemandMessage",
          severity: "MEDIUM",
          label: "Scarcity banner",
        },
        pageType,
        seen,
      );
      continue;
    }

    if (
      /class="[^"]*(modal|popup|popover|overlay|widget|sticky-banner)[^"]*"/i.test(
        element.outerHTML,
      ) ||
      element.matches("sticky-header, [class*='sticky-header']")
    ) {
      addCandidate(
        element,
        {
          category: "NAGGING",
          patternType: "RepeatedPopupOrStickyBanner",
          severity: "MEDIUM",
          label: "Sticky overlay",
        },
        pageType,
        seen,
      );
    }
  }
}

function collectTextHighlights(
  pageType: PageType,
  seen: Map<Element, PageHighlight>,
): void {
  for (const element of document.querySelectorAll<HTMLElement>(
    INTERACTIVE_SELECTORS,
  )) {
    const text = element.innerText ?? "";
    if (text.length < 4 || text.length > 400) {
      continue;
    }

    const html = element.outerHTML;
    const combined = `${text}\n${html}`;

    const urgency = firstMatchingPattern(combined, URGENCY_PATTERNS);
    if (urgency) {
      addCandidate(
        element,
        {
          category: "URGENCY",
          patternType: /countdown|timer|ends in \d+/i.test(combined)
            ? "CountdownTimer"
            : "LimitedTimeMessage",
          severity: /countdown|timer|ends in \d+/i.test(combined)
            ? "HIGH"
            : "MEDIUM",
          label: "Urgency cue",
        },
        pageType,
        seen,
      );
      continue;
    }

    const scarcity = firstMatchingPattern(text, SCARCITY_PATTERNS);
    if (scarcity) {
      addCandidate(
        element,
        {
          category: "SCARCITY",
          patternType: /only \d+ left|low stock|almost sold out/i.test(text)
            ? "LowStockMessage"
            : "HighDemandMessage",
          severity: "MEDIUM",
          label: "Scarcity cue",
        },
        pageType,
        seen,
      );
      continue;
    }

    const social = firstMatchingPattern(text, SOCIAL_PROOF_PATTERNS);
    if (social) {
      addCandidate(
        element,
        {
          category: "SOCIAL_PROOF",
          patternType: "ActivityNotifications",
          severity: "MEDIUM",
          label: "Social proof cue",
        },
        pageType,
        seen,
      );
      continue;
    }

    const review = firstMatchingPattern(text, REVIEW_PATTERNS);
    if (review) {
      addCandidate(
        element,
        {
          category: "SOCIAL_PROOF",
          patternType: "ActivityNotifications",
          severity: "MEDIUM",
          label: "Review or testimonial",
        },
        pageType,
        seen,
      );
      continue;
    }

    const shaming = firstMatchingPattern(text, CONFIRMSHAMING_PATTERNS);
    if (shaming) {
      addCandidate(
        element,
        {
          category: "FORCED_ACTION",
          patternType: "Confirmshaming",
          severity: "MEDIUM",
          label: "Pressure wording",
        },
        pageType,
        seen,
      );
      continue;
    }

    const pricing = firstMatchingPattern(combined, PRICING_PATTERNS);
    if (pricing) {
      addCandidate(
        element,
        {
          category: "PRICING_DECEPTION",
          patternType: "MisleadingPrice",
          severity: "MEDIUM",
          label: "Pricing cue",
        },
        pageType,
        seen,
      );
      continue;
    }

    const nagging = firstMatchingPattern(text, NAGGING_PATTERNS);
    if (nagging) {
      addCandidate(
        element,
        {
          category: "NAGGING",
          patternType: "RepeatedPopupOrStickyBanner",
          severity: "MEDIUM",
          label: "Repeated prompt",
        },
        pageType,
        seen,
      );
      continue;
    }

    const enrollment = firstMatchingPattern(text, ENROLLMENT_PATTERNS);
    if (enrollment) {
      addCandidate(
        element,
        {
          category: "FORCED_ACTION",
          patternType: "RequiredEnrollment",
          severity: "MEDIUM",
          label: "Sign-in prompt",
        },
        pageType,
        seen,
      );
      continue;
    }

    const sneaking = firstMatchingPattern(combined, SNEAKING_PATTERNS);
    if (sneaking) {
      addCandidate(
        element,
        {
          category: "SNEAKING",
          patternType: "HiddenCost",
          severity: "MEDIUM",
          label: "Hidden cost cue",
        },
        pageType,
        seen,
      );
    }
  }
}

function labelForDetection(detection: HighlightDetection): string {
  switch (detection.category) {
    case "URGENCY":
      return /countdown|timer/i.test(detection.patternType)
        ? "Countdown timer"
        : "Urgency cue";
    case "SCARCITY":
      return "Scarcity cue";
    case "SOCIAL_PROOF":
      return "Social proof cue";
    case "PRESELECTION":
      return "Pre-selected option";
    case "OBSTRUCTION":
      return "Sticky overlay";
    case "FORCED_ACTION":
      return detection.patternType === "RequiredEnrollment"
        ? "Sign-in prompt"
        : "Pressure wording";
    case "PRICING_DECEPTION":
      return "Pricing cue";
    case "NAGGING":
      return "Repeated prompt";
    case "MISDIRECTION":
      return "Misdirection cue";
    case "SNEAKING":
      return "Hidden cost cue";
    default:
      return "Pressure cue";
  }
}

function pricingEvidencePhrases(evidence: string): string[] {
  const phrases = new Set<string>();

  const quoted = evidence.match(/["“](.+?)["”]/)?.[1];
  if (quoted && quoted.trim().length >= 3) {
    phrases.add(quoted.trim());
  }

  for (const match of evidence.matchAll(/(?:S\$|\$|£|€)\s?[\d,.]+/g)) {
    phrases.add(match[0].replace(/\s/g, ""));
    phrases.add(match[0].trim());
  }

  for (const match of evidence.matchAll(/[\d,.]+\s*(?:% off|%)/gi)) {
    phrases.add(match[0].trim());
  }

  for (const match of evidence.matchAll(/save\s+\d+\s*%/gi)) {
    phrases.add(match[0].trim());
  }

  return [...phrases].filter((phrase) => phrase.length >= 3);
}

function findElementContainingPhrase(phrase: string): HTMLElement | null {
  const phraseLower = phrase.toLowerCase();
  let best: HTMLElement | null = null;
  let bestArea = Number.POSITIVE_INFINITY;

  for (const element of document.querySelectorAll<HTMLElement>(
    TEXT_SEARCH_SELECTORS,
  )) {
    if (!isVisibleHighlightElement(element)) {
      continue;
    }

    const text = (element.innerText ?? "").trim();
    if (text.length === 0 || text.length > 500) {
      continue;
    }
    if (!text.toLowerCase().includes(phraseLower)) {
      continue;
    }

    const rect = element.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area > 0 && area < bestArea) {
      best = element;
      bestArea = area;
    }
  }

  return best;
}

function findStructuralPricingElement(): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>("del, s")) {
    if (!isVisibleHighlightElement(element)) {
      continue;
    }
    const text = element.textContent ?? "";
    if (hasCurrencyText(text) || /[\d,.]+/.test(text)) {
      return pricingContainerFor(element);
    }
  }

  for (const element of document.querySelectorAll<HTMLElement>(
    PRICE_CONTAINER_SELECTORS,
  )) {
    if (!isVisibleHighlightElement(element)) {
      continue;
    }

    const text = (element.innerText ?? "").trim();
    if (text.length < 3) {
      continue;
    }

    const hasStrike = element.querySelector("del, s") !== null;
    if (hasStrike || firstMatchingPattern(`${text}\n${element.outerHTML}`, PRICING_PATTERNS)) {
      return element;
    }
  }

  return null;
}

function findElementByPricingEvidence(evidence: string): HTMLElement | null {
  for (const phrase of pricingEvidencePhrases(evidence)) {
    const element = findElementContainingPhrase(phrase);
    if (element) {
      return pricingContainerFor(element);
    }
  }

  return findStructuralPricingElement();
}

function scarcityEvidencePhrases(evidence: string): string[] {
  const phrases = new Set<string>();

  const quoted = evidence.match(/["“'](.+?)["”']/)?.[1];
  if (quoted?.trim()) {
    const trimmed = quoted.trim();
    phrases.add(trimmed);
    for (const segment of trimmed.split("|")) {
      const part = segment.trim();
      if (part.length >= 3) {
        phrases.add(part);
      }
    }
  }

  for (const match of evidence.matchAll(
    /\b(in stock|low stock|only \d+ left|only \d+ remaining|almost sold out|selling fast|high demand|limited quantity|few left)\b/gi,
  )) {
    phrases.add(match[0].trim());
  }

  return [...phrases].filter((phrase) => phrase.length >= 3);
}

function findStructuralScarcityElement(): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(
    "p, span, div, button, a, label, li, strong, em, small",
  )) {
    if (!isVisibleHighlightElement(element)) {
      continue;
    }

    const text = (element.innerText ?? "").trim();
    if (text.length < 3 || text.length > 200) {
      continue;
    }

    if (firstMatchingPattern(text, SCARCITY_PATTERNS)) {
      return element;
    }
  }

  return null;
}

function findElementByScarcityEvidence(evidence: string): HTMLElement | null {
  for (const phrase of scarcityEvidencePhrases(evidence)) {
    const element = findElementContainingPhrase(phrase);
    if (element) {
      return element;
    }
  }

  return findStructuralScarcityElement();
}

function evidencePhrases(evidence: string): string[] {
  const phrases = new Set<string>();

  for (const match of evidence.matchAll(/["“'](.+?)["”']/g)) {
    const trimmed = match[1].trim();
    if (trimmed.length >= 3) {
      phrases.add(trimmed);
      for (const segment of trimmed.split("|")) {
        const part = segment.trim();
        if (part.length >= 3) {
          phrases.add(part);
        }
      }
    }
  }

  for (const match of evidence.matchAll(/`([^`]+)`/g)) {
    const trimmed = match[1].trim();
    if (trimmed.length >= 3) {
      phrases.add(trimmed);
    }
  }

  const visibleText = evidence.match(
    /Visible text:\s*["“']?([^"”'\n.]+?)["”']?(?:\.|$|\n)/i,
  )?.[1];
  if (visibleText?.trim()) {
    phrases.add(visibleText.trim());
  }

  const snippet = evidence.match(/Snippet:\s*(`[^`]+`|<[^>\n]+>)/i)?.[1];
  if (snippet?.trim()) {
    phrases.add(snippet.trim().replace(/^`|`$/g, ""));
  }

  const fallback = evidenceSearchPhrase(evidence);
  if (fallback) {
    phrases.add(fallback);
  }

  return [...phrases].filter((phrase) => phrase.length >= 3);
}

function evidenceSearchPhrase(evidence: string): string | null {
  const quoted = evidence.match(/["“'](.+?)["”']/)?.[1];
  if (quoted && quoted.trim().length >= 4) {
    return quoted.trim();
  }

  const cleaned = evidence.replace(/\s+/g, " ").trim();
  if (cleaned.length < 4) {
    return null;
  }

  return cleaned.slice(0, Math.min(80, cleaned.length));
}

function findElementByEvidence(evidence: string): HTMLElement | null {
  for (const phrase of evidencePhrases(evidence)) {
    const element = findElementContainingPhrase(phrase);
    if (element) {
      return element;
    }
  }

  return null;
}

const POPUP_SELECTORS = [
  '[role="dialog"]',
  '[class*="modal"]',
  '[class*="Modal"]',
  '[class*="popup"]',
  '[class*="Popup"]',
  '[class*="popover"]',
  '[class*="Popover"]',
  '[class*="overlay"]',
  '[class*="Overlay"]',
  '[class*="widget"]',
  '[class*="Widget"]',
  '[class*="newsletter"]',
  '[class*="sticky-banner"]',
  '[class*="announcement"]',
  "sticky-header",
  '[class*="sticky-header"]',
].join(",");

const STICKY_PROMO_SELECTORS = [
  "sticky-header",
  '[class*="sticky-header"]',
  '[class*="announcement-bar"]',
  '[class*="promo-bar"]',
  '[class*="promo-ticker"]',
  '[class*="ticker"]',
  "header[class*='sticky']",
  '[class*="header--sticky"]',
].join(",");

const TEXT_SEARCH_SELECTORS =
  "p, span, div, button, a, label, li, h1, h2, h3, h4, td, strong, em, small, del, s, sticky-header, header, nav, section, [class*='banner'], [class*='ticker'], [class*='popover'], [class*='widget']";

const OVERLAY_CLASS_HINT =
  /modal|popup|popover|overlay|widget|banner|sticky|newsletter|close|ticker|announcement/i;

function extractClassFragmentsFromSnippet(snippet: string): string[] {
  const fragments = new Set<string>();

  for (const match of snippet.matchAll(/class="([^"]+)"/gi)) {
    for (const token of match[1].split(/\s+/)) {
      const trimmed = token.trim();
      if (trimmed.length < 4) {
        continue;
      }
      fragments.add(trimmed);
      for (const part of trimmed.split("__")) {
        if (part.length >= 4) {
          fragments.add(part);
        }
      }
    }
  }

  return [...fragments];
}

function findElementByClassFragment(fragment: string): HTMLElement | null {
  const needle = fragment.toLowerCase();
  if (needle.length < 4) {
    return null;
  }

  let best: HTMLElement | null = null;
  let bestArea = Number.POSITIVE_INFINITY;

  for (const element of document.querySelectorAll<HTMLElement>("[class]")) {
    const className = element.className.toLowerCase();
    if (!className.includes(needle)) {
      continue;
    }
    if (!isVisibleHighlightElement(element)) {
      continue;
    }

    const rect = element.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area > 0 && area < bestArea) {
      best = element;
      bestArea = area;
    }
  }

  return best;
}

function findElementFromHtmlSnippet(snippet: string): HTMLElement | null {
  for (const fragment of extractClassFragmentsFromSnippet(snippet)) {
    const element = findElementByClassFragment(fragment);
    if (element) {
      return element;
    }
  }

  const tagMatch = snippet.match(/^<\s*([a-z][a-z0-9-]*)/i);
  if (tagMatch) {
    for (const element of document.querySelectorAll<HTMLElement>(tagMatch[1])) {
      if (isVisibleHighlightElement(element)) {
        return element;
      }
    }
  }

  return null;
}

function isOverlayLikeElement(element: HTMLElement): boolean {
  const className = element.className.toLowerCase();
  const html = element.outerHTML.toLowerCase();
  return (
    OVERLAY_CLASS_HINT.test(className) ||
    OVERLAY_CLASS_HINT.test(html) ||
    element.matches(
      "sticky-header, [class*='sticky-header'], [role='dialog'], [class*='popover'], [class*='widget']",
    )
  );
}

function findStructuralStickyPromoElement(): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(
    STICKY_PROMO_SELECTORS,
  )) {
    if (isVisibleHighlightElement(element)) {
      return element;
    }
  }

  return null;
}

function findStructuralPopupElement(): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(POPUP_SELECTORS)) {
    if (isVisibleHighlightElement(element)) {
      return element;
    }
  }

  let bestOverlay: HTMLElement | null = null;
  let bestOverlayArea = Number.POSITIVE_INFINITY;

  for (const element of document.querySelectorAll<HTMLElement>("*")) {
    const style = window.getComputedStyle(element);
    if (style.position !== "fixed" && style.position !== "sticky") {
      continue;
    }
    if (isNestedStickyElement(element)) {
      continue;
    }

    const text = (element.innerText ?? "").trim();
    if (text.length > 500) {
      continue;
    }
    if (!isVisibleHighlightElement(element)) {
      continue;
    }

    if (isOverlayLikeElement(element)) {
      const rect = element.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > 0 && area < bestOverlayArea) {
        bestOverlay = element;
        bestOverlayArea = area;
      }
      continue;
    }

    if (!bestOverlay) {
      return element;
    }
  }

  return bestOverlay;
}

function isStickyOverlayDetection(detection: HighlightDetection): boolean {
  return (
    detection.category === "OBSTRUCTION" ||
    detection.category === "NAGGING" ||
    patternTypesMatch(detection.patternType, "StickyPressureBanner") ||
    patternTypesMatch(detection.patternType, "RepeatedPopupOrStickyBanner")
  );
}

function isStickyPromoDetection(detection: HighlightDetection): boolean {
  return (
    detection.category === "FORCED_ACTION" &&
    (/sticky|ticker|promo|banner|header/i.test(detection.evidence) ||
      /sticky|promo|ticker|banner/i.test(detection.patternType))
  );
}

function findStructuralEnrollmentElement(): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(
    "a, button, nav, header, [class*='account'], [class*='signin'], [class*='login']",
  )) {
    if (!isVisibleHighlightElement(element)) {
      continue;
    }

    const text = (element.innerText ?? "").trim();
    if (text.length < 3 || text.length > 200) {
      continue;
    }

    if (firstMatchingPattern(text, ENROLLMENT_PATTERNS)) {
      return element;
    }
  }

  return null;
}

function findStructuralReviewElement(): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(
    '[class*="review"], [class*="testimonial"], blockquote, [itemprop="review"]',
  )) {
    if (isVisibleHighlightElement(element)) {
      return element;
    }
  }

  for (const element of document.querySelectorAll<HTMLElement>(
    "p, span, div, section, article",
  )) {
    if (!isVisibleHighlightElement(element)) {
      continue;
    }

    const text = (element.innerText ?? "").trim();
    if (text.length < 20 || text.length > 600) {
      continue;
    }

    if (firstMatchingPattern(text, REVIEW_PATTERNS)) {
      return element;
    }
  }

  return null;
}

function findStructuralSocialProofElement(): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(
    "p, span, div, button, a, label, li, strong, em, small",
  )) {
    if (!isVisibleHighlightElement(element)) {
      continue;
    }

    const text = (element.innerText ?? "").trim();
    if (text.length < 3 || text.length > 200) {
      continue;
    }

    if (firstMatchingPattern(text, SOCIAL_PROOF_PATTERNS)) {
      return element;
    }
  }

  return null;
}

function findElementForDetection(
  detection: HighlightDetection,
): HTMLElement | null {
  const snippetMatch =
    detection.evidence.match(/Snippet:\s*`([^`]+)`/i) ??
    detection.evidence.match(/Snippet:\s*(<[^>\n]+>)/i);
  if (snippetMatch) {
    const fromSnippet = findElementFromHtmlSnippet(snippetMatch[1]);
    if (fromSnippet) {
      return fromSnippet;
    }
  }

  if (detection.category === "PRICING_DECEPTION") {
    return (
      findElementByPricingEvidence(detection.evidence) ??
      findStructuralPricingElement()
    );
  }

  if (detection.category === "SCARCITY") {
    return (
      findElementByScarcityEvidence(detection.evidence) ??
      findStructuralScarcityElement()
    );
  }

  if (isStickyOverlayDetection(detection)) {
    return (
      findElementByEvidence(detection.evidence) ??
      findStructuralPopupElement()
    );
  }

  if (isStickyPromoDetection(detection)) {
    return (
      findElementByEvidence(detection.evidence) ??
      findStructuralStickyPromoElement()
    );
  }

  const byEvidence = findElementByEvidence(detection.evidence);
  if (byEvidence) {
    return byEvidence;
  }

  if (
    detection.category === "NAGGING" ||
    patternTypesMatch(detection.patternType, "RepeatedPopupOrStickyBanner")
  ) {
    return findStructuralPopupElement();
  }

  if (
    detection.category === "FORCED_ACTION" &&
    patternTypesMatch(detection.patternType, "RequiredEnrollment")
  ) {
    return findStructuralEnrollmentElement();
  }

  if (detection.category === "SOCIAL_PROOF") {
    return (
      findElementByEvidence(detection.evidence) ??
      findStructuralReviewElement() ??
      findStructuralSocialProofElement()
    );
  }

  if (detection.category === "URGENCY") {
    for (const element of document.querySelectorAll<HTMLElement>(
      INTERACTIVE_SELECTORS,
    )) {
      const text = element.innerText ?? "";
      if (text.length < 4 || text.length > 400) {
        continue;
      }
      if (firstMatchingPattern(`${text}\n${element.outerHTML}`, URGENCY_PATTERNS)) {
        return element;
      }
    }

    return findElementByEvidence(detection.evidence);
  }

  return null;
}

function finalizeHighlights(seen: Map<Element, PageHighlight>): PageHighlight[] {
  const visible = Array.from(seen.values())
    .filter((highlight) => {
      const element = document.querySelector(
        `[${HIGHLIGHT_ID_ATTR}="${highlight.id}"]`,
      );
      return element instanceof HTMLElement && isVisibleHighlightElement(element);
    })
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  const countdowns = visible.filter(
    (highlight) => highlight.patternType === "CountdownTimer",
  );
  const rest = visible.filter(
    (highlight) => highlight.patternType !== "CountdownTimer",
  );

  return [...countdowns, ...rest].slice(0, MAX_HIGHLIGHTS);
}

export function enrichHighlightsFromDetections(
  existing: PageHighlight[],
  detections: HighlightDetection[],
  pageType: PageType,
): PageHighlight[] {
  const seen = new Map<Element, PageHighlight>();

  for (const highlight of existing) {
    const element = document.querySelector(
      `[${HIGHLIGHT_ID_ATTR}="${highlight.id}"]`,
    );
    if (element instanceof HTMLElement) {
      seen.set(element, highlight);
    }
  }

  const pricingDetections = detections.filter(
    (detection) => detection.category === "PRICING_DECEPTION",
  );
  const otherDetections = detections.filter(
    (detection) => detection.category !== "PRICING_DECEPTION",
  );

  for (const detection of [...pricingDetections, ...otherDetections]) {
    const element = findElementForDetection(detection);
    if (!element) {
      continue;
    }

    const target = highlightTarget(element);
    if (!(target instanceof HTMLElement)) {
      continue;
    }

    const existingForTarget = seen.get(target);
    if (existingForTarget) {
      seen.set(target, {
        ...existingForTarget,
        patternType: detection.patternType,
        evidence: detection.evidence || existingForTarget.evidence,
        severity:
          severityRank(detection.severity) >
          severityRank(existingForTarget.severity)
            ? detection.severity
            : existingForTarget.severity,
        label: labelForDetection(detection),
      });
      continue;
    }

    addCandidate(
      element,
      {
        category: detection.category as DetectionCategory,
        patternType: detection.patternType,
        severity: detection.severity,
        label: labelForDetection(detection),
        evidence: detection.evidence,
      },
      pageType,
      seen,
    );
  }

  return finalizeHighlights(seen);
}

export function collectPageHighlights(pageType: PageType): PageHighlight[] {
  const seen = new Map<Element, PageHighlight>();

  collectCountdownHighlights(pageType, seen);
  collectPreselectionHighlights(pageType, seen);
  collectPricingHighlights(pageType, seen);
  collectTextHighlights(pageType, seen);
  collectStickyHighlights(pageType, seen);

  return finalizeHighlights(seen);
}

export function clearHighlightMarkers(): void {
  for (const element of document.querySelectorAll(`[${HIGHLIGHT_ID_ATTR}]`)) {
    element.removeAttribute(HIGHLIGHT_ID_ATTR);
  }
}

export function resolveHighlightElement(
  highlight: PageHighlight,
): HTMLElement | null {
  const marked = document.querySelector(
    `[${HIGHLIGHT_ID_ATTR}="${highlight.id}"]`,
  );
  if (marked instanceof HTMLElement && isVisibleHighlightElement(marked)) {
    return marked;
  }

  return resolveHighlightElementForScroll(highlight);
}

export function resolveHighlightElementForScroll(
  highlight: PageHighlight,
  detection?: HighlightDetection,
): HTMLElement | null {
  const marked = document.querySelector(
    `[${HIGHLIGHT_ID_ATTR}="${highlight.id}"]`,
  );
  if (marked instanceof HTMLElement) {
    return marked;
  }

  const evidence = highlight.evidence ?? detection?.evidence ?? "";
  const detectionPayload: HighlightDetection = {
    category: detection?.category ?? highlight.category,
    patternType: detection?.patternType ?? highlight.patternType,
    severity: detection?.severity ?? highlight.severity,
    evidence,
  };

  const found = findElementForDetection(detectionPayload);
  if (!(found instanceof HTMLElement)) {
    return null;
  }

  const target = highlightTarget(found);
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  assignHighlightId(target);
  return target;
}

export function clearHighlightBoxes(): void {
  for (const box of document.querySelectorAll(`[${HIGHLIGHT_BOX_ATTR}]`)) {
    box.remove();
  }
}
