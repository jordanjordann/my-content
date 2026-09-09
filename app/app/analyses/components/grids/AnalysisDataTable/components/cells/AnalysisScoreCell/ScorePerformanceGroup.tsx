"use client";

import { cn } from "@/lib/utils";
import { buildScoreAccessibleLabel } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell/helpers";
import { ScorePipTrackAndNumeral } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell/ScorePipTrackAndNumeral";
import type { ScorePerformanceGroupProps } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell/types";

/**
 * DESIGN-3C §5 (Traps 1-3) — the Performance cell's numeral + pips + second line, wrapped in
 * one `role="group"` carrying the combined accessible name (`buildScoreAccessibleLabel`,
 * e.g. `"Performance 4 out of 5, compared to their usual, high confidence"`). Every visible
 * text fragment that duplicates the group's own accessible name (tier phrase, confidence
 * word) is itself `aria-hidden`, so a screen reader announces the group name once rather than
 * the same judgement twice.
 *
 * `explainTrigger` is the one thing that varies by call site (PR #348 review, P1): the table's
 * `AnalysisScoreCell` passes the real `AnalysisScoreExplainPopover` button; `AnalysisSummaryCard`
 * (the <640px card, ticket #337) passes `null` because that trigger is itself a `<button>`, and
 * nesting a `<button>` inside the card's own whole-card `<button>` is invalid HTML. The pips and
 * the group's accessible name are never conditional on `explainTrigger` — dropping either would
 * reproduce exactly the failure DESIGN-3C §5 exists to prevent.
 */
export function ScorePerformanceGroup({
  score,
  tierPhrase,
  isTier3,
  confidenceWord,
  explainTrigger,
}: ScorePerformanceGroupProps) {
  const accessibleLabel = buildScoreAccessibleLabel({ variant: "performance", score, tierPhrase, confidenceWord });

  return (
    <div role="group" aria-label={accessibleLabel}>
      <ScorePipTrackAndNumeral variant="performance" score={score} />
      <div data-testid="performance-score-second-line">
        {tierPhrase != null && (
          <p className={cn("text-[11px] text-muted-foreground", isTier3 && "italic")}>
            <span aria-hidden="true">{tierPhrase}</span>
            {explainTrigger != null && <> {explainTrigger}</>}
          </p>
        )}
        {tierPhrase == null && explainTrigger != null && (
          // Still one `ⓘ` per row even in the (structurally unreachable today) case where a
          // score exists with no tier phrase — the affordance must never depend on the tier
          // phrase resolving, only on the score existing. The card has no explain trigger, so
          // this branch renders nothing for it, which is correct: there is no popover to show.
          <p className="text-[11px] text-muted-foreground">{explainTrigger}</p>
        )}
        {confidenceWord != null && (
          <p aria-hidden="true" className="text-[11px] text-muted-foreground">
            {confidenceWord}
          </p>
        )}
      </div>
    </div>
  );
}
