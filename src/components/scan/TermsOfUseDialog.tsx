"use client";

import {
  AlertTriangle,
  Bot,
  Globe,
  Scale,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type TermsOfUseDialogProps = {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
};

const disclaimerSections = [
  {
    icon: Sparkles,
    title: "Educational purpose only",
    body: "This tool is for educational and informational purposes only. It is not legal, financial, or security advice. Seek professional guidance before making important decisions.",
  },
  {
    icon: ShieldAlert,
    title: "No liability",
    body: "We disclaim all liability for damages arising from use of this service, including reliance on analysis results or decisions made based on them.",
  },
  {
    icon: AlertTriangle,
    title: "No guarantee of accuracy",
    body: "Results may not be accurate, complete, or error-free. We provide no warranties regarding the accuracy or completeness of any analysis.",
  },
  {
    icon: Bot,
    title: "AI-generated content",
    body: "Outputs are machine-generated without human review. AI can make errors — do not rely on this tool alone for critical decisions.",
  },
  {
    icon: Globe,
    title: "Third-party services",
    body: "Analysis may use third-party AI providers (such as OpenAI), subject to their respective terms of service and privacy policies.",
  },
  {
    icon: Scale,
    title: "Singapore jurisdiction",
    body: "This service is intended for use in Singapore. These terms are governed by Singapore law. Disputes are subject to the exclusive jurisdiction of Singapore courts.",
  },
];

export function TermsOfUseDialog({
  open,
  onClose,
  onAccept,
}: TermsOfUseDialogProps) {
  const [accepted, setAccepted] = useState(false);
  const checkboxId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setAccepted(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/50 backdrop-blur-sm"
        aria-label="Close terms dialog"
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-dialog-title"
        tabIndex={-1}
        className="relative z-10 flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2
              id="terms-dialog-title"
              className="text-2xl font-semibold text-foreground"
            >
              Legal disclaimer & terms of use
            </h2>
            <p className="mt-2 text-sm leading-6 text-secondary">
              Before proceeding with website analysis, you must read and accept
              the following terms and disclaimers.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg text-secondary transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Close"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <section className="mb-6 rounded-xl border border-warning/30 bg-warning/5 p-4">
            <h3 className="text-base font-semibold text-foreground">
              Important: responsible use
            </h3>
            <p className="mt-2 text-sm leading-6 text-secondary">
              Only submit URLs for websites you are permitted to review. Do not
              use this tool to access private, authenticated, or restricted
              pages without authorization. We are not responsible for misuse of
              this service.
            </p>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            {disclaimerSections.map((section) => (
              <Card key={section.title} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-brand-red p-2">
                    <section.icon
                      className="size-4 text-white"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">
                      {section.title}
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-secondary">
                      {section.body}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <section className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="text-base font-semibold text-foreground">
              Mandatory acceptance required
            </h3>
            <p className="mt-2 text-sm leading-6 text-secondary">
              By proceeding, you acknowledge and agree to the above disclaimers
              and terms. This acceptance is required before analysis can begin.
            </p>

            <label
              htmlFor={checkboxId}
              className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6 text-foreground"
            >
              <input
                id={checkboxId}
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-1 size-4 cursor-pointer rounded border-border text-brand-red focus:ring-brand-red"
              />
              <span>
                I understand and accept the terms stated above. I acknowledge
                this service is for educational purposes only, not professional
                advice, and I use it at my own risk. I agree to the disclaimers
                regarding accuracy, AI-generated content, and liability.
              </span>
            </label>
          </section>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} className="sm:min-w-36">
            Cancel scan
          </Button>
          <Button
            onClick={onAccept}
            disabled={!accepted}
            className="rounded-full bg-brand-red text-white hover:bg-brand-red/90 disabled:opacity-50 sm:min-w-52"
          >
            {accepted
              ? "Accept & continue analysis"
              : "Accept terms to continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
