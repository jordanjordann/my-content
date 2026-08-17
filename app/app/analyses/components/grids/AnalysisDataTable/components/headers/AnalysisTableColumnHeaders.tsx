import { ArrowDown, ArrowUp } from "lucide-react";

import { AnalysisEngagementHeaderTooltip } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/tooltips/AnalysisEngagementHeaderTooltip";
import type { EngagementHeaderTooltipColumnId } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/tooltips/AnalysisEngagementHeaderTooltip";
import { cn } from "@/lib/utils";
import type { AnalysisTableColumnDef } from "@/app/app/analyses/components/grids/AnalysisDataTable/types";
import type { AnalysesSortField, SortDirection } from "@/lib/api/analyses/types";

/**
 * DESIGN-3C §4.2 (amendment A6), R-D5/R-D12 — the ONLY two column headers that carry the
 * §4.2 explain tooltip. No other header may gain one via this list.
 */
const ENGAGEMENT_TOOLTIP_COLUMN_IDS: readonly EngagementHeaderTooltipColumnId[] = [
  "engagementReach",
  "engagementFollowers",
];

function isEngagementTooltipColumnId(id: string): id is EngagementHeaderTooltipColumnId {
  return (ENGAGEMENT_TOOLTIP_COLUMN_IDS as readonly string[]).includes(id);
}

type AnalysisTableColumnHeadersProps = {
  /** Ticket #149 — the resolved, visibility-filtered display column list (table order). */
  columns: AnalysisTableColumnDef[];
  sortBy: AnalysesSortField;
  sortDir: SortDirection;
  onSortChange: (field: AnalysesSortField) => void;
};

/**
 * TDD §9.1 / DESIGN-3C §2.2, §10 — the two-row `<thead>`: a group-header row carrying the
 * shared `Scores` `<th colspan="2">`, then the per-column row. Both rows are `sticky top-0`
 * (design §8 — "the column headers are the only thing preventing a denominator misread;
 * they must never scroll away"). Sort headers are real `<button>`s inside `<th>` with
 * `aria-sort` set only on the active header (design §9.7 / §10).
 *
 * Ticket #149 — `columns` is the caller's already visibility-filtered list (the Style column,
 * when toggled on, appends after column 9; the `Scores` group header still spans only its own
 * two columns regardless of what else is visible).
 */
export function AnalysisTableColumnHeaders({
  columns,
  sortBy,
  sortDir,
  onSortChange,
}: AnalysisTableColumnHeadersProps) {
  const ariaSortFor = (field: AnalysesSortField | undefined): "ascending" | "descending" | undefined => {
    if (!field || field !== sortBy) return undefined;
    return sortDir === "asc" ? "ascending" : "descending";
  };

  return (
    <thead className="sticky top-0 z-10 bg-card">
      <tr>
        {columns.map((column) => {
          if (column.group === "scores") {
            // Only render the group header once, on the first "scores" column.
            if (column.id !== "contentScore") return null;
            return (
              <th
                key="scores-group"
                colSpan={2}
                scope="colgroup"
                className="border-b px-3 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-primary"
              >
                Scores
              </th>
            );
          }

          return (
            <th
              key={column.id}
              data-column-id={column.id}
              rowSpan={2}
              scope="col"
              style={{ width: column.width, minWidth: column.width }}
              aria-sort={ariaSortFor(column.sortField)}
              className={cn(
                "border-b px-3 py-2 align-bottom text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                column.headerColorClassName,
              )}
            >
              {isEngagementTooltipColumnId(column.id) ? (
                // R-D6 — the tooltip trigger is a SIBLING of the sort button inside the same
                // `<th>`, never nested inside it. `AnalysisEngagementHeaderTooltip` renders
                // its own independent `<button>`; it is not passed into or wrapped by
                // `ColumnHeaderLabel`'s sort `<button>`.
                <div className="flex items-center gap-1">
                  <ColumnHeaderLabel
                    column={column}
                    active={column.sortField === sortBy}
                    sortDir={sortDir}
                    onSortChange={onSortChange}
                  />
                  <AnalysisEngagementHeaderTooltip columnId={column.id} />
                </div>
              ) : (
                <ColumnHeaderLabel
                  column={column}
                  active={column.sortField === sortBy}
                  sortDir={sortDir}
                  onSortChange={onSortChange}
                />
              )}
            </th>
          );
        })}
      </tr>
      <tr>
        {columns.filter((column) => column.group === "scores").map((column) => (
          <th
            key={column.id}
            data-column-id={column.id}
            scope="col"
            style={{ width: column.width, minWidth: column.width }}
            aria-sort={ariaSortFor(column.sortField)}
            className={cn(
              "border-b px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
              column.headerColorClassName,
            )}
          >
            <ColumnHeaderLabel
              column={column}
              active={column.sortField === sortBy}
              sortDir={sortDir}
              onSortChange={onSortChange}
            />
          </th>
        ))}
      </tr>
    </thead>
  );
}

function ColumnHeaderLabel({
  column,
  active,
  sortDir,
  onSortChange,
}: {
  column: AnalysisTableColumnDef;
  active: boolean;
  sortDir: SortDirection;
  onSortChange: (field: AnalysesSortField) => void;
}) {
  if (!column.sortField) {
    return <span>{column.label}</span>;
  }

  const directionWord = active ? (sortDir === "asc" ? "ascending" : "descending") : "";

  // Owner's ruling (#221 follow-up, PR #229 blocker 1) — the engagement column-header colour
  // (`headerColorClassName`, e.g. `text-accent` / `text-teal`) must be kept in ALL button states:
  // idle, hover, and active-sort. `hover:text-foreground` / `active && "text-foreground"` are the
  // button's own explicit `color`, which always wins over the colour it would otherwise inherit
  // from its `<th>` ancestor — so for a colour-carrying column, the foreground-swap classes are
  // dropped entirely and the button instead carries `headerColorClassName` directly as its own
  // class, unconditionally, so the colour never has to compete with anything. Every other
  // (non-colour-carrying) header is unaffected: it keeps `hover:text-foreground` and the
  // active-sort `text-foreground` swap exactly as before.
  const colorClassName = column.headerColorClassName;

  return (
    <button
      type="button"
      onClick={() => onSortChange(column.sortField as AnalysesSortField)}
      aria-label={`Sort by ${column.label}${directionWord ? `, currently ${directionWord}` : ""}`}
      className={cn(
        "inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        colorClassName ? colorClassName : cn("hover:text-foreground", active && "text-foreground"),
      )}
    >
      {column.label}
      {active &&
        (sortDir === "asc" ? (
          <ArrowUp className="size-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="size-3" aria-hidden="true" />
        ))}
    </button>
  );
}
