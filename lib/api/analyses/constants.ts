import type { AbsentCountReason } from "@/lib/api/analyses/types";

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
