"use server";

import { prisma } from "@/lib/prisma";
import type { GetScanResult, ScanWithDetections } from "@/types/scan";

export async function getScan(scanId: string): Promise<GetScanResult> {
  if (!scanId.trim()) {
    return { ok: false, error: "Scan ID is required." };
  }

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      detections: {
        orderBy: [{ severity: "desc" }, { confidence: "desc" }],
      },
    },
  });

  if (!scan) {
    return { ok: false, error: "Scan not found." };
  }

  const payload: ScanWithDetections = {
    id: scan.id,
    url: scan.url,
    normalizedUrl: scan.normalizedUrl,
    status: scan.status,
    riskScore: scan.riskScore,
    summary: scan.summary,
    pageTitle: scan.pageTitle,
    finalUrl: scan.finalUrl,
    errorMessage: scan.errorMessage,
    createdAt: scan.createdAt,
    completedAt: scan.completedAt,
    viewportScreenshot: scan.viewportScreenshot,
    screenshotCapturedAt: scan.screenshotCapturedAt,
    detections: scan.detections.map((detection) => ({
      id: detection.id,
      category: detection.category,
      patternType: detection.patternType,
      severity: detection.severity,
      description: detection.description,
      evidence: detection.evidence,
      confidence: detection.confidence,
    })),
  };

  return { ok: true, scan: payload };
}
