"use client";

import { submitScan, type SubmitScanInput } from "@/app/actions/scan/submitScan";
import { getSubmitScanClientError } from "@/lib/scan-errors";
import type { SubmitScanResult } from "@/types/scan";

export type RunSubmitScanResult =
  | { ok: true; scanId: string }
  | { ok: false; error: string; scanId?: string };

export async function runSubmitScan(
  url: string,
  input?: SubmitScanInput,
): Promise<RunSubmitScanResult> {
  try {
    const result: SubmitScanResult = await submitScan(url, input);

    if (!result.ok) {
      console.error("[scan] submitScan returned error:", {
        code: result.code,
        error: result.error,
        scanId: result.scanId,
      });
      return {
        ok: false,
        error: result.error,
        scanId: result.scanId,
      };
    }

    return { ok: true, scanId: result.scanId };
  } catch (error) {
    const clientError = getSubmitScanClientError(error);
    return { ok: false, error: clientError.message };
  }
}
