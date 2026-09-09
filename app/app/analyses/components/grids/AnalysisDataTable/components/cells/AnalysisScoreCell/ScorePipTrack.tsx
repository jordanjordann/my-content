import { cn } from "@/lib/utils";
import { MAX_SCORE } from "@/app/app/analyses/constants";
import { SCORE_PIP_EMPTY_CLASSNAME } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell/constants";

/**
 * DESIGN-3C §5, Trap 1/2 — five discrete square pips, `aria-hidden` and decorative (the
 * numeral carries the information, per `buildScoreAccessibleLabel`). Internal to the
 * `AnalysisScoreCell` module — not barrelled, shared only by `AnalysisScoreCell.tsx` and
 * `ScorePipTrackAndNumeral.tsx` in this same directory.
 */
export function ScorePipTrack({ score, fillClassName }: { score: number; fillClassName: string }) {
  return (
    <span aria-hidden="true" className="inline-flex gap-0.5">
      {Array.from({ length: MAX_SCORE }, (_, index) => (
        <span
          key={index}
          className={cn(
            "size-[7px] rounded-[2px]",
            index < score ? fillClassName : SCORE_PIP_EMPTY_CLASSNAME,
          )}
        />
      ))}
    </span>
  );
}
