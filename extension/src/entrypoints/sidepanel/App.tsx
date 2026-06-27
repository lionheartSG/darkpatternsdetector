import { formatDateTimeSGT } from "@darkpatterns/shared/date";
import type { ExtensionAnalyzeResponse } from "@darkpatterns/shared/types";
import {
  concernLevelLabel,
  DECISION_CHECKLIST,
  HOME_DISCLAIMER,
  REPORT_DISCLAIMER,
  sanitizeText,
} from "@darkpatterns/shared/wording";
import { useCallback, useEffect, useState } from "react";
import type { PageHighlight } from "@darkpatterns/shared/types";
import type { TabReportState } from "../../lib/messages";
import { getSettings, getTabReport, isAnalyzableUrl } from "../../lib/storage";

type Report = ExtensionAnalyzeResponse["scan"];

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

  const refresh = useCallback(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;

    setActiveTabId(tab.id);
    setTabUrl(tab.url ?? "");
    const settings = await getSettings();
    setTermsAccepted(Boolean(settings.termsAcceptedAt));

    const state = await getTabReport(tab.id);
    setReportState(state ?? { status: "idle" });
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 2000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const handleRescan = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;

    setReportState({ status: "analyzing" });

    const response = (await chrome.runtime.sendMessage({
      type: "RESCAN_PAGE",
      tabId: tab.id,
    })) as { ok?: boolean; error?: string } | undefined;

    if (!response?.ok) {
      const state = await getTabReport(tab.id);
      setReportState(
        state ?? {
          status: "error",
          error: response?.error ?? "Unable to start rescan on this page.",
        },
      );
    }
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

  const handleScrollToHighlight = async (highlight: PageHighlight) => {
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
    });
  };

  const findHighlightForDetection = (
    highlights: PageHighlight[],
    category: string,
    patternType: string,
  ): PageHighlight | undefined => {
    return (
      highlights.find(
        (highlight) =>
          highlight.category === category &&
          highlight.patternType === patternType,
      ) ??
      highlights.find((highlight) => highlight.category === category)
    );
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
        <span className={`badge badge-${report.concernLevel.toLowerCase()}`}>
          {concernLevelLabel(report.concernLevel)}
        </span>
      </header>

      <p className="url" title={report.url}>
        {report.url}
      </p>
      {scannedAt ? <p className="muted">Scanned on {scannedAt}</p> : null}

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
                const highlight = findHighlightForDetection(
                  highlights,
                  detection.category,
                  detection.patternType,
                );

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
                        void handleScrollToHighlight(highlight);
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
