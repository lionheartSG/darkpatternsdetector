import { formatDateTimeSGT } from "@darkpatterns/shared/date";
import { matchHighlightToDetection } from "@darkpatterns/shared/highlight-matching";
import type { ExtensionAnalyzeResponse } from "@darkpatterns/shared/types";
import {
  DECISION_CHECKLIST,
  HOME_DISCLAIMER,
  REPORT_DISCLAIMER,
  sanitizeText,
} from "@darkpatterns/shared/wording";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PageHighlight } from "@darkpatterns/shared/types";
import type { TabReportState } from "../../lib/messages";
import { RiskGauge } from "../../components/RiskGauge";
import { getSettings, getTabReport, isAnalyzableUrl } from "../../lib/storage";

type Report = ExtensionAnalyzeResponse["scan"];

function isScanNewerThan(
  candidate: { id: string; completedAt: string | null },
  current: { id: string; completedAt: string | null },
): boolean {
  if (candidate.id === current.id) {
    return false;
  }

  const candidateAt = candidate.completedAt
    ? new Date(candidate.completedAt).getTime()
    : 0;
  const currentAt = current.completedAt
    ? new Date(current.completedAt).getTime()
    : 0;

  return candidateAt >= currentAt;
}

function mergeReportState(
  previous: TabReportState,
  next: TabReportState | null,
  rescanStartedAt: number | null,
  rescanBaselineScanId: string | null,
): TabReportState {
  const resolved = next ?? { status: "idle" as const };

  if (previous.status === "complete" && resolved.status === "complete") {
    if (isScanNewerThan(resolved.report, previous.report)) {
      return resolved;
    }
    if (isScanNewerThan(previous.report, resolved.report)) {
      return previous;
    }
    return resolved;
  }

  if (previous.status !== "analyzing") {
    return resolved;
  }

  if (resolved.status === "analyzing") {
    return resolved;
  }

  if (resolved.status === "error") {
    return resolved;
  }

  if (resolved.status === "complete") {
    if (
      rescanBaselineScanId &&
      resolved.report.id !== rescanBaselineScanId
    ) {
      return resolved;
    }

    const completedAt = resolved.report.completedAt;
    if (
      rescanStartedAt &&
      completedAt &&
      new Date(completedAt).getTime() < rescanStartedAt
    ) {
      return previous;
    }
    return resolved;
  }

  return previous;
}

function groupDetections(report: Report) {
  const groups = new Map<string, Report["detections"]>();
  for (const detection of report.detections) {
    const existing = groups.get(detection.category) ?? [];
    existing.push(detection);
    groups.set(detection.category, existing);
  }
  return Array.from(groups.entries());
}

export function SidePanelApp() {
  const [reportState, setReportState] = useState<TabReportState>({
    status: "idle",
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [tabUrl, setTabUrl] = useState<string>("");
  const [highlightsVisible, setHighlightsVisible] = useState(true);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const rescanStartedAtRef = useRef<number | null>(null);
  const rescanBaselineScanIdRef = useRef<string | null>(null);
  const trackedTabIdRef = useRef<number | null>(null);
  const trackedTabUrlRef = useRef<string>("");

  const clearRescanTracking = useCallback(() => {
    rescanStartedAtRef.current = null;
    rescanBaselineScanIdRef.current = null;
  }, []);

  const refresh = useCallback(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;

    const nextTabUrl = tab.url ?? "";
    const tabChanged = trackedTabIdRef.current !== tab.id;
    const urlChanged = trackedTabUrlRef.current !== nextTabUrl;
    const contextChanged = tabChanged || urlChanged;

    if (contextChanged) {
      trackedTabIdRef.current = tab.id;
      trackedTabUrlRef.current = nextTabUrl;
      clearRescanTracking();
      setHighlightsVisible(true);
    }

    setActiveTabId(tab.id);
    setTabUrl(nextTabUrl);
    const settings = await getSettings();
    setTermsAccepted(Boolean(settings.termsAcceptedAt));

    const state = await getTabReport(tab.id);

    if (contextChanged) {
      setReportState(state ?? { status: "idle" });
    } else {
      setReportState((previous) =>
        mergeReportState(
          previous,
          state,
          rescanStartedAtRef.current,
          rescanBaselineScanIdRef.current,
        ),
      );
    }

    if (state?.status !== "complete" || !rescanStartedAtRef.current) {
      return;
    }

    if (
      rescanBaselineScanIdRef.current &&
      state.report.id !== rescanBaselineScanIdRef.current
    ) {
      clearRescanTracking();
      return;
    }

    if (
      state.report.completedAt &&
      new Date(state.report.completedAt).getTime() >=
        rescanStartedAtRef.current
    ) {
      clearRescanTracking();
    }
  }, [clearRescanTracking]);

  useEffect(() => {
    void refresh();

    const onMessage = (message: unknown) => {
      if (
        message &&
        typeof message === "object" &&
        (message as { type?: string }).type === "TAB_REPORT_UPDATED"
      ) {
        void refresh();
      }
    };

    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "session") {
        return;
      }

      if (Object.keys(changes).some((key) => key.startsWith("tabReport:"))) {
        void refresh();
      }
    };

    const onTabActivated = () => {
      void refresh();
    };

    const onTabUpdated = (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
    ) => {
      if (changeInfo.url && trackedTabIdRef.current === tabId) {
        void refresh();
      }
    };

    chrome.runtime.onMessage.addListener(onMessage);
    chrome.storage.onChanged.addListener(onStorageChanged);
    chrome.tabs.onActivated.addListener(onTabActivated);
    chrome.tabs.onUpdated.addListener(onTabUpdated);

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.storage.onChanged.removeListener(onStorageChanged);
      chrome.tabs.onActivated.removeListener(onTabActivated);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
    };
  }, [refresh]);

  useEffect(() => {
    if (reportState.status !== "analyzing") {
      return;
    }

    const interval = window.setInterval(() => {
      void refresh();
    }, 2000);

    return () => window.clearInterval(interval);
  }, [reportState.status, refresh]);

  const handleRescan = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;

    rescanStartedAtRef.current = Date.now();
    rescanBaselineScanIdRef.current =
      reportState.status === "complete" ? reportState.report.id : null;
    setReportState({ status: "analyzing" });

    const response = (await chrome.runtime.sendMessage({
      type: "RESCAN_PAGE",
      tabId: tab.id,
    })) as { ok?: boolean; error?: string } | undefined;

    if (!response?.ok) {
      clearRescanTracking();
      const state = await getTabReport(tab.id);
      setReportState(
        state ?? {
          status: "error",
          error: response?.error ?? "Unable to start rescan on this page.",
        },
      );
      return;
    }

    void refresh();
  };

  const handleToggleHighlights = async () => {
    if (!activeTabId) return;

    const nextVisible = !highlightsVisible;
    setHighlightsVisible(nextVisible);

    await chrome.runtime.sendMessage({
      type: "TOGGLE_PAGE_HIGHLIGHTS",
      tabId: activeTabId,
      visible: nextVisible,
    });
  };

  const handleScrollToHighlight = async (
    highlight: PageHighlight,
    detection: {
      category: string;
      patternType: string;
      severity: PageHighlight["severity"];
      evidence: string;
    },
  ) => {
    if (!activeTabId) return;

    setHighlightsVisible(true);
    await chrome.runtime.sendMessage({
      type: "TOGGLE_PAGE_HIGHLIGHTS",
      tabId: activeTabId,
      visible: true,
    });
    await chrome.runtime.sendMessage({
      type: "SCROLL_TO_HIGHLIGHT",
      tabId: activeTabId,
      highlightId: highlight.id,
      highlight,
      detection,
    });
  };

  if (!termsAccepted) {
    return (
      <main className="panel">
        <h1>Dark Patterns Detector</h1>
        <p className="muted">{HOME_DISCLAIMER}</p>
        <p className="muted">
          Accept the terms in extension options before auto-scan can run.
        </p>
        <button
          type="button"
          className="button"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Open options
        </button>
      </main>
    );
  }

  if (!isAnalyzableUrl(tabUrl)) {
    return (
      <main className="panel">
        <h1>Dark Patterns Detector</h1>
        <p className="muted">{tabUrl || "Browser page"}</p>
        <p>This page is not scanned.</p>
      </main>
    );
  }

  if (reportState.status !== "complete") {
    return (
      <main className="panel">
        <h1>Dark Patterns Detector</h1>
        <p className="muted">{tabUrl || "Waiting for page analysis…"}</p>
        <p>
          {reportState.status === "analyzing"
            ? "Analyzing…"
            : reportState.status === "error"
              ? reportState.error
              : "Starting analysis…"}
        </p>
        <button
          type="button"
          className="button secondary"
          onClick={handleRescan}
        >
          Rescan page
        </button>
      </main>
    );
  }

  const report = reportState.report;
  const highlights = reportState.highlights ?? [];
  const grouped = groupDetections(report);
  const scannedAt = report.completedAt
    ? formatDateTimeSGT(new Date(report.completedAt))
    : null;

  return (
    <main className="panel">
      <header className="header">
        <h1>Scan report</h1>
      </header>

      <p className="url" title={report.url}>
        {report.url}
      </p>
      {scannedAt ? (
        <p className="muted" key={report.id}>
          Scanned on {scannedAt}
        </p>
      ) : null}

      <section className="card risk-gauge-card">
        <RiskGauge score={report.riskScore ?? 0} />
      </section>

      {highlights.length > 0 ? (
        <section className="card">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={highlightsVisible}
              onChange={() => {
                void handleToggleHighlights();
              }}
            />
            <span>Show {highlights.length} highlight(s) on page</span>
          </label>
          <p className="muted small">
            Red = high concern, amber = medium. Up to {highlights.length}{" "}
            visible pressure cue{highlights.length === 1 ? "" : "s"} marked on
            this page.
          </p>
        </section>
      ) : null}

      <section className="card">
        <h2>{report.pageTitle ?? "Analysis summary"}</h2>
        <p>{sanitizeText(report.summary ?? "No summary available.")}</p>
        <p className="muted small">{REPORT_DISCLAIMER}</p>
      </section>

      {grouped.length > 0 ? (
        <section>
          <h2>Detected cues</h2>
          {grouped.map(([category, detections]) => (
            <div key={category} className="card">
              <h3>{category.replaceAll("_", " ")}</h3>
              {detections.map((detection) => {
                const matched = matchHighlightToDetection(
                  highlights,
                  detection,
                );
                const highlight = matched
                  ? {
                      ...matched,
                      evidence: matched.evidence ?? detection.evidence,
                    }
                  : null;

                return (
                <article key={detection.id} className="finding">
                  <strong>{detection.patternType}</strong>
                  <p>{sanitizeText(detection.description)}</p>
                  <p className="muted small">Evidence: {detection.evidence}</p>
                  <p className="muted small">
                    Confidence: {Math.round(detection.confidence * 100)}%
                  </p>
                  {highlight ? (
                    <button
                      type="button"
                      className="button-link"
                      onClick={() => {
                        void handleScrollToHighlight(highlight, {
                          category: detection.category,
                          patternType: detection.patternType,
                          severity: detection.severity,
                          evidence: detection.evidence,
                        });
                      }}
                    >
                      Show on page
                    </button>
                  ) : null}
                  {detection.suggestedAction ? (
                    <p className="action">{detection.suggestedAction}</p>
                  ) : null}
                  <p className="muted small">
                    This does not mean the offer is false.
                  </p>
                </article>
              );
              })}
            </div>
          ))}
        </section>
      ) : (
        <section className="card">
          <p>No potential pressure cues were detected on this page.</p>
        </section>
      )}

      <section className="card">
        <h2>What you can do next</h2>
        <ul>
          {DECISION_CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <button type="button" className="button secondary" onClick={handleRescan}>
        Rescan page
      </button>
    </main>
  );
}
