import { Badge, severityToBadgeVariant } from "@/components/ui/Badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import type { ScanWithDetections } from "@/types/scan";

type DetectionCardProps = {
  detection: ScanWithDetections["detections"][number];
};

export function DetectionCard({ detection }: DetectionCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={severityToBadgeVariant(detection.severity)}>
            {detection.severity}
          </Badge>
          <span className="text-xs font-medium uppercase tracking-wide text-secondary">
            {detection.category.replaceAll("_", " ")}
          </span>
        </div>
        <CardTitle>{detection.patternType}</CardTitle>
        <CardDescription>{detection.description}</CardDescription>
      </CardHeader>
      <blockquote className="mb-4 border-l-4 border-primary/40 pl-4 text-sm italic text-foreground">
        “{detection.evidence}”
      </blockquote>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-secondary">
          <span>Confidence</span>
          <span className="tabular-nums">
            {Math.round(detection.confidence * 100)}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 motion-reduce:transition-none"
            style={{ width: `${Math.round(detection.confidence * 100)}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
