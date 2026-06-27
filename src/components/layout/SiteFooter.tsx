import { REPORT_FOOTER_DISCLAIMER } from "@/lib/constants/disclaimers";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="max-w-prose text-sm leading-6 text-secondary">
          {REPORT_FOOTER_DISCLAIMER}
        </p>
      </div>
    </footer>
  );
}
