"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAnalysesQuery } from "@/lib/api/analyses";
import type { AnalysesSortField, SortDirection } from "@/lib/api/analyses/types";
import { AnalysisTableColumnHeaders } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/headers/AnalysisTableColumnHeaders";
import { AnalysisTableRow } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/rows/AnalysisTableRow";
import { AnalysisTableSkeletonRow } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/rows/AnalysisTableSkeletonRow";
import { AnalysisTableEmptyState } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/states/AnalysisTableEmptyState";
import { AnalysisTableErrorState } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/states/AnalysisTableErrorState";
import { AnalysisSinkDivider } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/dividers/AnalysisSinkDivider";
import {
  ANALYSES_TABLE_COLUMNS,
  DEFAULT_SORT_DIR,
  DEFAULT_SORT_FIELD,
  SKELETON_ROW_COUNT,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";
import { groupAnalysisRows } from "@/app/app/analyses/components/grids/AnalysisDataTable/helpers";
import type {
  AnalysisDataTableProps,
  AnalysisTableDensity,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/types";

/**
 * Ticket #145 — the analyses table skeleton every cell ticket (#146/#147/#149) plugs
 * into: 9 columns (OR-1), the shared `Scores` group header, two density modes (OR-7),
 * server-side pagination and sort (OR-8), the sink group (R-S2), the four render states
 * (design §7), and full table/`aria-sort`/keyboard semantics (design §8-§10).
 *
 * Self-fetching (owns `useAnalysesQuery`) rather than taking rows as a prop — server-side
 * pagination/sort (OR-8) means the caller cannot own the row list without duplicating this
 * component's page/sort state.
 */
export function AnalysisDataTable({
  onAnalysisClick,
  onNewAnalysis,
  openAnalysisId,
  hasActiveFilters = false,
  onClearFilters,
}: AnalysisDataTableProps) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<AnalysesSortField>(DEFAULT_SORT_FIELD);
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR);
  // OR-5 / DESIGN-3C §6.3 (superseded 2026-08-09) — plain React state, no persistence of
  // any kind. Comfortable is the owner-ruled default (OR-7).
  const [density, setDensity] = useState<AnalysisTableDensity>("comfortable");

  const { data, isPending, isError, error, refetch } = useAnalysesQuery({ page, sortBy, sortDir });

  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const lastOpenedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (openAnalysisId) {
      lastOpenedIdRef.current = openAnalysisId;
      return;
    }
    // Transition from open -> closed: return focus to the row that opened it (design §8).
    const lastId = lastOpenedIdRef.current;
    if (lastId) {
      rowRefs.current.get(lastId)?.focus();
      lastOpenedIdRef.current = null;
    }
  }, [openAnalysisId]);

  const handleSortChange = (field: AnalysesSortField) => {
    if (field === sortBy) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      const column = ANALYSES_TABLE_COLUMNS.find((c) => c.sortField === field);
      setSortBy(field);
      setSortDir(column?.defaultSortDir ?? "desc");
    }
    setPage(1);
  };

  const groups = useMemo(() => groupAnalysisRows(data?.analyses ?? []), [data?.analyses]);

  const bodyContent = (() => {
    if (isPending) {
      return Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
        <AnalysisTableSkeletonRow key={index} />
      ));
    }

    if (isError) {
      return (
        <AnalysisTableErrorState
          message={error instanceof Error ? error.message : "Something went wrong."}
          onRetry={() => refetch()}
        />
      );
    }

    if (!data || data.pagination.total === 0) {
      return hasActiveFilters ? (
        <AnalysisTableEmptyState variant="no-match" onClearFilters={onClearFilters ?? (() => {})} />
      ) : (
        <AnalysisTableEmptyState variant="nothing-analysed" onNewAnalysis={onNewAnalysis} />
      );
    }

    const rowNode = (row: (typeof groups.scored)[number]) => (
      <AnalysisTableRow
        key={row.id}
        row={row}
        density={density}
        onOpen={onAnalysisClick}
        rowRef={(el) => {
          if (el) rowRefs.current.set(row.id, el);
          else rowRefs.current.delete(row.id);
        }}
      />
    );

    return (
      <>
        {groups.scored.map(rowNode)}
        {groups.scoreless.length > 0 && (
          <AnalysisSinkDivider
            label={`${groups.scoreless.length} post${groups.scoreless.length === 1 ? "" : "s"} with no performance score — sorted separately`}
          />
        )}
        {groups.scoreless.map(rowNode)}
        {/* PR #198 review, blocker 5.1 — DESIGN-3C §3.3 says failed rows sit "under the same
            divider as unscored rows, labelled separately" but never states that second label's
            exact wording, and §6.1's one approved divider template is the scoreless-group
            sentence above. Rather than compose new prose no design doc has signed off, this
            renders the minimal non-prose count-plus-approved-word marker below (`Analysis
            failed` is §3.3's own approved row-level string). Flagged for a design ruling on the
            exact failed-group divider sentence before this ships as prose. */}
        {groups.nonCompleted.length > 0 && (
          <AnalysisSinkDivider label={`Analysis failed — ${groups.nonCompleted.length}`} />
        )}
        {groups.nonCompleted.map(rowNode)}
      </>
    );
  })();

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-end gap-2 border-b p-2">
        <span className="text-xs text-muted-foreground">Density</span>
        <div className="inline-flex rounded-md border">
          <Button
            type="button"
            variant={density === "comfortable" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-r-none"
            aria-pressed={density === "comfortable"}
            onClick={() => setDensity("comfortable")}
          >
            Comfortable
          </Button>
          <Button
            type="button"
            variant={density === "compact" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-l-none"
            aria-pressed={density === "compact"}
            onClick={() => setDensity("compact")}
          >
            Compact
          </Button>
        </div>
      </div>

      <div className="relative max-h-[720px] w-full overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <caption className="sr-only">
            Analyses — every analysed post, its content and performance scores, and how it
            compares against the creator&apos;s own past posts.
          </caption>
          <AnalysisTableColumnHeaders sortBy={sortBy} sortDir={sortDir} onSortChange={handleSortChange} />
          <tbody>{bodyContent}</tbody>
        </table>
      </div>

      {data && data.pagination.total > 0 && (
        <div className="flex items-center justify-between border-t p-3 text-sm text-muted-foreground">
          <span>
            Page {data.pagination.page} of {data.pagination.totalPages} — {data.pagination.total}{" "}
            analyses
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.pagination.page >= data.pagination.totalPages}
              onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
