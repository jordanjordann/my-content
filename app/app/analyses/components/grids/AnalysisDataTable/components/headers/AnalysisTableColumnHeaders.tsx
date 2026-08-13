import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AnalysisTableColumnDef } from "@/app/app/analyses/components/grids/AnalysisDataTable/types";
import type { AnalysesSortField, SortDirection } from "@/lib/api/analyses/types";

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
                className="border-b px-3 py-1 text-center text-xs font-semibold text-muted-foreground"
              >
                Scores
              </th>
            );
          }

          return (
            <th
              key={column.id}
              rowSpan={2}
              scope="col"
              style={{ width: column.width, minWidth: column.width }}
              aria-sort={ariaSortFor(column.sortField)}
              className="border-b px-3 py-2 align-bottom text-left text-xs font-medium text-muted-foreground"
            >
              <ColumnHeaderLabel
                column={column}
                active={column.sortField === sortBy}
                sortDir={sortDir}
                onSortChange={onSortChange}
              />
            </th>
          );
        })}
      </tr>
      <tr>
        {columns.filter((column) => column.group === "scores").map((column) => (
          <th
            key={column.id}
            scope="col"
            style={{ width: column.width, minWidth: column.width }}
            aria-sort={ariaSortFor(column.sortField)}
            className="border-b px-3 py-1 text-left text-xs font-medium text-muted-foreground"
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

  return (
    <button
      type="button"
      onClick={() => onSortChange(column.sortField as AnalysesSortField)}
      aria-label={`Sort by ${column.label}${directionWord ? `, currently ${directionWord}` : ""}`}
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "text-foreground",
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
