import { cn } from "@/lib/utils";
import {
  SCORE_NUMERAL_COLOR_CLASSNAME,
  SCORE_PIP_FILL_CLASSNAME,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell/constants";
import { ScorePipTrack } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell/ScorePipTrack";

/**
 * The `4 ▪▪▪▪▫` line only — numeral (`aria-hidden`, coloured per variant) plus the pip track.
 * Internal to the `AnalysisScoreCell` module, shared by both the "content" variant and
 * `ScorePerformanceGroup`'s first line so the exact same markup renders in every place a
 * score's pips appear.
 */
export function ScorePipTrackAndNumeral({ variant, score }: { variant: "content" | "performance"; score: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px]">
      <span aria-hidden="true" className={cn("tabular-nums font-semibold", SCORE_NUMERAL_COLOR_CLASSNAME[variant])}>
        {score}
      </span>
      <ScorePipTrack score={score} fillClassName={SCORE_PIP_FILL_CLASSNAME[variant]} />
    </span>
  );
}
