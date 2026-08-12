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
