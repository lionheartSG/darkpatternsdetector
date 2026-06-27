import { Clock3, Eye, Receipt } from "lucide-react";
import { UrlScanForm } from "@/components/scan/UrlScanForm";

const benefits = [
  {
    icon: Clock3,
    title: "Fake urgency detection",
    description: "Spot countdown timers and limited-time pressure tactics.",
  },
  {
    icon: Eye,
    title: "Scarcity signals",
    description:
      "Identify low-stock and high-demand messages that may mislead shoppers.",
  },
  {
    icon: Receipt,
    title: "Hidden fee patterns",
    description:
      "Surface sneaky pricing, pre-checked add-ons, and deceptive checkout flows.",
  },
];

export default function HomePage() {
  return (
    <div className="hero-section relative overflow-hidden">
      <div className="hero-section-bg pointer-events-none absolute inset-0 overflow-hidden">
        <div className="floating-orb absolute top-16 left-8 size-24 rounded-full bg-red-200/30 blur-2xl dark:bg-red-900/20" />
        <div className="floating-orb absolute top-32 right-16 size-40 rounded-full bg-blue-200/30 blur-2xl dark:bg-blue-900/20" />
        <div className="floating-orb absolute bottom-24 left-16 size-28 rounded-full bg-white/40 blur-2xl dark:bg-slate-700/30" />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:gap-14">
        <section className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl md:text-[56px]">
            Spot predatory patterns before you trust a website
          </h1>
          <p className="max-w-prose text-lg leading-8 text-white/90 md:text-xl">
            Paste any URL and we will analyze the page for dark patterns such as
            fake countdowns, misleading scarcity, hidden subscriptions, and
            other tactics designed to pressure users.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {benefits.map((benefit) => (
            <article
              key={benefit.title}
              className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm"
            >
              <benefit.icon
                className="mb-3 size-5 text-white"
                aria-hidden="true"
              />
              <h2 className="font-semibold text-white">{benefit.title}</h2>
              <p className="mt-1 text-sm leading-6 text-white/80">
                {benefit.description}
              </p>
            </article>
          ))}
        </section>

        <section>
          <UrlScanForm />
        </section>
      </div>
    </div>
  );
}
