import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  confidenceLabelFromScore,
  suggestedActionForCategory,
} from "@/lib/constants/wording";
import type { ScanWithDetections } from "@/types/scan";

type DetectionCardProps = {
  detection: ScanWithDetections["detections"][number];
};

function formatCategoryLabel(category: string): string {
  return category.replaceAll("_", " ").toLowerCase();
}

export function DetectionCard({ detection }: DetectionCardProps) {
  const confidenceLabel = confidenceLabelFromScore(detection.confidence);
  const suggestedAction = suggestedActionForCategory(detection.category);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
            {formatCategoryLabel(detection.category)}
          </span>
          <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            Confidence: {confidenceLabel}
          </span>
        </div>
        <CardTitle className="text-base">{detection.patternType}</CardTitle>
      </CardHeader>
      <blockquote className="mb-4 border-l-4 border-primary/40 pl-4 text-sm italic text-foreground">
        “{detection.evidence}”
      </blockquote>
      <div className="space-y-3 px-6 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-secondary">
            Why it matters
          </p>
          <p className="mt-1 text-sm leading-6 text-secondary">
            {detection.description}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-secondary">
            Suggested action
          </p>
          <p className="mt-1 text-sm leading-6 text-secondary">
            {suggestedAction}
          </p>
        </div>
      </div>
    </Card>
  );
}
