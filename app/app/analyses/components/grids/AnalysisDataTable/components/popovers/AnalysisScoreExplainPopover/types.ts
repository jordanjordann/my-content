import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";

export type AnalysisScoreExplainPopoverProps = {
  /**
   * The row already carries everything the popover needs (`performance.computed`,
   * `performance.judgement.drivers`, `tableDerived.disagreementLine`/`multiplierCell`,
   * `createdAt`) — passed whole rather than destructured at the call site so this module
   * owns its own formatting without a second derivation layer (AGENTS.md).
   */
  row: AnalysisListItemIndexed;
};
