/// <reference types="wxt/client-types" />

import { runHeuristics } from "@darkpatterns/shared/heuristics";
import type {
  ExtensionAnalyzeResponse,
  PageHighlight,
  PageType,
} from "@darkpatterns/shared/types";
import {
  concernLevelFromScore,
  sanitizeText,
  suggestedActionForCategory,
} from "@darkpatterns/shared/wording";
import { analyzeWithBackend, fetchCachedReportFromBackend } from "../api/client";
import type { AnalyzePageMessage } from "../lib/messages";
import {
  clearUrlReportCache,
  getSettings,
  getTabReport,
  getUrlReportCache,
  isAnalyzableUrl,
  normalizeUrlForCache,
  setTabReport,
  setUrlReportCache,
  urlsMatchForCache,
} from "../lib/storage";

const debounceTimers = new Map<number, ReturnType<typeof setTimeout>>();
const inFlightUrls = new Set<string>();
const pendingHighlights = new Map<number, PageHighlight[]>();
const DEBOUNCE_MS = 2000;

function concernBadgeText(level: string): string {
  switch (level) {
    case "HIGH":
      return "!";
    case "MODERATE":
      return "M";
    case "SOME":
      return "S";
    case "LOW":
      return "OK";
    default:
      return "?";
  }
}

async function updateBadge(
  tabId: number,
  concernLevel: string | null,
  analyzing = false,
): Promise<void> {
  if (analyzing) {
    await chrome.action.setBadgeText({ tabId, text: "…" });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#1E40AF" });
    return;
  }

  if (!concernLevel) {
    await chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }

  await chrome.action.setBadgeText({
    tabId,
    text: concernBadgeText(concernLevel),
  });

  const color =
    concernLevel === "HIGH"
      ? "#DC2626"
      : concernLevel === "MODERATE"
        ? "#D97706"
        : concernLevel === "SOME"
          ? "#3B82F6"
          : "#16A34A";

  await chrome.action.setBadgeBackgroundColor({ tabId, color });
}

function buildLocalFallbackReport(
  url: string,
  pageTitle: string,
  heuristicSignals: ReturnType<typeof runHeuristics>,
): ExtensionAnalyzeResponse["scan"] {
  const riskScore =
    heuristicSignals.length === 0
      ? 5
      : Math.min(
          100,
          Math.round(
            heuristicSignals.reduce((sum, signal) => {
              const weight =
                signal.severity === "HIGH"
                  ? 45
                  : signal.severity === "MEDIUM"
                    ? 25
                    : 10;
              return sum + weight * signal.confidence;
            }, 0),
          ),
        );

  return {
    id: "local",
    url,
    normalizedUrl: url,
    status: "COMPLETED",
    riskScore,
    concernLevel: concernLevelFromScore(riskScore),
    summary: sanitizeText(
      heuristicSignals.length > 0
        ? `We found ${heuristicSignals.length} potential pressure cues locally. Backend sync failed — findings were not saved.`
        : "Unable to assess this page right now.",
    ),
    pageTitle,
    completedAt: new Date().toISOString(),
    detections: heuristicSignals.map((signal, index) => ({
      id: `local-${index}`,
      category: signal.category,
      patternType: signal.patternType,
      severity: signal.severity,
      description: sanitizeText(signal.description),
      evidence: signal.evidence,
      confidence: signal.confidence,
      suggestedAction: suggestedActionForCategory(signal.category),
    })),
  };
}

async function syncHighlightsToTab(
  tabId: number,
  highlights: PageHighlight[],
  visible: boolean,
  detections: ExtensionAnalyzeResponse["scan"]["detections"] = [],
): Promise<void> {
  try {
    if (!visible) {
      await chrome.tabs.sendMessage(tabId, { type: "CLEAR_PAGE_HIGHLIGHTS" });
      return;
    }

    if (highlights.length === 0 && detections.length === 0) {
      await chrome.tabs.sendMessage(tabId, { type: "CLEAR_PAGE_HIGHLIGHTS" });
      return;
    }

    await chrome.tabs.sendMessage(tabId, {
      type: "SET_PAGE_HIGHLIGHTS",
      highlights,
      detections,
      visible: true,
    });
  } catch {
    // Content script may not be ready on this tab.
  }
}

async function applyCachedReport(
  tabId: number,
  report: ExtensionAnalyzeResponse["scan"],
  highlights: PageHighlight[] = [],
): Promise<void> {
  await setTabReport(tabId, { status: "complete", report, highlights });
  await updateBadge(tabId, report.concernLevel);
  await syncHighlightsToTab(
    tabId,
    highlights,
    highlights.length > 0 || report.detections.length > 0,
    report.detections,
  );
}

async function hydrateTabFromCache(
  tabId: number,
  url: string,
): Promise<boolean> {
  const existing = await getTabReport(tabId);
  if (
    existing?.status === "complete" &&
    urlsMatchForCache(existing.report.normalizedUrl ?? existing.report.url, url)
  ) {
    return true;
  }

  let cached = await getUrlReportCache(url);
  if (!cached) {
    cached = await fetchCachedReportFromBackend(url);
    if (cached) {
      await setUrlReportCache(url, cached);
    }
  }

  if (!cached) {
    return false;
  }

  if (
    existing?.status === "complete" &&
    urlsMatchForCache(
      existing.report.normalizedUrl ?? existing.report.url,
      cached.normalizedUrl ?? cached.url,
    )
  ) {
    return true;
  }

  await applyCachedReport(tabId, cached);
  return true;
}

async function runAnalysis(
  tabId: number,
  payload: {
    url: string;
    pageTitle: string;
    visibleText: string;
    interactiveHtml: string;
    pageType: PageType;
  },
  force = false,
): Promise<void> {
  const settings = await getSettings();
  if (!settings.termsAcceptedAt) return;
  if (!settings.autoScanEnabled && !force) return;
  if (!isAnalyzableUrl(payload.url)) return;

  if (!force) {
    const hydrated = await hydrateTabFromCache(tabId, payload.url);
    if (hydrated) {
      return;
    }
  } else {
    await clearUrlReportCache(payload.url);
  }

  if (inFlightUrls.has(normalizeUrlForCache(payload.url)) && !force) {
    return;
  }

  inFlightUrls.add(normalizeUrlForCache(payload.url));

  const heuristicSignals = runHeuristics({
    visibleText: payload.visibleText,
    interactiveHtml: payload.interactiveHtml,
    pageType: payload.pageType,
  });

  await setTabReport(tabId, { status: "analyzing" });
  await updateBadge(tabId, null, true);
  await syncHighlightsToTab(tabId, [], false);

  const highlights = pendingHighlights.get(tabId) ?? [];

  try {
    const result = await analyzeWithBackend(
      {
        url: payload.url,
        pageTitle: payload.pageTitle,
        visibleText: payload.visibleText,
        interactiveHtml: payload.interactiveHtml,
        pageType: payload.pageType,
        heuristicSignals,
      },
      force,
    );

    await setUrlReportCache(payload.url, result.scan);
    await applyCachedReport(tabId, result.scan, highlights);
  } catch {
    const fallback = buildLocalFallbackReport(
      payload.url,
      payload.pageTitle,
      heuristicSignals,
    );

    await applyCachedReport(tabId, fallback, highlights);
  } finally {
    pendingHighlights.delete(tabId);
    inFlightUrls.delete(normalizeUrlForCache(payload.url));
  }
}

function scheduleAnalysis(
  tabId: number,
  payload: {
    url: string;
    pageTitle: string;
    visibleText: string;
    interactiveHtml: string;
    pageType: PageType;
  },
  force = false,
): void {
  const existing = debounceTimers.get(tabId);
  if (existing) clearTimeout(existing);

  debounceTimers.set(
    tabId,
    setTimeout(() => {
      debounceTimers.delete(tabId);
      void runAnalysis(tabId, payload, force);
    }, DEBOUNCE_MS),
  );
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  });

  chrome.tabs.onActivated.addListener((activeInfo) => {
    void (async () => {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (!isAnalyzableUrl(tab.url)) {
        await updateBadge(activeInfo.tabId, null);
        await setTabReport(activeInfo.tabId, { status: "idle" });
        await syncHighlightsToTab(activeInfo.tabId, [], false);
        return;
      }
      await hydrateTabFromCache(activeInfo.tabId, tab.url as string);

      const state = await getTabReport(activeInfo.tabId);
      if (state?.status === "complete") {
        const highlights = state.highlights ?? [];
        const detections = state.report.detections;
        if (highlights.length > 0 || detections.length > 0) {
          await syncHighlightsToTab(
            activeInfo.tabId,
            highlights,
            true,
            detections,
          );
        }
      }
    })();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return;
    if (!isAnalyzableUrl(tab.url)) return;

    void (async () => {
      const hydrated = await hydrateTabFromCache(tabId, tab.url as string);
      if (hydrated) {
        return;
      }

      // Avoid re-scanning when the tab already finished analysis (e.g. tab switch
      // or discarded-tab reload firing another "complete" without a URL change).
      const existing = await getTabReport(tabId);
      if (
        existing?.status === "complete" &&
        urlsMatchForCache(
          existing.report.normalizedUrl ?? existing.report.url,
          tab.url as string,
        )
      ) {
        return;
      }

      void chrome.tabs
        .sendMessage(tabId, { type: "ANALYZE_PAGE" })
        .catch(() => {
          // Content script may not be ready yet on some pages.
        });
    })();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "PAGE_CONTENT") {
      const tabId = sender.tab?.id;
      if (!tabId) return;
      if (!isAnalyzableUrl(message.url as string)) {
        sendResponse({ ok: true });
        return true;
      }

      scheduleAnalysis(
        tabId,
        {
          url: message.url as string,
          pageTitle: message.pageTitle as string,
          visibleText: message.visibleText as string,
          interactiveHtml: message.interactiveHtml as string,
          pageType: (message.pageType as PageType | undefined) ?? "general",
        },
        Boolean(message.force),
      );
      pendingHighlights.set(
        tabId,
        (message.highlights as PageHighlight[] | undefined) ?? [],
      );
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "RESCAN_PAGE") {
      void (async () => {
        const tabId =
          (message.tabId as number | undefined) ??
          sender.tab?.id ??
          (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
            ?.id;

        if (!tabId) {
          sendResponse({ ok: false, error: "No active tab found." });
          return;
        }

        const tab = await chrome.tabs.get(tabId);
        if (!isAnalyzableUrl(tab.url)) {
          sendResponse({
            ok: false,
            error: "This page is not eligible for scanning.",
          });
          return;
        }

        await clearUrlReportCache(tab.url as string);
        await setTabReport(tabId, { status: "analyzing" });
        await updateBadge(tabId, null, true);
        await syncHighlightsToTab(tabId, [], false);
        pendingHighlights.delete(tabId);

        try {
          await chrome.tabs.sendMessage(tabId, {
            type: "ANALYZE_PAGE",
            force: true,
          } satisfies AnalyzePageMessage);
          sendResponse({ ok: true });
        } catch {
          sendResponse({
            ok: false,
            error:
              "Could not reach this page. Try refreshing the tab, then rescan.",
          });
        }
      })();

      return true;
    }

    if (message?.type === "SHOULD_ANALYZE") {
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse({ shouldAnalyze: false });
        return true;
      }

      void (async () => {
        const url = message.url as string;
        if (!isAnalyzableUrl(url)) {
          sendResponse({ shouldAnalyze: false });
          return;
        }
        const hydrated = await hydrateTabFromCache(tabId, url);
        sendResponse({ shouldAnalyze: !hydrated });
      })();

      return true;
    }

    if (message?.type === "HIGHLIGHTS_UPDATED") {
      const tabId = sender.tab?.id;
      if (!tabId) return;

      void (async () => {
        const state = await getTabReport(tabId);
        if (state?.status === "complete") {
          await setTabReport(tabId, {
            ...state,
            highlights: message.highlights as PageHighlight[],
          });
        }
      })();

      return true;
    }

    if (message?.type === "TOGGLE_PAGE_HIGHLIGHTS") {
      void (async () => {
        const tabId =
          (message.tabId as number | undefined) ??
          (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
            ?.id;

        if (!tabId) {
          sendResponse({ ok: false, error: "No active tab found." });
          return;
        }

        const state = await getTabReport(tabId);
        const highlights =
          state?.status === "complete" ? (state.highlights ?? []) : [];
        const detections =
          state?.status === "complete" ? state.report.detections : [];

        await syncHighlightsToTab(
          tabId,
          highlights,
          Boolean(message.visible),
          detections,
        );
        sendResponse({ ok: true });
      })();

      return true;
    }

    if (message?.type === "SCROLL_TO_HIGHLIGHT") {
      void (async () => {
        const tabId =
          (message.tabId as number | undefined) ??
          (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
            ?.id;

        if (!tabId) {
          sendResponse({ ok: false, error: "No active tab found." });
          return;
        }

        try {
          await chrome.tabs.sendMessage(tabId, {
            type: "SCROLL_TO_HIGHLIGHT",
            highlightId: message.highlightId as string,
          });
          sendResponse({ ok: true });
        } catch {
          sendResponse({
            ok: false,
            error: "Could not scroll to highlight on this page.",
          });
        }
      })();

      return true;
    }

    return false;
  });
});
