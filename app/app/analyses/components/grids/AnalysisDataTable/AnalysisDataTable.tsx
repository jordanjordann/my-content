"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAnalysesQuery } from "@/lib/api/analyses";
import { ANALYSES_FETCH_ALL_PAGE_SIZE } from "@/lib/api/analyses/constants";
import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";
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
 * modes (OR-7), the sink group (R-S2), the four render states (design §7), full table
 * semantics (design §8-§10) — and now real client-visible filtering and per-column visibility.
 * Sorting was removed entirely by owner ruling (#266, 2026-08-20, DESIGN-3C amendment A10) — no
 * sort control, no `aria-sort`, no query params; the server's order is fixed at `updated_at DESC`.
 *
 * **Fetch strategy (ticket #149).** #145 self-fetched one server-paginated page at a time
 * (`page`). Filtering changes that: the #144 API has no filter query params (this ticket's own
 * Files Affected list does not touch `app/api/analyses/route.ts`'s query surface, and inventing
 * filter params there is out of scope), so a filtered "Showing 24 of 118" count and a correctly
 * filtered page can only be computed from the FULL corpus. This table requests
 * `ANALYSES_FETCH_ALL_PAGE_SIZE` rows — the same bridge `useAllAnalysesQuery` already uses for
 * the OLD page — over the *whole* corpus in one response, already in the server's fixed
 * `updated_at DESC` order (#266, 2026-08-20 owner ruling — sorting was removed entirely); this
 * component then filters that already-ordered array client-side and paginates the *filtered*
 * result at `ANALYSES_TABLE_PAGE_SIZE` locally. That keeps the filtered count and the true
 * unfiltered total (`data.pagination.total`) both honest — the trade is one larger fetch instead
 * of N small ones, acceptable for this dataset size and explicitly preferred over a filter bar
 * that looks wired but silently only searches page 1 (the "confident-looking wrong number" the
 * ticket's reliability rule warns against).
 *
 * PR #203 review, blocker 1 — `AnalysesContent` (this table's real-page caller) ALSO needs the
 * full corpus for its own filter-bar counts, and independently called `useAllAnalysesQuery`
 * with a different query key, so the page fired two 5000-row fetches on every load. Fixed by
 * both call sites building the exact same `{ pageSize }` params object (see
 * `AnalysesContent.tsx`), so TanStack Query's key hashing dedupes the two hook calls into one
 * network request. #266 removed `sortBy`/`sortDir` from that shared shape entirely — both call
 * sites had to drop them together, or the dedupe would have re-broken.
 */
export function AnalysisDataTable({
  onAnalysisClick,
  onNewAnalysis,
  openAnalysisId,
  onClearFilters,
  filters = EMPTY_ANALYSIS_FILTERS,
}: AnalysisDataTableProps) {
  const [page, setPage] = useState(1);
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

  const toggleColumn = (id: string) => {
    // PR #203 review, blocker 3 — only `Style` is genuinely interactive (see
    // `AnalysisColumnsMenuColumn.interactive`'s own doc comment for why the other five default
    // columns, including all four `LOCKED_COLUMN_IDS`, are checked-and-disabled). `id !== "style"`
    // alone already excludes every locked id (a locked id is never `"style"`) — this is the
    // second, redundant guard behind the Columns menu's own `disabled` button, which is what
    // actually stops the click at the DOM level (belt and braces, not the only line of defence).
    if (id !== "style") {
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
      {/* Ticket #335 (TDD §6.1) — `flex-wrap` so the toolbar drops to a second line below `lg`
          instead of clipping/overflowing, with >=44px touch targets below `lg` only (`h-11
          lg:h-7` on each button — `lg:h-7` restores `Button size="sm"`'s own `h-7`, which
          `cn()`/`twMerge` strips once `h-11` is present, so desktop height is unchanged).
          The density segmented control's
          `rounded-r-none`/`rounded-l-none` pairing must never wrap between its two halves, so
          its `inline-flex` wrapper is kept as one unwrappable flex item alongside the Columns
          menu and the "Density" label. */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-b p-2">
        <AnalysisColumnsMenu columns={menuColumns} visibleColumnIds={visibleColumnIds} onToggle={toggleColumn} />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Density</span>
          <div className="inline-flex rounded-md border">
            <Button
              type="button"
              variant={density === "comfortable" ? "secondary" : "ghost"}
              size="sm"
              className="h-11 rounded-r-none lg:h-7"
              aria-pressed={density === "comfortable"}
              onClick={() => setDensity("comfortable")}
            >
              Comfortable
            </Button>
            <Button
              type="button"
              variant={density === "compact" ? "secondary" : "ghost"}
              size="sm"
              className="h-11 rounded-l-none lg:h-7"
              aria-pressed={density === "compact"}
              onClick={() => setDensity("compact")}
            >
              Compact
            </Button>
          </div>
        </div>
      </div>

      <div className="relative max-h-[720px] w-full overflow-auto">
        <table className="w-full caption-bottom text-[12.5px]">
          <caption className="sr-only">
            Analyses — every analysed post, its content and performance scores, and how it
            compares against the creator&apos;s own past posts.
          </caption>
          <AnalysisTableColumnHeaders columns={displayColumns} />
          <tbody>{bodyContent}</tbody>
        </table>
      </div>

      {!isPending && !isError && totalCount > 0 && (
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 border-t p-3 text-sm text-muted-foreground">
          {/* R-D1 (TDD §9.2, DESIGN-3C §4.1), amended by A5 (R-D11) — no aggregate/total/
              "typical engagement" row exists anywhere in this table (R-12.3.3). Where a user
              might reasonably expect one, the footer says so in words, exactly as specified.
              R-D11: always-visible plain text, never a tooltip/popover; it may wrap to a
              second line and must never be truncated or ellipsised. The footer bar itself
              stays a single row (no `flex-wrap`) — see R-D11's own mechanism below. */}
          <span className="text-xs">
            No totals — some posts are measured against views or plays, others against follower count. The two
            can&apos;t be added or averaged.
          </span>
          {/* R-D11, amended by the ticket #335 owner ruling (2026-09-03, issue #335 comment) —
              below `lg` the footer bar MAY wrap (`flex-wrap`), because at those widths the
              bar's own available width is the page's actual overflow source (F-13/T3
              measurement: the `min-w-0` pagination group overflowed its flex slot by 59px at
              768px) and the "zero visual change" hard rule only ever covered `>= lg`. At `lg`
              and above, `lg:flex-nowrap` restores the ORIGINAL non-wrapping mechanism
              byte-identically: wrapping the bar itself would let flex line-breaking (which
              compares max-content widths before any text wraps) push the whole pagination
              group onto its own row and left-align it, once the sentence's ~750px max-content
              width plus the pagination's ~350px exceeds the footer's width (around 1140px —
              inside ordinary 1280/1366px laptop widths). So at `lg`+, the pagination side's
              `min-w-0` is still what actually gives the sentence room to wrap to a second line
              while the bar itself stays one row and pagination stays right-aligned via the
              bar's own `justify-between`. Do NOT delete this comment or "restore" unconditional
              non-wrap below `lg` — that was the owner-ruled fix for the 768px overflow. */}
          <div className="flex min-w-0 items-center gap-4">
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
        </div>
      )}
    </div>
  );
}
