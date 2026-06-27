type HowItWorksStepProps = {
  step: number;
  title: string;
  description: string;
};

export function HowItWorksStep({
  step,
  title,
  description,
}: HowItWorksStepProps) {
  return (
    <article className="relative flex gap-4">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold text-primary"
        aria-hidden="true"
      >
        {step}
      </div>
      <div className="space-y-1 pb-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-6 text-secondary">{description}</p>
      </div>
    </article>
  );
}
