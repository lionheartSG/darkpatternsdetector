"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { submitScan } from "@/app/actions/scan/submitScan";
import { TermsOfUseDialog } from "@/components/scan/TermsOfUseDialog";
import { readScreenshotFile } from "@/lib/screenshot-upload";
import { hasAcceptedCurrentTerms } from "@/lib/terms-storage";
import { SCAN_PROGRESS_COMPLETE_MS } from "@/hooks/useScanProgress";

type ScreenshotRescanFormProps = {
  url: string;
};

export function ScreenshotRescanForm({ url }: ScreenshotRescanFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  async function beginScreenshotScan(file: File) {
    const parsed = await readScreenshotFile(file);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const result = await submitScan(url, {
        userScreenshotBase64: parsed.base64,
        screenshotMimeType: parsed.mimeType,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, SCAN_PROGRESS_COMPLETE_MS),
      );
      router.push(`/scan/${result.scanId}`);
    } catch {
      setError("We couldn't analyze that screenshot. Please try again.");
    } finally {
      setIsScanning(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    if (hasAcceptedCurrentTerms()) {
      await beginScreenshotScan(file);
      return;
    }

    setPendingFile(file);
    setTermsOpen(true);
  }

  function handleTermsAccept() {
    setTermsOpen(false);
    if (pendingFile) {
      void beginScreenshotScan(pendingFile);
      setPendingFile(null);
    }
  }

  function handleTermsClose() {
    setTermsOpen(false);
    setPendingFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <>
      <TermsOfUseDialog
        open={termsOpen}
        onClose={handleTermsClose}
        onAccept={handleTermsAccept}
      />

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-foreground">
          Upload a screenshot instead
        </p>
        <p className="mt-2 text-sm leading-6 text-secondary">
          Open the page in your own browser, capture what you see (including any
          countdown timer), and upload it here. DarkLens will analyse the image
          without requesting the page again.
        </p>

        <div className="mt-4">
          <input
            ref={inputRef}
            id="screenshot-rescan-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={isScanning}
            onChange={handleFileChange}
            className="block w-full text-sm text-secondary file:mr-3 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted"
          />
        </div>

        {isScanning ? (
          <p className="mt-3 text-sm text-secondary">
            Analysing uploaded screenshot…
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}
