"use server";

import { headers } from "next/headers";
import { analyzeScreenshot } from "@/lib/ai/analyze-screenshot";
import {
  analyzePage,
  computeRiskScore,
  mergeDetections,
} from "@/lib/ai/analyze-page";
import { buildSafeSummary } from "@/lib/constants/wording";
import { fetchPage, trimScreenshotForStorage } from "@/lib/fetch-page";
import { runHeuristics } from "@/lib/heuristics";
import { buildAccessBlockedSummary } from "@/lib/page-access";
import { prisma } from "@/lib/prisma";
import { checkScanRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { parseUserScreenshot } from "@/lib/screenshot-upload";
import { validateScanUrl } from "@/lib/url-validation";
import { sanitizeWording } from "@/lib/wording/sanitize";
import type { SubmitScanResult } from "@/types/scan";

export type SubmitScanInput = {
  userScreenshotBase64?: string;
  screenshotMimeType?: string;
};

async function persistScanResult(
  scanId: string,
  data: {
    riskScore: number;
    summary: string;
    pageTitle: string;
    finalUrl: string | null;
    viewportScreenshot: string | null;
    screenshotCapturedAt: Date;
    detections: Array<{
      category: string;
      patternType: string;
      severity: "LOW" | "MEDIUM" | "HIGH";
      description: string;
      evidence: string;
      confidence: number;
    }>;
  },
) {
  await prisma.scan.update({
    where: { id: scanId },
    data: {
      status: "COMPLETED",
      riskScore: data.riskScore,
      summary: data.summary,
      pageTitle: data.pageTitle,
      finalUrl: data.finalUrl,
      viewportScreenshot: data.viewportScreenshot,
      screenshotCapturedAt: data.screenshotCapturedAt,
      completedAt: new Date(),
      detections: {
        create: data.detections,
      },
    },
  });
}

export async function submitScan(
  rawUrl: string,
  input?: SubmitScanInput,
): Promise<SubmitScanResult> {
  const headersList = await headers();
  const rateLimit = checkScanRateLimit(getRateLimitKey(headersList));
  if (!rateLimit.allowed) {
    return { ok: false, error: rateLimit.error };
  }

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
    if (input?.userScreenshotBase64) {
      const screenshotPayload = parseUserScreenshot(
        input.userScreenshotBase64,
        input.screenshotMimeType,
      );
      if (!screenshotPayload.ok) {
        return { ok: false, error: screenshotPayload.error };
      }

      const analysis = await analyzeScreenshot({
        url: validation.normalizedUrl,
        base64: screenshotPayload.base64,
        mimeType: screenshotPayload.mimeType,
      });

      const detections = analysis.detections.map((detection) => ({
        category: detection.category,
        patternType: detection.patternType,
        severity: detection.severity,
        description: sanitizeWording(detection.description),
        evidence: sanitizeWording(detection.evidence),
        confidence: detection.confidence,
      }));

      const riskScore = computeRiskScore(detections);
      const summary = sanitizeWording(
        `${analysis.summary} This report is based on a user-provided screenshot, not a live automated page fetch.`,
      );

      await persistScanResult(scan.id, {
        riskScore,
        summary,
        pageTitle: "Analysis from user-provided screenshot",
        finalUrl: validation.normalizedUrl,
        viewportScreenshot: trimScreenshotForStorage(screenshotPayload.base64),
        screenshotCapturedAt: new Date(),
        detections,
      });

      return { ok: true, scanId: scan.id };
    }

    const page = await fetchPage(validation.normalizedUrl);

    if (page.access.blocked) {
      const summary = buildAccessBlockedSummary(page.httpStatus);
      const storedScreenshot = trimScreenshotForStorage(
        page.viewportScreenshot,
      );

      await persistScanResult(scan.id, {
        riskScore: 0,
        summary: `${summary} You can upload a screenshot from your own browser to analyse the page without another automated fetch.`,
        pageTitle: page.pageTitle,
        finalUrl: page.finalUrl,
        viewportScreenshot: storedScreenshot,
        screenshotCapturedAt: page.screenshotCapturedAt,
        detections: [
          {
            category: "OBSTRUCTION",
            patternType: "PageAccessBlocked",
            severity: "LOW",
            description:
              "The automated scan could not load the submitted public page. Design cues visible in a normal browser may not appear in this report.",
            evidence:
              page.access.reason ??
              `HTTP ${page.httpStatus} while loading ${validation.normalizedUrl}`,
            confidence: 0.95,
          },
        ],
      });

      return { ok: true, scanId: scan.id };
    }

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
    const safeSummary = buildSafeSummary(detections.length);
    const summary = sanitizeWording(analysis.summary || safeSummary);
    const storedScreenshot = trimScreenshotForStorage(page.viewportScreenshot);

    await persistScanResult(scan.id, {
      riskScore,
      summary,
      pageTitle: page.pageTitle,
      finalUrl: page.finalUrl,
      viewportScreenshot: storedScreenshot,
      screenshotCapturedAt: page.screenshotCapturedAt,
      detections: detections.map((detection) => ({
        category: detection.category,
        patternType: detection.patternType,
        severity: detection.severity,
        description: sanitizeWording(detection.description),
        evidence: sanitizeWording(detection.evidence),
        confidence: detection.confidence,
      })),
    });

    return { ok: true, scanId: scan.id };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to analyze this website right now.";

    console.error("[submitScan] scan failed:", message, error);

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
      error:
        message.includes("OPENAI_API_KEY") || message.includes("vision")
          ? message
          : "We couldn't analyze that website. Check the URL and try again.",
    };
  }
}
