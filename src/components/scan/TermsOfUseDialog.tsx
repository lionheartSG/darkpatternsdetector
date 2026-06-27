"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  TERMS_MODAL,
  TERMS_SECTIONS,
  TERMS_VERSION,
} from "@/lib/constants/terms";
import { setAcceptedTermsVersion } from "@/lib/terms-storage";

type TermsOfUseDialogProps = {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
};

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

  function handleAccept() {
    setAcceptedTermsVersion(TERMS_VERSION);
    onAccept();
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/45"
        aria-label="Close terms dialog"
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-dialog-title"
        tabIndex={-1}
        className="relative z-10 flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl outline-none"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2
              id="terms-dialog-title"
              className="text-xl font-semibold text-foreground sm:text-2xl"
            >
              {TERMS_MODAL.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-secondary">
              {TERMS_MODAL.intro}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-secondary transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Close"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <section className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <h3 className="text-base font-semibold text-foreground">
              {TERMS_MODAL.evidenceNotice.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-secondary">
              {TERMS_MODAL.evidenceNotice.body}
            </p>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            {TERMS_SECTIONS.map((section) => (
              <article
                key={section.title}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <h4 className="text-sm font-semibold text-foreground">
                  {section.title}
                </h4>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  {section.body}
                </p>
              </article>
            ))}
          </div>

          <section className="mt-6 rounded-xl border border-border bg-muted/50 p-4">
            <h3 className="text-base font-semibold text-foreground">
              {TERMS_MODAL.acceptance.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-secondary">
              {TERMS_MODAL.acceptance.body}
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
                className="mt-1 size-4 shrink-0 cursor-pointer rounded border-border text-primary focus:ring-primary"
              />
              <span>{TERMS_MODAL.acceptance.checkboxLabel}</span>
            </label>
          </section>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} className="sm:min-w-36">
            {TERMS_MODAL.acceptance.cancelButton}
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!accepted}
            className="bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 sm:min-w-52"
          >
            {accepted
              ? TERMS_MODAL.acceptance.acceptButton
              : TERMS_MODAL.acceptance.acceptButtonDisabled}
          </Button>
        </div>
      </div>
    </div>
  );
}
