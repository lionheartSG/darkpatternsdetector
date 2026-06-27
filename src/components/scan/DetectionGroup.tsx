"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { DetectionCard } from "@/components/scan/DetectionCard";
import type { ScanWithDetections } from "@/types/scan";

type DetectionGroupProps = {
  category: string;
  detections: ScanWithDetections["detections"];
};

export function DetectionGroup({ category, detections }: DetectionGroupProps) {
  const [open, setOpen] = useState(true);
  const label = category.replaceAll("_", " ");

  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center justify-between bg-muted/30 px-4 py-4 text-left transition-colors duration-200 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none"
        aria-expanded={open}
      >
        <span className="font-semibold text-foreground">
          {label} ({detections.length})
        </span>
        <ChevronDown
          className={`size-5 text-secondary transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="grid gap-4 p-4 md:grid-cols-2">
          {detections.map((detection) => (
            <DetectionCard key={detection.id} detection={detection} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
