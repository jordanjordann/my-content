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
  { id: "creator", label: "Creator", width: 140 },
  { id: "posted", label: "Posted", width: 108 },
  { id: "counts", label: "Counts", width: 132 },
  {
    id: "contentScore",
    label: "Content",
    width: 84,
    group: "scores",
  },
  {
    id: "performance",
    label: "Performance",
    width: 156,
    group: "scores",
  },
  {
    id: "multiplier",
    label: "vs their usual",
    width: 128,
  },
  {
    id: "engagementReach",
    label: "Eng. / reach",
    width: 116,
    headerColorClassName: "text-accent",
  },
  {
    id: "engagementFollowers",
    label: "Eng. / followers",
    width: 124,
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
 * Ticket #335 (TDD §6.2, design §8) — the `content` column's fixed width below `lg` (design's
 * 180-220px band; 200px chosen). At `lg` and above the column reverts to its existing 300px
 * (`ANALYSES_TABLE_COLUMNS[0].width`) via the `lg:` variant baked into the class strings below,
 * not this constant — this constant only feeds the inline `style` below `lg`.
 */
export const STICKY_CONTENT_COLUMN_WIDTH_PX = 200;

/**
 * Ticket #335 (TDD §6.2) — sticky-left treatment for the `content` column only, gated off at
 * `lg` (owner's hard rule: zero visual change at >=1024px, C-3). Applied to BOTH the header
 * `<th>` (`AnalysisTableColumnHeaders.tsx`) and the body `<td>` (`AnalysisTableRow.tsx`),
 * identified by `column.id === "content"` — never by array index (the visible column list is
 * caller-filtered, ticket #149).
 *
 * Explicit stacking contract (`<thead>` is already `sticky top-0 z-10`, so the header's content
 * cell must win on both axes): header-content `z-30` > body-content `z-20` > `thead` `z-10` >
 * plain cells `0`. Kept as named constants so tests can assert the contract as literal, coupled
 * numbers rather than a relational "header > body" check that both sides could drift together
 * and still pass.
 */
export const STICKY_CONTENT_HEADER_CELL_CLASSNAME =
  "sticky left-0 z-30 bg-card shadow-[2px_0_4px_-2px_rgba(0,0,0,0.5)] lg:static lg:z-auto lg:bg-transparent lg:shadow-none";
export const STICKY_CONTENT_BODY_CELL_CLASSNAME =
  "sticky left-0 z-20 bg-card shadow-[2px_0_4px_-2px_rgba(0,0,0,0.5)] lg:static lg:z-auto lg:bg-transparent lg:shadow-none";

/**
 * Ticket #335 — the `content` column's inline `style.width`/`minWidth` is a literal
 * `STICKY_CONTENT_COLUMN_WIDTH_PX` (200) so it's viewport-independent and test-assertable
 * (jsdom has no media queries). The visual revert to the column's real 300px width at `lg`
 * therefore has to happen in a stylesheet rule that out-ranks that inline style, which only an
 * `!important` declaration can do (Tailwind v4's trailing-bang important modifier). This class
 * string is a literal, not a template built from `ANALYSES_TABLE_COLUMNS[0].width`, because
 * Tailwind's build-time class scanner only recognizes literal class text in source files — kept
 * here, next to the 300px source of truth, so both stay visible in one review diff if either
 * changes.
 */
export const STICKY_CONTENT_LG_WIDTH_RESET_CLASSNAME = "lg:w-[300px]! lg:min-w-[300px]!";
