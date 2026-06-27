type CheckCategoryCardProps = {
  title: string;
  description: string;
};

export function CheckCategoryCard({
  title,
  description,
}: CheckCategoryCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-secondary">{description}</p>
    </article>
  );
}
