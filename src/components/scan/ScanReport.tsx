import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DetectionGroup } from "@/components/scan/DetectionGroup";
import { RiskGauge } from "@/components/scan/RiskGauge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { formatDateTimeSGT } from "@/lib/date";
import type { ScanWithDetections } from "@/types/scan";

type ScanReportProps = {
  scan: ScanWithDetections;
};

function groupDetections(scan: ScanWithDetections) {
  const groups = new Map<string, ScanWithDetections["detections"]>();

  for (const detection of scan.detections) {
    const existing = groups.get(detection.category) ?? [];
    existing.push(detection);
    groups.set(detection.category, existing);
  }

  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function ScanReport({ scan }: ScanReportProps) {
  const grouped = groupDetections(scan);
  const scannedAt = formatDateTimeSGT(scan.completedAt ?? scan.createdAt);

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/"
            className="inline-flex cursor-pointer items-center gap-2 text-sm text-accent transition-colors duration-200 hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to home
          </Link>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Scan report
          </h1>
          <p
            className="max-w-2xl break-all text-sm text-secondary"
            title={scan.url}
          >
            {scan.url}
          </p>
          {scan.finalUrl && scan.finalUrl !== scan.normalizedUrl ? (
            <p className="text-sm text-secondary">Final URL: {scan.finalUrl}</p>
          ) : null}
          <p className="text-sm text-secondary">Scanned on {scannedAt}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="flex items-center justify-center">
          <RiskGauge score={scan.riskScore ?? 0} />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{scan.pageTitle ?? "Analysis summary"}</CardTitle>
            <CardDescription>
              {scan.summary ?? "No summary available."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {grouped.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            Detected patterns
          </h2>
          {grouped.map(([category, detections]) => (
            <DetectionGroup
              key={category}
              category={category}
              detections={detections}
            />
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldCheck className="size-10 text-success" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-foreground">
            No dark patterns detected
          </h2>
          <p className="max-w-prose text-sm text-secondary">
            We did not find strong evidence of deceptive design on this page.
            This does not guarantee the site is safe — always verify
            independently.
          </p>
        </Card>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur sm:hidden">
        <Link
          href="/"
          className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-medium text-on-primary transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Scan another URL
        </Link>
      </div>
    </div>
  );
}
