import {
  Badge,
  riskScoreToBadgeVariant,
  riskScoreToLabel,
} from "@/components/ui/Badge";

type RiskGaugeProps = {
  score: number;
};

export function RiskGauge({ score }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const strokeClass =
    clamped >= 70
      ? "text-destructive"
      : clamped >= 40
        ? "text-warning"
        : "text-success";

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="relative size-40">
        <svg
          viewBox="0 0 128 128"
          className="size-full -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-muted"
          />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`transition-all duration-300 motion-reduce:transition-none ${strokeClass}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {clamped}
          </span>
          <span className="text-xs uppercase tracking-wide text-secondary">
            Caution level
          </span>
        </div>
      </div>
      <Badge variant={riskScoreToBadgeVariant(clamped)}>
        {riskScoreToLabel(clamped)}
      </Badge>
    </div>
  );
}
