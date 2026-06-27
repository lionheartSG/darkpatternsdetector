import type { ExtensionAnalyzeResponse } from "@darkpatterns/shared/types";
import { sanitizeText } from "@darkpatterns/shared/wording";
import {
  analyzePage,
  computeRiskScore,
  mergeDetections,
} from "@/lib/ai/analyze-page";
import { extensionAnalyzeSchema } from "@/lib/extension/schema";
import { prisma } from "@/lib/prisma";
import {
  deleteScansByNormalizedUrl,
  findCachedScanByNormalizedUrl,
  normalizeScanUrl,
  toExtensionAnalyzeResponse,
} from "@/lib/scan-cache";

export async function analyzeExtensionPage(
  body: unknown,
): Promise<ExtensionAnalyzeResponse | { ok: false; error: string }> {
  const parsed = extensionAnalyzeSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request payload.",
    };
  }

  const input = parsed.data;
  const normalizedUrl = normalizeScanUrl(input.url);
  if (!normalizedUrl) {
    return { ok: false, error: "Invalid URL." };
  }

  if (!input.force) {
    const cached = await findCachedScanByNormalizedUrl(normalizedUrl);
    if (cached) {
      return toExtensionAnalyzeResponse(cached);
    }
  } else {
    await deleteScansByNormalizedUrl(normalizedUrl);
  }

  const scan = await prisma.scan.create({
    data: {
      url: input.url,
      normalizedUrl,
      status: "PROCESSING",
    },
  });

  try {
    const analysis = await analyzePage({
      url: normalizedUrl,
      pageTitle: input.pageTitle,
      visibleText: input.visibleText,
      interactiveHtml: input.interactiveHtml,
      pageType: input.pageType,
      heuristicSignals: input.heuristicSignals,
    });

    const detections = mergeDetections(
      input.heuristicSignals,
      analysis.detections,
    );
    const riskScore = computeRiskScore(detections);
    const summary = sanitizeText(analysis.summary);
    const completedAt = new Date();

    const updated = await prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: "COMPLETED",
        riskScore,
        summary,
        pageTitle: input.pageTitle,
        finalUrl: normalizedUrl,
        completedAt,
        detections: {
          create: detections.map((detection) => ({
            category: detection.category,
            patternType: detection.patternType,
            severity: detection.severity,
            description: sanitizeText(detection.description),
            evidence: detection.evidence,
            confidence: detection.confidence,
          })),
        },
      },
      include: {
        detections: {
          orderBy: [{ severity: "desc" }, { confidence: "desc" }],
        },
      },
    });

    return toExtensionAnalyzeResponse(updated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to analyze this page.";

    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        completedAt: new Date(),
      },
    });

    return { ok: false, error: "Unable to analyze this page right now." };
  }
}
