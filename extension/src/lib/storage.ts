import type { ExtensionAnalyzeResponse } from "@darkpatterns/shared/types";
import { isExcludedUrl } from "./excluded-hosts";

export type ExtensionSettings = {
  termsAcceptedAt: string | null;
  autoScanEnabled: boolean;
  apiBaseUrl: string;
  apiKey: string;
};

const DEFAULT_SETTINGS: ExtensionSettings = {
  termsAcceptedAt: null,
  autoScanEnabled: true,
  apiBaseUrl: "http://localhost:3000",
  apiKey: "",
};

type UrlReportCache = {
  normalizedUrl: string;
  report: ExtensionAnalyzeResponse["scan"];
  cachedAt: number;
};

export function normalizeUrlForCache(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  return parsed.toString();
}

export function urlsMatchForCache(a: string, b: string): boolean {
  try {
    return normalizeUrlForCache(a) === normalizeUrlForCache(b);
  } catch {
    return a === b;
  }
}

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...stored } as ExtensionSettings;
}

export async function saveSettings(
  partial: Partial<ExtensionSettings>,
): Promise<void> {
  await chrome.storage.local.set(partial);
}

export async function getTabReport(
  tabId: number,
): Promise<import("./messages").TabReportState | null> {
  const key = `tabReport:${tabId}`;
  const stored = await chrome.storage.session.get(key);
  return (
    (stored[key] as import("./messages").TabReportState | undefined) ?? null
  );
}

export async function setTabReport(
  tabId: number,
  state: import("./messages").TabReportState,
): Promise<void> {
  const key = `tabReport:${tabId}`;
  await chrome.storage.session.set({ [key]: state });
}

export async function getUrlReportCache(
  url: string,
): Promise<ExtensionAnalyzeResponse["scan"] | null> {
  const normalizedUrl = normalizeUrlForCache(url);
  const key = `urlReport:${normalizedUrl}`;
  const stored = await chrome.storage.local.get(key);
  const cache = stored[key] as UrlReportCache | undefined;
  return cache?.report ?? null;
}

export async function setUrlReportCache(
  url: string,
  report: ExtensionAnalyzeResponse["scan"],
): Promise<void> {
  const normalizedUrl = normalizeUrlForCache(url);
  const key = `urlReport:${normalizedUrl}`;
  await chrome.storage.local.set({
    [key]: {
      normalizedUrl,
      report,
      cachedAt: Date.now(),
    } satisfies UrlReportCache,
  });
}

export async function clearUrlReportCache(url: string): Promise<void> {
  const normalizedUrl = normalizeUrlForCache(url);
  await chrome.storage.local.remove(`urlReport:${normalizedUrl}`);
}

export function isAnalyzableUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  return !isExcludedUrl(url);
}
