"use client";

import { useId, useState } from "react";
import { InfoIcon } from "lucide-react";

import { ScorePipMeter } from "@/app/app/analyses/components/sections/AnalysisScorecardSection/components/meters/ScorePipMeter";
import type { DimensionScoreRowProps } from "@/app/app/analyses/components/sections/AnalysisScorecardSection/types";

/**
 * One scorecard dimension row: label, pip meter, and a rubric-band info
 * trigger (design doc §2.2). The trigger is a real focusable `<button>`
 * with `aria-describedby` pointing at a `role="tooltip"` element shown on
 * hover OR focus — not a native `title` attribute, which is not reliably
 * keyboard/screen-reader reachable (design doc §4).
 */
export function DimensionScoreRow({ label, score, rubricSentence }: DimensionScoreRowProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <div className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-full text-sm font-medium sm:w-40">{label}</span>
      <ScorePipMeter score={score} />
      <div className="relative sm:ml-auto">
        <button
          type="button"
          aria-describedby={open ? tooltipId : undefined}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <InfoIcon className="size-3.5" aria-hidden="true" />
          why?
        </button>
        {open && (
          <div
            id={tooltipId}
            role="tooltip"
            className="absolute right-0 top-full z-10 mt-1 w-64 rounded-md border bg-popover p-2.5 text-xs text-popover-foreground shadow-md"
          >
            {rubricSentence}
          </div>
        )}
      </div>
    </div>
  );
}
