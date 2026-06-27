import { ShieldCheck } from "lucide-react";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex cursor-pointer items-center gap-2 text-foreground transition-opacity duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ShieldCheck className="size-6 text-primary" aria-hidden="true" />
          <span className="text-lg font-semibold">Scam Website Detector</span>
        </Link>
      </div>
    </header>
  );
}
