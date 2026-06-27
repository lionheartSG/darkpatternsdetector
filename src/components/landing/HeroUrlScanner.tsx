"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { submitScan } from "@/app/actions/scan/submitScan";
import { ScanProgressOverlay } from "@/components/scan/ScanProgressOverlay";
import { TermsOfUseDialog } from "@/components/scan/TermsOfUseDialog";
import { Button } from "@/components/ui/Button";
import { HOMEPAGE_DISCLAIMER } from "@/lib/constants/disclaimers";
import { readScreenshotFile } from "@/lib/screenshot-upload";
import { hasAcceptedCurrentTerms } from "@/lib/terms-storage";
import {
  type ScanProgressPhase,
  SCAN_PROGRESS_COMPLETE_MS,
} from "@/hooks/useScanProgress";

function validateUrl(
  input: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = input.trim();

  if (!trimmed) {
    return { ok: false, error: "Please paste a public webpage URL." };
  }

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return {
      ok: false,
      error: "Please enter a valid URL starting with http:// or https://.",
    };
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        ok: false,
        error: "Please enter a valid URL starting with http:// or https://.",
      };
    }

    return { ok: true, url: parsed.toString() };
  } catch {
    return {
      ok: false,
      error: "Please enter a valid URL starting with http:// or https://.",
    };
  }
}

type PendingScan = {
  url: string;
  screenshotBase64?: string;
  screenshotMimeType?: string;
};

export function HeroUrlScanner() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [pendingScan, setPendingScan] = useState<PendingScan | null>(null);
  const [scanPhase, setScanPhase] = useState<ScanProgressPhase>("idle");
  const isScanning = scanPhase !== "idle";

  async function beginScan(scan: PendingScan) {
    setScanPhase("running");
    setError(null);

    try {
      const result = await submitScan(scan.url, {
        userScreenshotBase64: scan.screenshotBase64,
        screenshotMimeType: scan.screenshotMimeType,
      });

      if (!result.ok) {
        setError(result.error);
        setScanPhase("idle");
        return;
      }

      setScanPhase("complete");
      await new Promise((resolve) =>
        setTimeout(resolve, SCAN_PROGRESS_COMPLETE_MS),
      );
      router.push(`/scan/${result.scanId}`);
      setScanPhase("idle");
    } catch {
      setError("We couldn't analyze that website. Check the URL and try again.");
      setScanPhase("idle");
    }
  }

  async function prepareScan(scanUrl: string, file: File | null) {
    if (file) {
      const parsed = await readScreenshotFile(file);
      if (!parsed.ok) {
        setError(parsed.error);
        return null;
      }
      return {
        url: scanUrl,
        screenshotBase64: parsed.base64,
        screenshotMimeType: parsed.mimeType,
      };
    }
    return { url: scanUrl };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const result = validateUrl(url);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    const scanPayload = await prepareScan(result.url, screenshotFile);
    if (!scanPayload) return;

    if (hasAcceptedCurrentTerms()) {
      beginScan(scanPayload);
      return;
    }

    setPendingScan(scanPayload);
    setTermsOpen(true);
  }

  function handleTermsAccept() {
    setTermsOpen(false);
    if (pendingScan) {
      beginScan(pendingScan);
      setPendingScan(null);
    }
  }

  function handleTermsClose() {
    setTermsOpen(false);
    setPendingScan(null);
  }

  function handleScreenshotChange(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = event.target.files?.[0] ?? null;
    setScreenshotFile(file);
  }

  return (
    <>
      <TermsOfUseDialog
        open={termsOpen}
        onClose={handleTermsClose}
        onAccept={handleTermsAccept}
      />

      {isScanning ? (
        <ScanProgressOverlay
          url={url}
          phase={scanPhase}
          headline={
            screenshotFile ? "Analysing uploaded screenshot…" : undefined
          }
        />
      ) : null}

      <div
        id="scan"
        className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="url-input" className="sr-only">
              Public webpage URL
            </label>
            <input
              id="url-input"
              type="url"
              name="url"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                if (error) setError(null);
              }}
              placeholder="Paste a public webpage URL"
              disabled={isScanning}
              autoComplete="url"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "url-error" : "url-helper"}
              className={`min-h-12 flex-1 rounded-xl border bg-background px-4 py-3 text-base text-foreground placeholder:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60 ${
                error ? "border-destructive" : "border-border"
              }`}
            />
            <Button
              type="submit"
              size="lg"
              loading={isScanning}
              disabled={isScanning}
              className="min-h-12 rounded-xl bg-primary px-6 text-on-primary hover:bg-primary/90 focus-visible:ring-primary sm:shrink-0"
            >
              {screenshotFile ? "Analyse screenshot" : "Scan webpage"}
            </Button>
          </div>

          <div className="rounded-xl border border-dashed border-border bg-background/60 p-4">
            <label
              htmlFor="screenshot-upload"
              className="text-sm font-medium text-foreground"
            >
              Optional: upload a screenshot
            </label>
            <p className="mt-1 text-sm leading-6 text-secondary">
              If a site blocks automated access, open it in your browser, take a
              screenshot, and upload it here. DarkLens will analyse the image
              without requesting the page again.
            </p>
            <input
              ref={fileInputRef}
              id="screenshot-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={isScanning}
              onChange={handleScreenshotChange}
              className="mt-3 block w-full text-sm text-secondary file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted"
            />
            {screenshotFile ? (
              <p className="mt-2 text-xs text-secondary">
                Selected: {screenshotFile.name}
              </p>
            ) : null}
          </div>

          {error ? (
            <p id="url-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <p id="url-helper" className="text-sm leading-6 text-secondary">
              {HOMEPAGE_DISCLAIMER}
            </p>
          )}
        </form>
      </div>
    </>
  );
}
