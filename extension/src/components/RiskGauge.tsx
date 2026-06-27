type RiskGaugeProps = {
  score: number;
};

function riskScoreToLabel(score: number): string {
  if (score === 0) return "Insufficient evidence";
  if (score <= 5) return "No major concerns detected";
  if (score < 40) return "Some caution";
  if (score < 70) return "Moderate caution";
  return "High caution";
}

function riskScoreToBadgeClass(score: number): string {
  if (score === 0) return "badge-unable";
  if (score >= 70) return "badge-high";
  if (score >= 40) return "badge-moderate";
  return "badge-low";
}

function riskScoreToStrokeClass(score: number): string {
  if (score >= 70) return "risk-gauge-stroke-high";
  if (score >= 40) return "risk-gauge-stroke-moderate";
  return "risk-gauge-stroke-low";
}

export function RiskGauge({ score }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="risk-gauge">
      <div className="risk-gauge-chart">
        <svg viewBox="0 0 128 128" className="risk-gauge-svg" aria-hidden="true">
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="risk-gauge-track"
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
            className={`risk-gauge-progress ${riskScoreToStrokeClass(clamped)}`}
          />
        </svg>
        <div className="risk-gauge-center">
          <span className="risk-gauge-score">{clamped}</span>
          <span className="risk-gauge-label">Caution level</span>
        </div>
      </div>
      <span className={`badge ${riskScoreToBadgeClass(clamped)}`}>
        {riskScoreToLabel(clamped)}
      </span>
    </div>
  );
}
