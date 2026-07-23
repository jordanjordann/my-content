"use client";

import { SparklesIcon } from "lucide-react";

import type { ScorecardSectionProps } from "@/app/app/analyses/components/sections/types";
import { ScorePipMeter } from "./components/meters/ScorePipMeter";
import { DimensionScoreRow } from "./components/rows/DimensionScoreRow";
import { AI_SCORE_DISCLAIMER, DIMENSIONS } from "./constants";
import { getRubricSentence } from "./helpers";

/**
 * Tier 2 scorecard — 7 dimensions, each a 1-5 pip meter (design doc,
 * Direction A "Skor AI" tab). Replaces the old radial gauge: on the new
 * 1-5 scale `overallScore / 10` drew a perfect 5 as a half-empty ring
 * labelled "5 / 10" (TDD §8.1) — the pip meter has no such division.
 *
 * The "Penilaian AI" disclaimer sits once at the top of this section, not
 * per-row — the per-row rubric tooltip carries the per-score honesty
 * burden (design doc §2.3).
 */
export function AnalysisScorecardSection({ results }: ScorecardSectionProps) {
  const { overallScore, scorecard, summary } = results;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-primary">
        <SparklesIcon className="size-4 shrink-0" aria-hidden="true" />
        <span>{AI_SCORE_DISCLAIMER}</span>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
        <div className="flex flex-col items-start gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Overall
          </span>
          <ScorePipMeter score={overallScore} />
        </div>
        <p className="text-sm text-muted-foreground sm:flex-1">{summary}</p>
      </div>

      <div className="rounded-xl border">
        {DIMENSIONS.map(({ key, label }) => {
          const score = scorecard[key];
          return (
            <DimensionScoreRow
              key={key}
              label={label}
              score={score}
              rubricSentence={getRubricSentence(key, score)}
            />
          );
        })}
      </div>
    </div>
  );
}
