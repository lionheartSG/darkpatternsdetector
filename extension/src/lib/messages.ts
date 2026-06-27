import type { ExtensionAnalyzeResponse, PageHighlight } from "@darkpatterns/shared/types";

export type MessageType =
  | "ANALYZE_PAGE"
  | "ANALYZE_RESULT"
  | "ANALYZE_ERROR"
  | "GET_TAB_REPORT"
  | "RESCAN_PAGE"
  | "SHOULD_ANALYZE"
  | "SET_PAGE_HIGHLIGHTS"
  | "TOGGLE_PAGE_HIGHLIGHTS"
  | "SCROLL_TO_HIGHLIGHT"
  | "CLEAR_PAGE_HIGHLIGHTS"
  | "HIGHLIGHTS_UPDATED"
  | "TAB_REPORT_UPDATED";

export type AnalyzePageMessage = {
  type: "ANALYZE_PAGE";
  force?: boolean;
};

export type ShouldAnalyzeMessage = {
  type: "SHOULD_ANALYZE";
  url: string;
};

export type AnalyzeResultMessage = {
  type: "ANALYZE_RESULT";
  tabId: number;
  report: ExtensionAnalyzeResponse["scan"];
};

export type AnalyzeErrorMessage = {
  type: "ANALYZE_ERROR";
  tabId: number;
  error: string;
  localOnly?: boolean;
};

export type GetTabReportMessage = {
  type: "GET_TAB_REPORT";
};

export type RescanPageMessage = {
  type: "RESCAN_PAGE";
  tabId?: number;
};

export type SetPageHighlightsMessage = {
  type: "SET_PAGE_HIGHLIGHTS";
  highlights: PageHighlight[];
  detections?: Array<{
    category: string;
    patternType: string;
    severity: PageHighlight["severity"];
    evidence: string;
  }>;
  visible: boolean;
  reportId?: string;
};

export type HighlightsUpdatedMessage = {
  type: "HIGHLIGHTS_UPDATED";
  highlights: PageHighlight[];
  reportId?: string;
};

export type TabReportUpdatedMessage = {
  type: "TAB_REPORT_UPDATED";
  tabId: number;
};

export type TogglePageHighlightsMessage = {
  type: "TOGGLE_PAGE_HIGHLIGHTS";
  tabId?: number;
  visible: boolean;
};

export type ScrollToHighlightMessage = {
  type: "SCROLL_TO_HIGHLIGHT";
  tabId?: number;
  highlightId: string;
  highlight?: PageHighlight;
  detection?: {
    category: string;
    patternType: string;
    severity: PageHighlight["severity"];
    evidence: string;
  };
};

export type ClearPageHighlightsMessage = {
  type: "CLEAR_PAGE_HIGHLIGHTS";
};

export type ExtensionMessage =
  | AnalyzePageMessage
  | AnalyzeResultMessage
  | AnalyzeErrorMessage
  | GetTabReportMessage
  | RescanPageMessage
  | ShouldAnalyzeMessage
  | SetPageHighlightsMessage
  | TogglePageHighlightsMessage
  | ScrollToHighlightMessage
  | ClearPageHighlightsMessage
  | HighlightsUpdatedMessage
  | TabReportUpdatedMessage;

export type TabReportState =
  | { status: "idle" }
  | { status: "analyzing" }
  | { status: "complete"; report: ExtensionAnalyzeResponse["scan"]; highlights?: PageHighlight[] }
  | { status: "error"; error: string; localOnly?: boolean };
