import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { buildAnalysisPrompt, SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { scanResultSchema } from "@/lib/ai/schemas";
import { buildSafeSummary } from "@/lib/constants/wording";
import { sanitizeWording } from "@/lib/wording/sanitize";
import type {
  AnalysisDetection,
  HeuristicSignal,
  PageType,
  ScanResultPayload,
} from "@/types/scan";

function getModel() {
  const modelName = process.env.AI_MODEL ?? "gpt-4o";
  return openai(modelName);
}

function sanitizeDetections(
  detections: AnalysisDetection[],
): AnalysisDetection[] {
  return detections.map((detection) => ({
    ...detection,
    description: sanitizeWording(detection.description),
    evidence: sanitizeWording(detection.evidence),
    patternType: sanitizeWording(detection.patternType),
  }));
}

export async function analyzePage(input: {
  url: string;
  pageTitle: string;
  visibleText: string;
  interactiveHtml: string;
  pageType?: PageType;
  heuristicSignals: HeuristicSignal[];
}): Promise<ScanResultPayload> {
  if (!process.env.OPENAI_API_KEY) {
    return buildFallbackResult(input.heuristicSignals);
  }

  const heuristicSummary = input.heuristicSignals
    .map(
      (signal) =>
        `- ${signal.category}/${signal.patternType}: ${signal.description} (evidence: ${signal.evidence})`,
    )
    .join("\n");

  const result = await generateObject({
    model: getModel(),
    system: SYSTEM_PROMPT,
    prompt: buildAnalysisPrompt({
      url: input.url,
      pageTitle: input.pageTitle,
      visibleText: input.visibleText,
      interactiveHtml: input.interactiveHtml,
      heuristicSignals: heuristicSummary,
      pageType: input.pageType,
    }),
    schema: scanResultSchema,
  });

  const detections = sanitizeDetections(result.object.detections);

  return {
    riskScore: result.object.riskScore,
    summary: sanitizeWording(result.object.summary),
    detections,
  };
}

function buildFallbackResult(
  heuristicSignals: HeuristicSignal[],
): ScanResultPayload {
  const detections = sanitizeDetections(
    heuristicSignals.map((signal) => ({
      category: signal.category,
      patternType: signal.patternType,
      severity: signal.severity,
      description: signal.description,
      evidence: signal.evidence,
      confidence: signal.confidence,
    })),
  );

  const riskScore = computeRiskScore(detections);

  return {
    riskScore,
    summary:
      detections.length > 0
        ? buildSafeSummary(detections.length)
        : "No major pressure cues were detected by automated checks in this scan.",
    detections,
  };
}

export function computeRiskScore(
  detections: Array<{
    severity: "LOW" | "MEDIUM" | "HIGH";
    confidence: number;
  }>,
): number {
  if (detections.length === 0) return 5;

  const weights = { LOW: 10, MEDIUM: 25, HIGH: 45 } as const;
  const raw = detections.reduce(
    (sum, detection) =>
      sum + weights[detection.severity] * detection.confidence,
    0,
  );

  return Math.min(100, Math.round(raw));
}

export function mergeDetections(
  heuristicSignals: HeuristicSignal[],
  aiDetections: AnalysisDetection[],
): AnalysisDetection[] {
  const merged: AnalysisDetection[] = [...aiDetections];

  for (const signal of heuristicSignals) {
    const duplicate = merged.some(
      (detection) =>
        detection.category === signal.category &&
        detection.patternType === signal.patternType &&
        normalizeEvidence(detection.evidence) ===
          normalizeEvidence(signal.evidence),
    );

    if (!duplicate) {
      merged.push({
        category: signal.category,
        patternType: signal.patternType,
        severity: signal.severity,
        description: signal.description,
        evidence: signal.evidence,
        confidence: signal.confidence,
      });
    }
  }

  return merged.sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );
}

function normalizeEvidence(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function severityRank(severity: "LOW" | "MEDIUM" | "HIGH"): number {
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
