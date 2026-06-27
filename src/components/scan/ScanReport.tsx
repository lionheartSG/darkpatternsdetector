import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DetectionGroup } from "@/components/scan/DetectionGroup";
import { RiskGauge } from "@/components/scan/RiskGauge";
import { ScreenshotRescanForm } from "@/components/scan/ScreenshotRescanForm";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import {
  REPORT_DISCLAIMER,
  REPORT_FOOTER_DISCLAIMER,
} from "@/lib/constants/disclaimers";
import {
  buildSafeSummary,
  CUE_EDUCATION,
  NEXT_STEPS,
} from "@/lib/constants/wording";
import { formatDateTimeSGT } from "@/lib/date";
import { isAccessBlockedScan, isUserScreenshotScan } from "@/lib/page-access";
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

function getTechnicalSignals(scan: ScanWithDetections) {
  const signals: string[] = [];
  const usesHttps = scan.normalizedUrl.startsWith("https://");
  const accessBlocked = isAccessBlockedScan(scan);

  signals.push(usesHttps ? "HTTPS present" : "HTTPS not used on submitted URL");

  if (accessBlocked) {
    signals.push(
      "Page access blocked — automated scan could not load full content",
    );
  }

  if (isUserScreenshotScan(scan)) {
    signals.push("Analysis based on user-provided screenshot");
  }

  if (scan.finalUrl && scan.finalUrl !== scan.normalizedUrl) {
    signals.push("Redirect detected to a different final URL");
  }

  signals.push("Unable to assess reputation from this scan alone");

  return signals;
}

function getPressureDetections(scan: ScanWithDetections) {
  return scan.detections.filter(
    (detection) => detection.patternType !== "PageAccessBlocked",
  );
}

export function ScanReport({ scan }: ScanReportProps) {
  const accessBlocked = isAccessBlockedScan(scan);
  const pressureDetections = getPressureDetections(scan);
  const grouped = groupDetections({ ...scan, detections: pressureDetections });
  const scannedAt = formatDateTimeSGT(scan.completedAt ?? scan.createdAt);
  const safeSummary = accessBlocked
    ? (scan.summary ?? buildSafeSummary(0))
    : buildSafeSummary(pressureDetections.length);
  const technicalSignals = getTechnicalSignals(scan);
  const accessDetection = scan.detections.find(
    (detection) => detection.patternType === "PageAccessBlocked",
  );

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/"
            className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to home
          </Link>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
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

      <div
        role="note"
        className="rounded-xl border border-border bg-muted/50 p-4 text-sm leading-6 text-secondary"
      >
        <p>{REPORT_DISCLAIMER}</p>
        <p className="mt-2">{REPORT_FOOTER_DISCLAIMER}</p>
      </div>

      {accessBlocked ? (
        <div
          role="alert"
          className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm leading-6 text-foreground"
        >
          <p className="font-semibold">
            Scan could not access full page content
          </p>
          <p className="mt-2 text-secondary">
            {scan.summary ??
              "The website blocked or limited automated access. Countdown timers, scarcity messages, and other design cues visible in a normal browser may not appear in this report."}
          </p>
          {accessDetection ? (
            <p className="mt-2 text-secondary">
              Evidence: {accessDetection.evidence}
            </p>
          ) : null}
          <div className="mt-4">
            <ScreenshotRescanForm url={scan.url} />
          </div>
        </div>
      ) : null}

      {isUserScreenshotScan(scan) ? (
        <div
          role="note"
          className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-6 text-secondary"
        >
          This report was generated from a screenshot you uploaded. DarkLens did
          not request the live webpage again for this analysis.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="flex items-center justify-center">
          <RiskGauge score={scan.riskScore ?? 0} />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{scan.pageTitle ?? "Analysis summary"}</CardTitle>
            <CardDescription>{safeSummary}</CardDescription>
            {scan.summary ? (
              <p className="text-sm leading-6 text-secondary">{scan.summary}</p>
            ) : null}
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Technical signals</CardTitle>
          <CardDescription>
            Neutral observations from this scan. These are not conclusions about
            trustworthiness.
          </CardDescription>
        </CardHeader>
        <ul className="space-y-2 px-6 pb-6">
          {technicalSignals.map((signal) => (
            <li key={signal} className="text-sm text-secondary">
              • {signal}
            </li>
          ))}
        </ul>
      </Card>

      {scan.viewportScreenshot ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Viewport evidence snapshot
            </CardTitle>
            <CardDescription>
              Captured automatically during this scan and stored privately for
              review.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            {/* biome-ignore lint/performance/noImgElement: base64 evidence snapshot from scan */}
            <img
              src={`data:image/png;base64,${scan.viewportScreenshot}`}
              alt="Viewport screenshot captured during scan"
              className="max-h-96 w-full rounded-lg border border-border object-contain object-left-top"
            />
          </div>
        </Card>
      ) : null}

      {grouped.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            Potential pressure cues
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
        <Card className="flex flex-col gap-3 py-12 text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {accessBlocked
              ? "Insufficient evidence from this scan"
              : "No major pressure cues detected"}
          </h2>
          <p className="mx-auto max-w-prose text-sm leading-6 text-secondary">
            {accessBlocked
              ? "Because the page could not be fully loaded, we cannot confirm whether pressure cues are present. Open the site in your own browser and review what you see before deciding."
              : "We did not find strong evidence of urgency, scarcity, or checkout pressure cues on this page. Consider checking independently before deciding."}
          </p>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What this means</CardTitle>
          <CardDescription>
            Plain-English context for common design cues. This is not a legal,
            fraud, safety, or regulatory determination.
          </CardDescription>
        </CardHeader>
        <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2">
          {CUE_EDUCATION.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-border bg-muted/30 p-4"
            >
              <h3 className="text-sm font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-secondary">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What you can do next</CardTitle>
          <CardDescription>
            Practical steps to reduce reliance on a single webpage or scan
            result.
          </CardDescription>
        </CardHeader>
        <ul className="space-y-2 px-6 pb-6">
          {NEXT_STEPS.map((step) => (
            <li key={step} className="text-sm leading-6 text-secondary">
              • {step}
            </li>
          ))}
        </ul>
      </Card>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur sm:hidden">
        <Link
          href="/"
          className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-medium text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Scan another URL
        </Link>
      </div>
    </div>
  );
}
