import type {
  ExtensionAnalyzePayload,
  ExtensionAnalyzeResponse,
} from "@darkpatterns/shared/types";
import { getSettings } from "../lib/storage";

export async function fetchCachedReportFromBackend(
  url: string,
): Promise<ExtensionAnalyzeResponse["scan"] | null> {
  const settings = await getSettings();
  const baseUrl = settings.apiBaseUrl.replace(/\/$/, "");
  const endpoint = `${baseUrl}/api/extension/cache?url=${encodeURIComponent(url)}`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        ...(settings.apiKey ? { "X-Extension-Key": settings.apiKey } : {}),
      },
    });

    if (response.status === 404) {
      return null;
    }

    const data = (await response.json()) as
      | ExtensionAnalyzeResponse
      | { ok: false; error: string };

    if (!response.ok || !data.ok) {
      return null;
    }

    return data.scan;
  } catch {
    return null;
  }
}

export async function analyzeWithBackend(
  payload: Omit<ExtensionAnalyzePayload, "source" | "scannedAt">,
  force = false,
): Promise<ExtensionAnalyzeResponse> {
  const settings = await getSettings();
  const baseUrl = settings.apiBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/extension/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.apiKey ? { "X-Extension-Key": settings.apiKey } : {}),
    },
    body: JSON.stringify({
      ...payload,
      scannedAt: new Date().toISOString(),
      source: "chrome-extension",
      force,
    } satisfies ExtensionAnalyzePayload),
  });

  const data = (await response.json()) as
    | ExtensionAnalyzeResponse
    | { ok: false; error: string };

  if (!response.ok || !data.ok) {
    throw new Error(
      "error" in data ? data.error : "Unable to analyze this page.",
    );
  }

  return data;
}
