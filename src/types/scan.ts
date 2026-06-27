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
  | { ok: false; error: string };

export type GetScanResult =
  | { ok: true; scan: ScanWithDetections }
  | { ok: false; error: string };
