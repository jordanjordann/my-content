"use client";

import { cn } from "@/lib/utils";
import { BEAT_TYPE_LABELS } from "@/lib/analysis/taxonomy/labels";
import type { StructureBeatTimelineProps } from "@/app/app/analyses/components/sections/AnalysisStyleSection/types";
import { formatTempoReadout, formatTimestamp } from "@/app/app/analyses/components/sections/AnalysisStyleSection/helpers";

/**
 * `structureBeatMap` as a horizontal timeline, one dot per beat, each with
 * its timestamp and Indonesian description available on hover/focus
 * (design doc §2.8) — this is the one Tier 1 field that is inherently
 * temporal, so a flat bulleted list would discard the "when in the video"
 * information that's the actual point of capturing beats.
 */
export function StructureBeatTimeline({
  beats,
  pacing,
  estimatedCutsPerMinute,
}: StructureBeatTimelineProps) {
  if (beats.length === 0) return null;

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Structure Beats
        </div>
        <span className="text-xs text-muted-foreground">
          {formatTempoReadout(pacing, estimatedCutsPerMinute)}
        </span>
      </div>

      <div className="relative pt-2">
        <div className="h-1 rounded-full bg-muted" />
        <div className="-mt-1 flex justify-between">
          {beats.map((beat, i) => (
            <div
              key={`${beat.timestampSec}-${i}`}
              className="group relative flex flex-col items-center"
              tabIndex={0}
            >
              <div
                className={cn(
                  "size-3 rounded-full border-2 border-background ring-1",
                  beat.beatType === "CTA" ? "bg-accent ring-accent" : "bg-primary ring-primary",
                )}
              />
              <span className="mt-1 text-[10px] text-muted-foreground">
                {formatTimestamp(beat.timestampSec)}
              </span>
              <span className="text-[10px] font-medium">{BEAT_TYPE_LABELS[beat.beatType]}</span>

              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-48 -translate-x-1/2 rounded-md border bg-popover p-2 text-[11px] text-popover-foreground shadow-md group-hover:block group-focus:block"
              >
                {formatTimestamp(beat.timestampSec)} — {beat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Hover or focus a point for the beat detail.
      </p>
    </div>
  );
}
