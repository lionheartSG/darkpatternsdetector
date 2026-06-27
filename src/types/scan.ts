import type { ScanErrorCode } from "@/lib/scan-errors";

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

export type PageHighlight = {
  id: string;
  category: DetectionCategory;
  patternType: string;
  severity: DetectionSeverity;
  label: string;
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

export type HeuristicSignal = {
  category: DetectionCategory;
  patternType: string;
  severity: DetectionSeverity;
  description: string;
  evidence: string;
  confidence: number;
  source: "heuristic";
};

export type AnalysisDetection = {
  category: DetectionCategory;
  patternType: string;
  severity: DetectionSeverity;
  description: string;
  evidence: string;
  confidence: number;
};

export type ScanResultPayload = {
  riskScore: number;
  summary: string;
  detections: AnalysisDetection[];
};

export type ScanWithDetections = {
  id: string;
  url: string;
  normalizedUrl: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  riskScore: number | null;
  summary: string | null;
  pageTitle: string | null;
  finalUrl: string | null;
  errorMessage: string | null;
  viewportScreenshot: string | null;
  screenshotCapturedAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
  detections: Array<{
    id: string;
    category: string;
    patternType: string;
    severity: DetectionSeverity;
    description: string;
    evidence: string;
    confidence: number;
  }>;
};

export type SubmitScanResult =
  | { ok: true; scanId: string }
  | {
      ok: false;
      error: string;
      code?: ScanErrorCode;
      scanId?: string;
    };

export type GetScanResult =
  | { ok: true; scan: ScanWithDetections }
  | { ok: false; error: string };
