"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitScan } from "@/app/actions/scan/submitScan";
import { ScanProgressOverlay } from "@/components/scan/ScanProgressOverlay";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function UrlScanForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleBlur() {
    if (!url.trim()) {
      setError(null);
      return;
    }

    try {
      new URL(url.includes("://") ? url : `https://${url}`);
      setError(null);
    } catch {
      setError("Enter a valid website URL, such as https://example.com");
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await submitScan(url);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/scan/${result.scanId}`);
    });
  }

  return (
    <>
      {isPending ? <ScanProgressOverlay url={url} /> : null}

      <div className="rounded-[28px] border border-border bg-white p-8 shadow-[0_20px_80px_rgba(0,0,0,0.12)] md:rounded-[34px] md:p-12 dark:bg-background dark:shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            Ready to scan a website?
          </h2>
          <p className="mt-2 font-medium text-secondary md:text-lg">
            Paste a URL to check for predatory design patterns
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-4 text-left"
            noValidate
          >
            <Input
              label="Website URL"
              type="url"
              name="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onBlur={handleBlur}
              placeholder="https://example.com"
              helperText="We analyze the landing page for fake urgency, hidden fees, and deceptive UX."
              error={error ?? undefined}
              disabled={isPending}
              autoComplete="url"
              required
            />
            <div className="flex justify-center pt-2">
              <Button
                type="submit"
                size="lg"
                loading={isPending}
                disabled={isPending || !url.trim()}
                className="group min-w-[220px] rounded-full border border-foreground bg-white px-8 text-foreground hover:border-brand-red hover:bg-brand-red hover:text-white dark:border-border dark:bg-background dark:hover:border-brand-red dark:hover:bg-brand-red dark:hover:text-white"
              >
                <Upload
                  className="size-5 transition-transform duration-200 group-hover:scale-110 motion-reduce:transition-none"
                  aria-hidden="true"
                />
                Scan website
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
