"use client";

import { ShieldCheck } from "lucide-react";
import { ProgressBar } from "@/components/scan/ProgressBar";
import { useScanProgress } from "@/hooks/useScanProgress";

type ScanProgressOverlayProps = {
  url: string;
};

export function ScanProgressOverlay({ url }: ScanProgressOverlayProps) {
  const progress = useScanProgress(true);
  const displayUrl = url.length > 60 ? `${url.slice(0, 57)}…` : url;

  return (
    <div
      className="scan-overlay fixed inset-0 z-50 flex flex-col"
      aria-live="polite"
      aria-busy="true"
      role="dialog"
      aria-modal="true"
      aria-label="Scan in progress"
    >
      <div className="scan-overlay-bg pointer-events-none absolute inset-0 overflow-hidden">
        <div className="floating-orb absolute top-20 left-10 size-20 rounded-full bg-red-100/40 blur-xl" />
        <div className="floating-orb absolute top-40 right-20 size-32 rounded-full bg-blue-100/30 blur-xl" />
        <div className="floating-orb absolute bottom-40 left-20 size-24 rounded-full bg-white/20 blur-xl" />
      </div>

      <header className="relative z-10 border-b-2 border-white/30 px-6 py-4 shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className="hidden h-8 w-px bg-white sm:block"
              aria-hidden="true"
            />
            <span className="hidden text-base font-semibold text-white sm:block">
              Scanning website
            </span>
          </div>
          <p
            className="max-w-xs truncate text-sm text-white/80 sm:max-w-md"
            title={url}
          >
            {displayUrl}
          </p>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center px-4 pt-16 sm:pt-24">
        <div className="w-full max-w-4xl">
          <div className="mb-8">
            <ProgressBar progress={progress} />
          </div>

          <h1 className="text-left text-4xl font-semibold text-white sm:text-5xl md:text-6xl">
            Detecting
            <span className="text-white"> dark patterns</span>
            <span className="loading-dots" aria-hidden="true">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </h1>

          <p className="mt-4 max-w-2xl text-left text-lg text-white/90 md:text-xl">
            Give us a moment while we analyze this page for deceptive design
            patterns.
          </p>
        </div>
      </div>

      <div className="absolute right-8 bottom-8 z-10">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
          <ShieldCheck className="size-8 text-white" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
