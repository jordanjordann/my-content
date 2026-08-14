import type { AnalysesSortField } from "@/lib/api/analyses/types";
import type { AnalysisTableColumnDef } from "@/app/app/analyses/components/grids/AnalysisDataTable/types";

/**
 * Ticket #145 — TDD §9.1 / DESIGN-3C §2.2, the shipping 9-column set (OR-1). Order is
 * load-bearing: identification (1-3) -> raw evidence (4) -> judgement (5-6) -> the
 * quotable comparison (7) -> the two ratios (8-9), engagement ratios deliberately last
 * so reading order does not bury Tier 2 under a weaker follower-denominated figure
 * (§12.4). Columns 5 and 6 carry `group: "scores"` so the header renders the shared
 * `<th colspan="2">` (D7 "two axes, never merged", said in layout).
 *
 * There is NO Status column (OR-4) and no Style column here — Style ships default-off
 * from ticket #149 (column menu), out of this ticket's scope.
 */
export const ANALYSES_TABLE_COLUMNS: AnalysisTableColumnDef[] = [
  { id: "content", label: "Content", width: 300 },
  { id: "creator", label: "Creator", width: 140, sortField: "creator", defaultSortDir: "asc" },
  { id: "posted", label: "Posted", width: 108, sortField: "posted", defaultSortDir: "desc" },
  { id: "counts", label: "Counts", width: 132, sortField: "reach", defaultSortDir: "desc" },
  {
    id: "contentScore",
    label: "Content",
    width: 84,
    sortField: "contentScore",
    defaultSortDir: "desc",
    group: "scores",
  },
  {
    id: "performance",
    label: "Performance",
    width: 156,
    sortField: "performanceScore",
    defaultSortDir: "desc",
    group: "scores",
  },
  {
    id: "multiplier",
    label: "vs their usual",
    width: 128,
    sortField: "multiplier",
    defaultSortDir: "desc",
  },
  {
    id: "engagementReach",
    label: "Eng. / reach",
    width: 116,
    sortField: "engagementReach",
    defaultSortDir: "desc",
    headerColorClassName: "text-accent",
  },
  {
    id: "engagementFollowers",
    label: "Eng. / followers",
    width: 124,
    sortField: "engagementFollowers",
    defaultSortDir: "desc",
    headerColorClassName: "text-teal",
  },
];

/**
 * Ticket #149 / DESIGN-3C §2.2 — the optional tenth column, `formatArchetype` + `hookType`.
 * OFF by default (Q3, ruled 2026-08-09) and reachable only from `AnalysisColumnsMenu` — kept
 * separate from `ANALYSES_TABLE_COLUMNS` (the nine DEFAULT columns, §2.2's "nine, and only
 * these nine") rather than folded in with an `optional` flag, so the default column set stays
 * exactly what §2.2 states without a filter step at every call site.
 */
export const STYLE_COLUMN: AnalysisTableColumnDef = { id: "style", label: "Style", width: 150 };

/**
 * DESIGN-3C §6.3 — the four columns the `Columns` menu cannot hide (R-12.3.1: hiding a
 * denominator-bearing column is how a user, not a developer, violates it).
 */
export const LOCKED_COLUMN_IDS: ReadonlySet<string> = new Set([
  "content",
  "performance",
  "engagementReach",
  "engagementFollowers",
]);

/** Every column ID visible on first load — every default column, Style excluded (OR-5). */
export const DEFAULT_VISIBLE_COLUMN_IDS: ReadonlySet<string> = new Set(
  ANALYSES_TABLE_COLUMNS.map((c) => c.id),
);

/** DESIGN-3C §3 — two legal row densities. Comfortable is the owner-ruled default (OR-7). */
export const ROW_HEIGHT_PX: Record<"comfortable" | "compact", number> = {
  comfortable: 68,
  compact: 40,
};

/** OR-8 — 50 rows/page, server-side (ticket #144). */
export const ANALYSES_TABLE_PAGE_SIZE = 50;

/** DESIGN-3C §7 — 8 skeleton rows in the exact column grid while the first page loads. */
export const SKELETON_ROW_COUNT = 8;

/**
 * TDD §9.6 / DESIGN-3C §6.1 default sort — `Posted` descending, newest analysis first.
 * Performance is user-selectable and is never the default (OR-8).
 */
export const DEFAULT_SORT_FIELD: AnalysesSortField = "posted";
export const DEFAULT_SORT_DIR = "desc" as const;

/**
 * DESIGN-3B §5.3 / R-C2 — the Tier 2 baseline minimum, mirrored client-side as a named
 * constant (never a bare literal in copy) because the API response does not carry the
 * threshold itself (only `sampleSize`/`median`/`multiplier`). This MUST stay in sync
 * with `lib/server/analysis/performance/constants.ts`'s `BASELINE_MIN_SAMPLE` (default
 * 5, env-overridable via `PERFORMANCE_BASELINE_MIN_SAMPLE`) — flagged in ticket #145's
 * PR body as a follow-up: if that env var is ever set, this constant silently drifts.
 * Ideally the response would carry the threshold per bucket; out of this ticket's scope.
 */
export const BASELINE_MIN_SAMPLE_DISPLAY = 5;
