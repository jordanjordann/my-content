import { AnalysisScoreExplainPopover } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/popovers/AnalysisScoreExplainPopover";
import { buildScoreAccessibleLabel } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell/helpers";
import { ScorePerformanceGroup } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell/ScorePerformanceGroup";
import { ScorePipTrackAndNumeral } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell/ScorePipTrackAndNumeral";
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
 *
 * The "performance" variant's rendering is factored out into `ScorePerformanceGroup` (PR #348
 * review, P1) so `AnalysisSummaryCard` — the <640px card — reuses the exact same pips +
 * `role="group"` accessible-label markup rather than reinventing it.
 */
export function AnalysisScoreCell(props: AnalysisScoreCellProps) {
  if (props.variant === "content") {
    const accessibleLabel = buildScoreAccessibleLabel({ variant: "content", score: props.score });
    return (
      <span role="group" aria-label={accessibleLabel}>
        <ScorePipTrackAndNumeral variant="content" score={props.score} />
      </span>
    );
  }

  return (
    <ScorePerformanceGroup
      score={props.score}
      tierPhrase={props.tierPhrase}
      isTier3={props.isTier3}
      confidenceWord={props.confidenceWord}
      explainTrigger={<AnalysisScoreExplainPopover row={props.row} />}
    />
  );
}
