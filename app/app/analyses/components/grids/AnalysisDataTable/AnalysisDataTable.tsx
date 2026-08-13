"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAnalysesQuery } from "@/lib/api/analyses";
import { ANALYSES_FETCH_ALL_PAGE_SIZE } from "@/lib/api/analyses/constants";
import type { AnalysesSortField, AnalysisListItemIndexed, SortDirection } from "@/lib/api/analyses/types";
import { AnalysisTableColumnHeaders } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/headers/AnalysisTableColumnHeaders";
import { AnalysisTableRow } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/rows/AnalysisTableRow";
import { AnalysisTableSkeletonRow } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/rows/AnalysisTableSkeletonRow";
import { AnalysisTableEmptyState } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/states/AnalysisTableEmptyState";
import { AnalysisTableErrorState } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/states/AnalysisTableErrorState";
import { AnalysisSinkDivider } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/dividers/AnalysisSinkDivider";
import { AnalysisColumnsMenu } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/menus/AnalysisColumnsMenu";
import type { AnalysisColumnsMenuColumn } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/menus/AnalysisColumnsMenu";
import {
  ANALYSES_TABLE_COLUMNS,
  ANALYSES_TABLE_PAGE_SIZE,
  DEFAULT_SORT_DIR,
  DEFAULT_SORT_FIELD,
  DEFAULT_VISIBLE_COLUMN_IDS,
  LOCKED_COLUMN_IDS,
  SKELETON_ROW_COUNT,
  STYLE_COLUMN,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";
import { groupAnalysisRows } from "@/app/app/analyses/components/grids/AnalysisDataTable/helpers";
import { matchesDimensions, matchesKeyword } from "@/app/app/analyses/helpers";
import { EMPTY_ANALYSIS_FILTERS } from "@/app/app/analyses/constants";
import type {
  AnalysisDataTableProps,
  AnalysisTableDensity,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/types";

const ALL_COLUMNS = [...ANALYSES_TABLE_COLUMNS, STYLE_COLUMN];

/**
 * Ticket #145 (skeleton) / #149 (filters, column menu) — the analyses table: 9 default columns
 * plus the optional Style column (OR-1, OR-5), the shared `Scores` group header, two density
 * modes (OR-7), the sink group (R-S2), the four render states (design §7), full table/
 * `aria-sort`/keyboard semantics (design §8-§10) — and now real client-visible filtering and
 * per-column visibility.
 *
 * **Fetch strategy (ticket #149).** #145 self-fetched one server-paginated page at a time
 * (`page`/`sortBy`/`sortDir`). Filtering changes that: the #144 API has no filter query params
 * (this ticket's own Files Affected list does not touch `app/api/analyses/route.ts`'s query
 * surface, and inventing filter params there is out of scope), so a filtered "Showing 24 of 118"
 * count and a correctly filtered page can only be computed from the FULL corpus. This table now
 * requests `ANALYSES_FETCH_ALL_PAGE_SIZE` rows — the same bridge `useAllAnalysesQuery` already
 * uses for the OLD page — with `sortBy`/`sortDir` still forwarded, so the **server** still does
 * the sort (identical null-sink behaviour, R-S1) over the *whole* corpus in one response; this
 * component then filters that already-correctly-sorted array client-side and paginates the
 * *filtered* result at `ANALYSES_TABLE_PAGE_SIZE` locally. That keeps sort order, the filtered
 * count, and the true unfiltered total (`data.pagination.total`) all honest — the trade is one
 * larger fetch instead of N small ones, acceptable for this dataset size and explicitly
 * preferred over a filter bar that looks wired but silently only searches page 1 (the
 * "confident-looking wrong number" the ticket's reliability rule warns against).
 */
export function AnalysisDataTable({
  onAnalysisClick,
  onNewAnalysis,
  openAnalysisId,
  onClearFilters,
  filters = EMPTY_ANALYSIS_FILTERS,
}: AnalysisDataTableProps) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<AnalysesSortField>(DEFAULT_SORT_FIELD);
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR);
  // OR-5 / DESIGN-3C §6.3 (superseded 2026-08-09) — plain React state, no persistence of
  // any kind. Comfortable is the owner-ruled default (OR-7).
  const [density, setDensity] = useState<AnalysisTableDensity>("comfortable");
  // OR-5 / DESIGN-3C §6.3 (superseded 2026-08-09, scope addition on #149) — Style starts
  // hidden on EVERY load, plain React state, no `localStorage`/`sessionStorage`/URL param/
  // per-user storage of any kind. Locked columns are always in this set (never removed —
  // `toggleColumn` below refuses to touch a locked id).
  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(
    () => new Set(DEFAULT_VISIBLE_COLUMN_IDS),
  );

  const { data, isPending, isError, error, refetch } = useAnalysesQuery({
    sortBy,
    sortDir,
    pageSize: ANALYSES_FETCH_ALL_PAGE_SIZE,
  });

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

  const toggleColumn = (id: string) => {
    if (LOCKED_COLUMN_IDS.has(id) || id !== "style") {
      // Only Style is genuinely interactive (see `AnalysisColumnsMenuColumn.interactive`'s
      // own doc comment for why the other five default columns are checked-and-disabled).
      return;
    }
    setVisibleColumnIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayColumns = useMemo(
    () => ALL_COLUMNS.filter((column) => visibleColumnIds.has(column.id)),
    [visibleColumnIds],
  );

  const menuColumns: AnalysisColumnsMenuColumn[] = useMemo(
    () =>
      ALL_COLUMNS.map((column) => ({
        id: column.id,
        // "Content" (col 1) and "Content score" (col 5's sub-label) share the header label
        // "Content" by design (the Scores group header disambiguates them in-table) — the
        // Columns menu has no group header, so this disambiguates them here specifically.
        label: column.id === "contentScore" ? "Content score" : column.label,
        locked: LOCKED_COLUMN_IDS.has(column.id),
        interactive: column.id === "style",
      })),
    [],
  );

  // Ticket #149 — client-side filter over the full, server-sorted corpus (see the module doc
  // comment above). Never re-sorts: `data.analyses` already arrives in the server's own order.
  const filteredRows: AnalysisListItemIndexed[] = useMemo(() => {
    const rows = data?.analyses ?? [];
    return rows.filter((row) => matchesDimensions(row, filters) && matchesKeyword(row, filters.q));
  }, [data?.analyses, filters]);

  const totalCount = data?.pagination.total ?? 0;
  const filteredCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / ANALYSES_TABLE_PAGE_SIZE));
  // Pure derivation (never `setPage` from an effect) — if a filter change makes the current
  // page point past the end, this clamps the SLICE without a stale-then-corrected extra render.
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice(
    (safePage - 1) * ANALYSES_TABLE_PAGE_SIZE,
    safePage * ANALYSES_TABLE_PAGE_SIZE,
  );

  const groups = useMemo(() => groupAnalysisRows(pageRows), [pageRows]);

  const noMatch = !isPending && !isError && totalCount > 0 && filteredCount === 0;
  const noneAtAll = !isPending && !isError && totalCount === 0;

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

    if (noneAtAll) {
      return <AnalysisTableEmptyState variant="nothing-analysed" onNewAnalysis={onNewAnalysis} />;
    }

    // DESIGN-3C §6.2 — "filters never hide the reason a row has no score": `noMatch` only ever
    // means zero rows matched the filter SET, never that a matched row's own absent-score
    // reason is suppressed — every matched row below still renders through the unchanged #145/
    // #147 cell pipeline (`AnalysisTableRow`), reason text included.
    if (noMatch) {
      return (
        <AnalysisTableEmptyState variant="no-match" onClearFilters={onClearFilters ?? (() => {})} />
      );
    }

    const rowNode = (row: (typeof groups.scored)[number]) => (
      <AnalysisTableRow
        key={row.id}
        row={row}
        columns={displayColumns}
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
            colSpan={displayColumns.length}
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
          <AnalysisSinkDivider colSpan={displayColumns.length} label={`Analysis failed — ${groups.nonCompleted.length}`} />
        )}
        {groups.nonCompleted.map(rowNode)}
      </>
    );
  })();

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-end gap-2 border-b p-2">
        <AnalysisColumnsMenu columns={menuColumns} visibleColumnIds={visibleColumnIds} onToggle={toggleColumn} />
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
          <AnalysisTableColumnHeaders
            columns={displayColumns}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={handleSortChange}
          />
          <tbody>{bodyContent}</tbody>
        </table>
      </div>

      {!isPending && !isError && totalCount > 0 && (
        <div className="flex items-center justify-between border-t p-3 text-sm text-muted-foreground">
          {/* R-D1 (TDD §9.2, DESIGN-3C §4.1) — no aggregate/total/"typical engagement" row
              exists anywhere in this table (R-12.3.3). Where a user might reasonably expect
              one, the footer says so in words, exactly as specified. */}
          <span className="text-xs">No totals — these posts are measured against different things.</span>
          <span>
            Page {safePage} of {totalPages} — {filteredCount} of {totalCount} analyses
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
