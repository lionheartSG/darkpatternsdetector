type DisclaimerBlockProps = {
  id?: string;
  title?: string;
  copy?: string;
  className?: string;
};

export function DisclaimerBlock({
  id = "disclaimer",
  title = "Designed to inform, not accuse",
  copy = "DarkLens identifies observable design cues that may affect user decision-making. It does not make legal findings, determine intent, or certify whether a business is honest, dishonest, lawful, unlawful, safe, or unsafe.",
  className = "",
}: DisclaimerBlockProps) {
  return (
    <section
      id={id}
      className={`rounded-2xl border border-border bg-muted/60 p-6 sm:p-8 ${className}`}
    >
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">{copy}</p>
    </section>
  );
}
