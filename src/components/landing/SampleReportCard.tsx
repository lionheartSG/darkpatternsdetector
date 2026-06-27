type Finding = {
  title: string;
  confidence: "High" | "Medium" | "Low" | "Pending";
  evidence: string;
  explanation: string;
};

type SampleReportCardProps = {
  highlighted?: boolean;
  scannedUrl?: string | null;
};

const findings: Finding[] = [
  {
    title: "Potential urgency cue",
    confidence: "Medium",
    evidence: "Countdown timer detected near purchase button",
    explanation:
      "Countdowns can encourage faster decisions before users compare alternatives.",
  },
  {
    title: "Possible scarcity cue",
    confidence: "Low",
    evidence: "‘Only 3 left’ message detected",
    explanation:
      "Scarcity messages may be useful when accurate, but are difficult for users to verify.",
  },
  {
    title: "Needs follow-up scan",
    confidence: "Pending",
    evidence: "‘Sale ends today’ wording detected",
    explanation:
      "Some claims require repeated observation to assess consistency over time.",
  },
];

const confidenceStyles: Record<Finding["confidence"], string> = {
  High: "bg-destructive/10 text-destructive",
  Medium: "bg-warning/10 text-warning",
  Low: "bg-muted text-secondary",
  Pending: "bg-muted text-secondary border border-border",
};

export function SampleReportCard({
  highlighted = false,
  scannedUrl = null,
}: SampleReportCardProps) {
  return (
    <article
      className={`rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8 ${
        highlighted ? "report-highlight ring-2 ring-primary/20" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-secondary">
            Example scan result
          </p>
          <h3 className="mt-1 text-xl font-semibold text-foreground">
            Moderate caution
          </h3>
        </div>
        <span className="inline-flex rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
          Review the evidence before deciding
        </span>
      </div>

      {scannedUrl ? (
        <p className="mt-4 truncate rounded-lg bg-muted px-3 py-2 text-sm text-secondary">
          Scanned: {scannedUrl}
        </p>
      ) : null}

      <p className="mt-4 text-sm leading-6 text-secondary">
        We found 3 potential pressure cues. These findings are not proof of
        wrongdoing. Review the evidence before deciding.
      </p>

      <p className="mt-2 text-xs text-secondary">
        This is not a legal or fraud determination.
      </p>

      <ul className="mt-6 space-y-4">
        {findings.map((finding) => (
          <li
            key={finding.title}
            className="rounded-xl border border-border bg-background p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground">
                {finding.title}
              </h4>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${confidenceStyles[finding.confidence]}`}
              >
                Confidence: {finding.confidence}
              </span>
            </div>
            <p className="mt-3 text-sm text-foreground">
              <span className="font-medium">Evidence:</span> “{finding.evidence}
              ”
            </p>
            <p className="mt-2 text-sm leading-6 text-secondary">
              {finding.explanation}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}
