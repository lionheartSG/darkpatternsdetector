"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { submitScan } from "@/app/actions/scan/submitScan";
import { ScanProgressOverlay } from "@/components/scan/ScanProgressOverlay";
import { TermsOfUseDialog } from "@/components/scan/TermsOfUseDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HOMEPAGE_DISCLAIMER } from "@/lib/constants/disclaimers";
import { hasAcceptedCurrentTerms } from "@/lib/terms-storage";
import {
  type ScanProgressPhase,
  SCAN_PROGRESS_COMPLETE_MS,
} from "@/hooks/useScanProgress";

export function UrlScanForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [scanPhase, setScanPhase] = useState<ScanProgressPhase>("idle");
  const isScanning = scanPhase !== "idle";

  function validateUrl(
    input: string,
  ): { ok: true; url: string } | { ok: false; error: string } {
    const trimmed = input.trim();
    if (!trimmed) {
      return { ok: false, error: "Please paste a public webpage URL." };
    }

    try {
      const parsed = new URL(
        trimmed.startsWith("http://") || trimmed.startsWith("https://")
          ? trimmed
          : `https://${trimmed}`,
      );
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

  async function beginScan(scanUrl: string) {
    setScanPhase("running");
    setError(null);

    try {
      const result = await submitScan(scanUrl);

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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const result = validateUrl(url);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (hasAcceptedCurrentTerms()) {
      beginScan(result.url);
      return;
    }

    setPendingUrl(result.url);
    setTermsOpen(true);
  }

  function handleTermsAccept() {
    setTermsOpen(false);
    if (pendingUrl) {
      beginScan(pendingUrl);
      setPendingUrl(null);
    }
  }

  function handleTermsClose() {
    setTermsOpen(false);
    setPendingUrl(null);
  }

  return (
    <>
      <TermsOfUseDialog
        open={termsOpen}
        onClose={handleTermsClose}
        onAccept={handleTermsAccept}
      />

      {isScanning ? <ScanProgressOverlay url={url} phase={scanPhase} /> : null}

      <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm md:p-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Check a public webpage
          </h2>
          <p className="mt-2 text-secondary">
            Paste a URL to review potential pressure cues and design signals.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-4 text-left"
            noValidate
          >
            <Input
              label="Public webpage URL"
              type="url"
              name="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              helperText={HOMEPAGE_DISCLAIMER}
              error={error ?? undefined}
              disabled={isScanning}
              autoComplete="url"
              required
            />
            <div className="flex justify-center pt-2">
              <Button
                type="submit"
                size="lg"
                loading={isScanning}
                disabled={isScanning}
                className="min-w-[220px] rounded-xl bg-primary text-on-primary hover:bg-primary/90"
              >
                Scan webpage
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
