import { detectPageType } from "@darkpatterns/shared/page-context";
import type { PageHighlight, PageType } from "@darkpatterns/shared/types";
import { collectPageHighlights } from "./highlights";

const INTERACTIVE_SELECTORS = [
  "input",
  "button",
  "a",
  '[role="dialog"]',
  '[class*="modal"]',
  '[class*="popup"]',
  '[class*="overlay"]',
  '[class*="countdown"]',
  '[class*="timer"]',
  '[class*="sticky"]',
  '[style*="position: fixed"]',
  '[style*="position:fixed"]',
].join(",");

const MAX_TEXT_LENGTH = 12_000;
const MAX_HTML_LENGTH = 12_000;

export type ExtractedPage = {
  url: string;
  pageTitle: string;
  visibleText: string;
  interactiveHtml: string;
  pageType: PageType;
  highlights: PageHighlight[];
};

export function extractPageContent(): ExtractedPage {
  const pageType = detectPageType(document);
  const visibleText = (document.body?.innerText ?? "").slice(
    0,
    MAX_TEXT_LENGTH,
  );
  const interactiveHtml = buildInteractiveHtml();
  const highlights = collectPageHighlights(pageType);
  return {
    url: window.location.href,
    pageTitle: document.title.slice(0, 500),
    visibleText,
    interactiveHtml,
    pageType,
    highlights,
  };
}

function buildInteractiveHtml(): string {
  const parts: string[] = [];

  for (const element of document.querySelectorAll(INTERACTIVE_SELECTORS)) {
    if (parts.join("\n").length >= MAX_HTML_LENGTH) break;
    const html = element.outerHTML.slice(0, 500);
    parts.push(html);
  }

  for (const element of document.querySelectorAll<HTMLElement>("*")) {
    if (parts.join("\n").length >= MAX_HTML_LENGTH) break;
    const style = window.getComputedStyle(element);
    if (style.position === "fixed" || style.position === "sticky") {
      parts.push(
        `<div data-dpd-overlay="${style.position}">${element.outerHTML.slice(0, 300)}</div>`,
      );
    }
  }

  return parts.join("\n").slice(0, MAX_HTML_LENGTH);
}

export function hookSpaNavigation(onNavigate: () => void): () => void {
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = (...args) => {
    originalPushState(...args);
    onNavigate();
  };

  history.replaceState = (...args) => {
    originalReplaceState(...args);
    onNavigate();
  };

  window.addEventListener("popstate", onNavigate);

  return () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener("popstate", onNavigate);
  };
}
