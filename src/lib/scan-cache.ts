import type { ExtensionAnalyzeResponse } from "@darkpatterns/shared/types";
import {
  concernLevelFromScore,
  suggestedActionForCategory,
} from "@darkpatterns/shared/wording";
import { prisma } from "@/lib/prisma";
import { normalizeUrlInput } from "@/lib/url-validation";

type CachedScan = NonNullable<
  Awaited<ReturnType<typeof findCachedScanByNormalizedUrl>>
>;

export function normalizeScanUrl(url: string): string | null {
  const result = normalizeUrlInput(url);
  if (!result.ok) {
    return null;
  }
  return result.normalizedUrl;
}

export async function findCachedScanByNormalizedUrl(normalizedUrl: string) {
  return prisma.scan.findFirst({
    where: {
      normalizedUrl,
      status: "COMPLETED",
    },
    orderBy: { completedAt: "desc" },
    include: {
      detections: {
        orderBy: [{ severity: "desc" }, { confidence: "desc" }],
      },
    },
  });
}

export async function deleteScansByNormalizedUrl(
  normalizedUrl: string,
): Promise<void> {
  await prisma.scan.deleteMany({
    where: { normalizedUrl },
  });
}

export function toExtensionAnalyzeResponse(
  scan: CachedScan,
): ExtensionAnalyzeResponse {
  const riskScore = scan.riskScore ?? 0;

  return {
    ok: true,
    scan: {
      id: scan.id,
      url: scan.url,
      normalizedUrl: scan.normalizedUrl,
      status: "COMPLETED",
      riskScore: scan.riskScore,
      concernLevel: concernLevelFromScore(riskScore),
      summary: scan.summary,
      pageTitle: scan.pageTitle,
      completedAt: scan.completedAt?.toISOString() ?? null,
      detections: scan.detections.map((detection) => ({
        id: detection.id,
        category: detection.category,
        patternType: detection.patternType,
        severity: detection.severity,
        description: detection.description,
        evidence: detection.evidence,
        confidence: detection.confidence,
        suggestedAction: suggestedActionForCategory(detection.category),
      })),
    },
  };
}
