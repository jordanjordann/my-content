"use client";

import { cn } from "@/lib/utils";
import { MAX_SCORE } from "@/app/app/analyses/constants";
import { AnalysisScoreExplainPopover } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/popovers/AnalysisScoreExplainPopover";
import {
  SCORE_NUMERAL_COLOR_CLASSNAME,
  SCORE_PIP_EMPTY_CLASSNAME,
  SCORE_PIP_FILL_CLASSNAME,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell/constants";
import { buildScoreAccessibleLabel } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell/helpers";
import type { AnalysisScoreCellProps } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell/types";

/**
 * DESIGN-3C §5 / TDD §9.3 — five discrete square pips + the numeral (`4 ▪▪▪▪▫`), never a
 * bar (a bar reads as a percentage; discrete pips are countable and cannot be misread as a
 * continuous proportion). Pips are `aria-hidden` and decorative (exempt from WCAG 1.4.11).
 *
 * The group carries the combined accessible name (`role="group"` + `aria-label`), but
 * `role="group"`'s name is announced IN ADDITION TO its descendants, not instead of them —
 * so every visible text descendant that duplicates information already in the label
 * (the numeral, the tier phrase, the confidence word) is itself `aria-hidden`, leaving the
 * group label as the only thing a screen reader announces for those fragments. The `ⓘ`
 * trigger is deliberately NOT inside that hidden scope — it is a real interactive element
 * with its own `aria-label`, unrelated to the judgement text (PR #201 review, N1).
 *
 * Structurally enforced (design §5, "a Performance cell with no second line is a bug"): the
 * `content` branch has no JSX path that can render a second line at all; the `performance`
 * branch unconditionally renders the second-line wrapper (`data-testid` below), even when a
 * value inside it happens to be empty, so the wrapper's absence is always a real regression,
 * never a legitimately-empty state that looks the same.
 */
export function AnalysisScoreCell(props: AnalysisScoreCellProps) {
  const pipFill = SCORE_PIP_FILL_CLASSNAME[props.variant];
  const numeralColorClassName = SCORE_NUMERAL_COLOR_CLASSNAME[props.variant];

  if (props.variant === "content") {
    const accessibleLabel = buildScoreAccessibleLabel({ variant: "content", score: props.score });
    return (
      <span role="group" aria-label={accessibleLabel} className="inline-flex items-center gap-1.5 text-[12.5px]">
        <span aria-hidden="true" className={cn("tabular-nums font-semibold", numeralColorClassName)}>
          {props.score}
        </span>
        <ScorePipTrack score={props.score} fillClassName={pipFill} />
      </span>
    );
  }

  const accessibleLabel = buildScoreAccessibleLabel({
    variant: "performance",
    score: props.score,
    tierPhrase: props.tierPhrase,
    confidenceWord: props.confidenceWord,
  });

  return (
    <div role="group" aria-label={accessibleLabel}>
      <span className="inline-flex items-center gap-1.5 text-[12.5px]">
        <span aria-hidden="true" className={cn("tabular-nums font-semibold", numeralColorClassName)}>
          {props.score}
        </span>
        <ScorePipTrack score={props.score} fillClassName={pipFill} />
      </span>
      <div data-testid="performance-score-second-line">
        {props.tierPhrase != null && (
          <p className={cn("text-[11px] text-muted-foreground", props.isTier3 && "italic")}>
            <span aria-hidden="true">{props.tierPhrase}</span>
            {" "}
            <AnalysisScoreExplainPopover row={props.row} />
          </p>
        )}
        {props.tierPhrase == null && (
          // Still one `ⓘ` per row even in the (structurally unreachable today) case where
          // a score exists with no tier phrase — the affordance must never depend on the
          // tier phrase resolving, only on the score existing.
          <p className="text-[11px] text-muted-foreground">
            <AnalysisScoreExplainPopover row={props.row} />
          </p>
        )}
        {props.confidenceWord != null && (
          <p aria-hidden="true" className="text-[11px] text-muted-foreground">{props.confidenceWord}</p>
        )}
      </div>
    </div>
  );
}

function ScorePipTrack({ score, fillClassName }: { score: number; fillClassName: string }) {
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
