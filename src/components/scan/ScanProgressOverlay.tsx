"use client";

import { ProgressBar } from "@/components/scan/ProgressBar";
import {
  type ScanProgressPhase,
  useScanProgress,
} from "@/hooks/useScanProgress";
import {
  SCAN_LOADING_BODY,
  SCAN_LOADING_HEADLINE,
} from "@/lib/constants/disclaimers";

type ScanProgressOverlayProps = {
  url: string;
  phase: ScanProgressPhase;
  headline?: string;
  body?: string;
};

export function ScanProgressOverlay({
  url,
  phase,
  headline,
  body,
}: ScanProgressOverlayProps) {
  const progress = useScanProgress(phase);
  const displayUrl = url.length > 60 ? `${url.slice(0, 57)}…` : url;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      aria-live="polite"
      aria-busy={phase !== "complete"}
      role="dialog"
      aria-modal="true"
      aria-label="Scan in progress"
    >
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <span className="text-sm font-semibold text-foreground">
            DarkLens
          </span>
          <p
            className="max-w-xs truncate text-sm text-secondary sm:max-w-md"
            title={url}
          >
            {displayUrl}
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center px-4 pt-16 sm:pt-24">
        <div className="w-full max-w-2xl">
          <ProgressBar progress={progress} />

          <h1 className="mt-8 text-left text-3xl font-semibold text-foreground sm:text-4xl">
            {headline ?? SCAN_LOADING_HEADLINE}
          </h1>

          <p className="mt-4 max-w-prose text-left text-base leading-7 text-secondary">
            {body ??
              (headline
                ? "We are reviewing visible text, layout cues, and timing messages in your screenshot. This may take up to a minute."
                : SCAN_LOADING_BODY)}
          </p>
        </div>
      </div>
    </div>
  );
}
