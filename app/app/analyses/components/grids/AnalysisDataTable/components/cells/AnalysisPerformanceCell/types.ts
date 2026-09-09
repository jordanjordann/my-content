import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";

export type AnalysisPerformanceCellProps = {
  row: AnalysisListItemIndexed;
  failed: boolean;
  /**
   * `true` for the table (`AnalysisTableRow`), which embeds
   * `AnalysisScoreExplainPopover` — a real, focusable `<button>`. `false` for the <640px card
   * (`AnalysisSummaryCard`, ticket #337), where that trigger would nest a `<button>` inside the
   * card's own whole-card `<button>` (invalid HTML). This is the only thing that varies between
   * the two call sites — every branch of copy, and the score's pips + accessible label, are
   * identical either way (PR #348 review, P1/P2).
   */
  withExplainTrigger: boolean;
};
