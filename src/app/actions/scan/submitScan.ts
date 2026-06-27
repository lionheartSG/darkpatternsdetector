"use server";

import {
  analyzePage,
  computeRiskScore,
  mergeDetections,
} from "@/lib/ai/analyze-page";
import { fetchPage } from "@/lib/fetch-page";
import { runHeuristics } from "@/lib/heuristics";
import { prisma } from "@/lib/prisma";
import { validateScanUrl } from "@/lib/url-validation";
import type { SubmitScanResult } from "@/types/scan";

export async function submitScan(rawUrl: string): Promise<SubmitScanResult> {
  const validation = await validateScanUrl(rawUrl);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const scan = await prisma.scan.create({
    data: {
      url: rawUrl.trim(),
      normalizedUrl: validation.normalizedUrl,
      status: "PROCESSING",
    },
  });

  try {
    const page = await fetchPage(validation.normalizedUrl);
    const heuristicSignals = runHeuristics({
      visibleText: page.visibleText,
      interactiveHtml: page.interactiveHtml,
    });

    const analysis = await analyzePage({
      url: validation.normalizedUrl,
      pageTitle: page.pageTitle,
      visibleText: page.visibleText,
      interactiveHtml: page.interactiveHtml,
      heuristicSignals,
    });

    const detections = mergeDetections(heuristicSignals, analysis.detections);
    const riskScore = computeRiskScore(detections);

    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: "COMPLETED",
        riskScore,
        summary: analysis.summary,
        pageTitle: page.pageTitle,
        finalUrl: page.finalUrl,
        completedAt: new Date(),
        detections: {
          create: detections.map((detection) => ({
            category: detection.category,
            patternType: detection.patternType,
            severity: detection.severity,
            description: detection.description,
            evidence: detection.evidence,
            confidence: detection.confidence,
          })),
        },
      },
    });

    return { ok: true, scanId: scan.id };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to analyze this website right now.";

    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        completedAt: new Date(),
      },
    });

    return {
      ok: false,
      error: "We couldn't analyze that website. Check the URL and try again.",
    };
  }
}
