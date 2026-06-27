import type { HTMLAttributes } from "react";
import type { DetectionSeverity } from "@/types/scan";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "destructive";
};

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-muted text-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
};

export function Badge({
  variant = "default",
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}

export function severityToBadgeVariant(
  severity: DetectionSeverity,
): NonNullable<BadgeProps["variant"]> {
  switch (severity) {
    case "HIGH":
      return "destructive";
    case "MEDIUM":
      return "warning";
    case "LOW":
      return "success";
    default: {
      const _exhaustive: never = severity;
      return _exhaustive;
    }
  }
}

export function riskScoreToLabel(score: number): string {
  if (score >= 70) return "High risk";
  if (score >= 40) return "Moderate risk";
  return "Low risk";
}

export function riskScoreToBadgeVariant(
  score: number,
): NonNullable<BadgeProps["variant"]> {
  if (score >= 70) return "destructive";
  if (score >= 40) return "warning";
  return "success";
}
