import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";
import type { AnalysisTableRowGroups } from "@/app/app/analyses/components/grids/AnalysisDataTable/types";

export type AnalysisCardListProps = {
  isPending: boolean;
  isError: boolean;
  /** Same fallback ("Something went wrong.") the table branch already computes — passed in, never re-derived. */
  errorMessage: string;
  onRetry: () => void;
  noneAtAll: boolean;
  noMatch: boolean;
  onNewAnalysis: () => void;
  onClearFilters: () => void;
  /**
   * Ticket #337 — the already-computed page groups (`AnalysisDataTable`'s own
   * `groupAnalysisRows` output). This module performs no filtering, slicing, sorting or
   * reshaping of its own (AGENTS.md data-transformation rules) — it only renders what it
   * is given, which is also what proves the card list and the table show the same rows.
   */
  groups: AnalysisTableRowGroups;
  /** Row click / `Enter` — opens the existing detail modal (design §8), same as the table. */
  onOpen: (id: string) => void;
};

export type AnalysisSummaryCardProps = {
  row: AnalysisListItemIndexed;
  onOpen: (id: string) => void;
};
