"use client";

import { cn } from "@/lib/utils";
import { MAX_SCORE } from "@/app/app/analyses/constants";
import { formatScoreBandLabel, getScoreColorClass } from "@/app/app/analyses/helpers";
import type { ScorePipMeterProps } from "@/app/app/analyses/components/sections/AnalysisScorecardSection/types";

/**
 * Five-pip meter, filled left-to-right to the score value (design doc §2.1).
 * Replaces the old radial gauge — a battery/step meter reads as discrete
 * steps on a 5-point scale, where a percentage-style ring implies a smooth,
 * continuous measurement the data doesn't have.
 *
 * The band-word text (`formatScoreBandLabel`) is always rendered alongside
 * the pips, never color-only, so this remains legible without relying on
 * fill color alone (a11y §4).
 */
export function ScorePipMeter({ score, size = "md" }: ScorePipMeterProps) {
  const pipSize = size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5";
  const colorClass = getScoreColorClass(score);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: MAX_SCORE }, (_, i) => i + 1).map((pip) => (
          <div
            key={pip}
            className={cn(
              "rounded-sm",
              pipSize,
              pip <= score ? cn("bg-current", colorClass) : "bg-muted",
            )}
          />
        ))}
      </div>
      <span className={cn("text-xs font-medium", colorClass)}>{formatScoreBandLabel(score)}</span>
    </div>
  );
}
