export const DETECTION_CATEGORIES = [
  "URGENCY",
  "SCARCITY",
  "SNEAKING",
  "MISDIRECTION",
  "SOCIAL_PROOF",
  "OBSTRUCTION",
  "FORCED_ACTION",
  "PRICING_DECEPTION",
  "NAGGING",
  "PRESELECTION",
] as const;

export type DetectionCategory = (typeof DETECTION_CATEGORIES)[number];

export type DetectionSeverity = "LOW" | "MEDIUM" | "HIGH";

export type ConcernLevel = "LOW" | "SOME" | "MODERATE" | "HIGH" | "UNABLE";

export type HeuristicSignal = {
  category: DetectionCategory;
  patternType: string;
  severity: DetectionSeverity;
  description: string;
  evidence: string;
  confidence: number;
  source: "heuristic";
};

export type PageHighlight = {
  id: string;
  category: DetectionCategory;
  patternType: string;
  severity: DetectionSeverity;
  label: string;
  /** Evidence snippet used to link this highlight back to a detection. */
  evidence?: string;
};

export type AnalysisDetection = {
  category: DetectionCategory;
  patternType: string;
  severity: DetectionSeverity;
  description: string;
  evidence: string;
  confidence: number;
  suggestedAction?: string;
};

export type ScanResultPayload = {
  riskScore: number;
  summary: string;
  detections: AnalysisDetection[];
};

export type PageType = "editorial" | "general";

export type ExtensionAnalyzePayload = {
  url: string;
  pageTitle: string;
  visibleText: string;
  interactiveHtml: string;
  pageType: PageType;
  heuristicSignals: HeuristicSignal[];
  scannedAt: string;
  source: "chrome-extension";
  force?: boolean;
};

export type ExtensionAnalyzeResponse = {
  ok: true;
  scan: {
    id: string;
    url: string;
    normalizedUrl: string;
    status: "COMPLETED" | "FAILED";
    riskScore: number | null;
    concernLevel: ConcernLevel;
    summary: string | null;
    pageTitle: string | null;
    completedAt: string | null;
    detections: Array<{
      id: string;
      category: string;
      patternType: string;
      severity: DetectionSeverity;
      description: string;
      evidence: string;
      confidence: number;
      suggestedAction: string | null;
    }>;
  };
};

export type ExtensionAnalyzeError = {
  ok: false;
  error: string;
};
