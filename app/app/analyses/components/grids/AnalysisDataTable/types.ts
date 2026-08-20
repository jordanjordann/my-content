import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";
import type { AnalysisFilters } from "@/app/app/analyses/types";

export type AnalysisTableDensity = "comfortable" | "compact";

export type AnalysisTableColumnDef = {
  id: string;
  label: string;
  width: number;
  /** Columns 5/6 share the `Scores` group header (`<th colspan="2">`, TDD §9.1). */
  group?: "scores";
  /**
   * Ticket #221 (M3, DESIGN-3C §4 distinguisher 3) — optional per-column header text colour,
   * applied to columns 8/9 (`text-accent` / `text-teal`) so the reach- vs follower-denominated
   * engagement headers carry the same colour-coding as their cells (ticket #217). Absent on
   * every other column — colour stays a redundant third channel, never the only one (§9.5).
   */
  headerColorClassName?: string;
};

export type AnalysisDataTableProps = {
  /** Row click / `Enter` — opens the existing detail modal (design §8). */
  onAnalysisClick: (id: string) => void;
  /** Empty-nothing-analysed state's primary action (design §7). */
  onNewAnalysis: () => void;
  /**
   * The id of the analysis currently open in the detail modal, if any — undefined/`null`
   * when closed. Used only to return focus to the row that opened it once this
   * transitions back to `null` (design §8, "Escape closes and returns focus to the row").
   * Filters are #149's scope; this is the one piece of external state this ticket's
   * skeleton needs from the parent to satisfy the focus-return requirement.
   */
  openAnalysisId?: string | null;
  /** "Clear all filters" action for the empty-no-match state. */
  onClearFilters?: () => void;
  /**
   * Ticket #149 — the active filter set (Creator/Platform/Content kind/Tier/Status/keyword),
   * applied client-side against the full fetched corpus (see `AnalysisDataTable`'s own doc
   * comment for why). Defaults to "no filters" so this table still renders standalone in tests
   * that don't exercise filtering.
   */
  filters?: AnalysisFilters;
};

/** Internal grouping of one loaded page's rows (design §3.3, §6.1 — R-S1/R-S2). */
export type AnalysisTableRowGroups = {
  /** Completed rows with a performance score. */
  scored: AnalysisListItemIndexed[];
  /** Completed rows with NO performance score (R-S2 sink group). */
  scoreless: AnalysisListItemIndexed[];
  /** Non-completed rows (`failed`/`pending`) — excluded from every sort (OR-4). */
  nonCompleted: AnalysisListItemIndexed[];
};
