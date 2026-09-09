import type { ReactNode } from "react";

import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";

/**
 * Ticket #147 — the Content cell (col 5) is numeral + pips ONLY, structurally incapable of
 * a second line (design §5, "the Content cell never does"). The Performance cell (col 6)
 * always carries a second line and the row's one `ⓘ` explain affordance — `row` is passed
 * through so the popover can read the already-computed `performance`/`tableDerived` blocks
 * without this cell re-deriving anything (AGENTS.md's layering rule).
 */
export type AnalysisScoreCellProps =
  | { variant: "content"; score: number }
  | {
      variant: "performance";
      score: number;
      tierPhrase: string | null;
      isTier3: boolean;
      confidenceWord: string | null;
      row: AnalysisListItemIndexed;
    };

/**
 * Ticket #337 (PR #348 review, P1) — the numeral + five-pip track + second line, factored out
 * of `AnalysisScoreCell`'s "performance" variant so `AnalysisSummaryCard` (the <640px card)
 * renders the exact same pips + `role="group"`/`aria-label="N out of 5"` the table does
 * (DESIGN-3C §5, Traps 1-3), instead of reinventing a bare numeral. `explainTrigger` is the
 * only thing the two call sites differ on: the table passes the real
 * `AnalysisScoreExplainPopover` button; the card passes `null` because nesting a `<button>`
 * inside the card's own whole-card `<button>` is invalid HTML (interactive content cannot
 * contain interactive content) — that omission is the one documented, sanctioned deviation,
 * never the pips or the accessible label.
 */
export type ScorePerformanceGroupProps = {
  score: number;
  tierPhrase: string | null;
  isTier3: boolean;
  confidenceWord: string | null;
  explainTrigger: ReactNode | null;
};
