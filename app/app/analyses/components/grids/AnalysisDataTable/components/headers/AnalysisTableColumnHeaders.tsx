import { AnalysisEngagementHeaderTooltip } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/tooltips/AnalysisEngagementHeaderTooltip";
import type { EngagementHeaderTooltipColumnId } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/tooltips/AnalysisEngagementHeaderTooltip";
import { cn } from "@/lib/utils";
import type { AnalysisTableColumnDef } from "@/app/app/analyses/components/grids/AnalysisDataTable/types";

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
};

/**
 * TDD §9.1 / DESIGN-3C §2.2, §10 — the two-row `<thead>`: a group-header row carrying the
 * shared `Scores` `<th colspan="2">`, then the per-column row. Both rows are `sticky top-0`
 * (design §8 — "the column headers are the only thing preventing a denominator misread;
 * they must never scroll away"). All 8 column headers are plain, non-interactive text —
 * sorting was removed by owner ruling (#266, 2026-08-20, DESIGN-3C amendment A10): no sort
 * button, no `aria-sort`, no direction arrow.
 *
 * Ticket #149 — `columns` is the caller's already visibility-filtered list (the Style column,
 * when toggled on, appends after column 9; the `Scores` group header still spans only its own
 * two columns regardless of what else is visible).
 */
export function AnalysisTableColumnHeaders({ columns }: AnalysisTableColumnHeadersProps) {
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
              className={cn(
                "border-b px-3 py-2 align-bottom text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                column.headerColorClassName,
              )}
            >
              {isEngagementTooltipColumnId(column.id) ? (
                // R-D6 — the tooltip trigger is a SIBLING of the column label inside the same
                // `<th>`, never nested inside it. `AnalysisEngagementHeaderTooltip` renders
                // its own independent `<button>`; it is not passed into or wrapped by
                // `ColumnHeaderLabel`.
                <div className="flex items-center gap-1">
                  <ColumnHeaderLabel column={column} />
                  <AnalysisEngagementHeaderTooltip columnId={column.id} />
                </div>
              ) : (
                <ColumnHeaderLabel column={column} />
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
            className={cn(
              "border-b px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
              column.headerColorClassName,
            )}
          >
            <ColumnHeaderLabel column={column} />
          </th>
        ))}
      </tr>
    </thead>
  );
}

function ColumnHeaderLabel({ column }: { column: AnalysisTableColumnDef }) {
  // Owner's ruling (#221 follow-up, PR #229 blocker 1), preserved by DESIGN-3C amendment A10 —
  // the engagement column-header colour (`headerColorClassName`, e.g. `text-accent` /
  // `text-teal`) is unconditional: with no sort button and no interactive states left on this
  // label, the colour class on the `<th>` (applied above) already covers idle, hover,
  // focus-visible and sticky-scrolled — there is nothing left to compete with it.
  return <span>{column.label}</span>;
}
