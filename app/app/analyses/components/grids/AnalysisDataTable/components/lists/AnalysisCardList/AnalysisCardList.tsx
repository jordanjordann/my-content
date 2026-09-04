import { AlertTriangle, BarChart3, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SKELETON_ROW_COUNT,
  buildFailedDividerLabel,
  buildScorelessDividerLabel,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";
import { AnalysisSummaryCard } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/lists/AnalysisCardList/components/cards/AnalysisSummaryCard";
import type { AnalysisCardListProps } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/lists/AnalysisCardList/types";
import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";

/**
 * Ticket #337 (TDD §6.3, design §8) — the <640px stacked-card equivalent of the analyses
 * table body. Mounted instead of the `<table>`, never alongside it (`AnalysisDataTable.tsx`'s
 * `isBelowSm` switch, C-5) — never both in the DOM at once.
 *
 * Owns no data logic (AGENTS.md data-transformation rules, TDD §3): `groups` arrives already
 * computed by `AnalysisDataTable`'s own `groupAnalysisRows`; this component performs no
 * filtering, slicing, sorting or reshaping of it, which is also what proves the card list and
 * the table show the same rows for the same fixture.
 *
 * The four render states mirror the table's own (design §7): loading skeleton, error, the two
 * distinct empty states, and the real card list with its sink-group dividers. `AnalysisTableEmptyState`
 * / `AnalysisTableErrorState` render `<tr><td colSpan>` and cannot be reused inside a card list
 * (C-7) — these branches below render the identical copy and reuse the same `Button`/icon
 * building blocks without a table wrapper.
 */
export function AnalysisCardList({
  isPending,
  isError,
  errorMessage,
  onRetry,
  noneAtAll,
  noMatch,
  onNewAnalysis,
  onClearFilters,
  groups,
  onOpen,
}: AnalysisCardListProps) {
  if (isPending) {
    return (
      <div aria-hidden="true">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-b p-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-rose-500" aria-hidden="true" />
        <h2 className="mb-2 text-lg font-semibold text-rose-500">Couldn&apos;t load analyses</h2>
        <p className="mb-6 text-sm text-muted-foreground">{errorMessage}</p>
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (noneAtAll) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
        <h2 className="mb-2 text-lg font-semibold">No analyses yet</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Paste some URLs and get AI-powered insights on your content.
        </p>
        <Button onClick={onNewAnalysis}>Analyse a post</Button>
      </div>
    );
  }

  if (noMatch) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <SearchX className="mb-4 h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
        <h2 className="mb-2 text-lg font-semibold">No analyses match these filters</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Try widening or clearing your filters to see more results.
        </p>
        <Button variant="outline" onClick={onClearFilters}>
          Clear all filters
        </Button>
      </div>
    );
  }

  const cardItem = (row: AnalysisListItemIndexed) => (
    <li key={row.id} className="border-b">
      <AnalysisSummaryCard row={row} onOpen={onOpen} />
    </li>
  );

  return (
    <ul>
      {groups.scored.map(cardItem)}
      {groups.scoreless.length > 0 && (
        <li className="border-b bg-muted/30 px-3 py-1.5">
          <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
            {buildScorelessDividerLabel(groups.scoreless.length)}
          </p>
        </li>
      )}
      {groups.scoreless.map(cardItem)}
      {groups.nonCompleted.length > 0 && (
        <li className="border-b bg-muted/30 px-3 py-1.5">
          <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
            {buildFailedDividerLabel(groups.nonCompleted.length)}
          </p>
        </li>
      )}
      {groups.nonCompleted.map(cardItem)}
    </ul>
  );
}
