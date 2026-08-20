import type { AbsentCountReason } from "@/lib/api/analyses/types";

/**
 * Ticket #251 / DESIGN-3C §5.3 — the `vs their usual` cell's `not-comparable` copy
 * (`deriveMultiplierCell`, `lib/api/analyses/helpers.ts`). Statement only, never a
 * button or retry (OR-25, settled). Kept here, not inlined, so a copy pass after
 * Jessica's design review is a one-line change, not a re-implementation.
 *
 * - `POST_METRIC_UNRESOLVED` — a full baseline exists for this creator/bucket, but this
 *   post's own reach/engagement count for the bucket's denominator never resolved.
 * - `MEDIAN_ZERO` — this post's own metric DID resolve, but every earlier comparator in
 *   the bucket measured exactly zero, so there is nothing to divide against.
 */
export const NOT_COMPARABLE_MULTIPLIER_CELL_COPY: Record<
  "POST_METRIC_UNRESOLVED" | "MEDIAN_ZERO",
  string
> = {
  POST_METRIC_UNRESOLVED: "this creator's usual is set — this post's own count wasn't published",
  MEDIAN_ZERO: "every earlier post measured zero",
};

export const ANALYSIS_KEYS = {
  all: ["analyses"] as const,
  lists: () => [...ANALYSIS_KEYS.all, "list"] as const,
  detail: (id: string) => [...ANALYSIS_KEYS.all, "detail", id] as const,
};

/**
 * B4 (PR #196 review) — the `pageSize` value `useAllAnalysesQuery` requests
 * so the OLD `/app/analyses` page's client-side filters see the full
 * corpus in one response instead of one `ANALYSES_PAGE_SIZE`-row page.
 * Mirrors the server's `ANALYSES_MAX_PAGE_SIZE` cap (`lib/server/db.ts`) —
 * the route clamps/validates against that cap independently, so this is
 * just the client's request value, not a source of truth. Bridge only:
 * once #145 replaces the old page with server-side filtering, this
 * constant (and `useAllAnalysesQuery`) goes away.
 *
 * PR #203 review, blocker 1 — ticket #149 ALSO reaches for this constant for the NEW 3C
 * table (`AnalysisDataTable`), for the same reason: the #144 API has no filter query params,
 * so a correct filtered count/page can only be computed client-side over the full corpus. This
 * is a second, equally interim stopgap — "the old page already uses it" is not license to reach
 * for it elsewhere. `AnalysesContent` (the old page's shell) and `AnalysisDataTable` now
 * deliberately build the SAME `{ pageSize }` params object so TanStack Query's
 * key hashing dedupes the two `useAnalysesQuery` calls into one network request instead of two
 * independent 5000-row fetches — if you add a third call site, route it through the same shared
 * params or it will silently double the fetch again. This constant, `useAllAnalysesQuery`, and
 * `AnalysisDataTable`'s own full-corpus fetch should all be retired together once the API gains
 * real server-side filter params (deserves its own follow-up ticket, not created here).
 */
export const ANALYSES_FETCH_ALL_PAGE_SIZE = 5000;

/**
 * Ticket #146 / OR-11 (TDD §9.5) — the three-case absent-count reason's copy, verbatim from
 * the TDD's own table. Case 3 (`NOT_AVAILABLE`) is the mandatory default for anything that
 * isn't a verified creator setting or a structurally-image-only post; do not paraphrase or
 * add a fourth case without a design ruling (R-13.5.2).
 */
export const ABSENT_COUNT_REASON_COPY: Record<AbsentCountReason, string> = {
  CREATOR_DISABLED: "Creator turned off counts",
  TYPE_NOT_REPORTED: "This post type doesn't report counts",
  NOT_AVAILABLE: "Counts weren't available",
};
