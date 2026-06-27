"use client";

import Link from "next/link";

type ScanErrorProps = {
  reset: () => void;
};

export default function ScanError({ reset }: ScanErrorProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="rounded-xl border border-border bg-muted/20 p-6">
        <h1 className="text-2xl font-bold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-secondary">
          We could not load this scan report. Try again or start a new scan.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
