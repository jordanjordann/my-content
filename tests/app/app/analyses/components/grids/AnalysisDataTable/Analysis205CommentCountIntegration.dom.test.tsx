import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AnalysisDataTable } from "@/app/app/analyses/components/grids/AnalysisDataTable";
import type { AnalysesListResponse, AnalysisListItem, AnalysisPerformance } from "@/lib/api/analyses/types";

/**
 * Ticket #205, PR #210 review blocker B1 — the wiring seam this PR exists to add
 * (`AnalysisTableRow` passing `row.tableDerived.commentCountState`, not `row.likeCountState`,
 * into the Counts cell) had no test that could fail if that seam were wired wrong. A reviewer
 * mutation (`commentCountState={row.likeCountState}`) type-checked (both are `CountState`) and
 * left the full suite green — every row would silently print the like count twice.
 *
 * This is a full-table DOM integration test (`AnalysisDataTable` down through
 * `AnalysisTableRow` → `AnalysisCountsCell`), not a unit test of `AnalysisCountsCell` in
 * isolation — a unit test passed an explicit `commentCountState` prop can never catch a bug in
 * how the row wires that prop from `row.tableDerived`. Fixtures reproduce the REAL
 * `AnalysisListItem`/`AnalysisPerformance` shape (`lib/api/analyses/types.ts`), matching the
 * precedent set by `Analysis147ScoreCellIntegration.dom.test.tsx`.
 *
 * The like and comment counts below are deliberately DIFFERENT, non-abbreviation-colliding
 * values so the two figures can never be confused for each other by accident.
 */

function baseRow(overrides: Partial<AnalysisListItem>): AnalysisListItem {
  return {
    id: "analysis-default",
    prompt: null,
    status: "completed",
    url: "https://instagram.com/reel/x",
    platform: "instagram",
    mediaType: "reel",
    username: "dapurbunda",
    overallScore: 4,
    scorecard: null,
    schemaVersion: 3,
    thumbnailUrl: null,
    viewCount: 482_100,
    playCount: null,
    likeCount: 31_412,
    likeAndViewCountsDisabled: null,
    postDate: "2026-07-12T00:00:00.000Z",
    durationSec: 30,
    caption: "Resep sederhana, hasil istimewa",
    title: "Untitled default row",
    createdAt: "2026-07-12T00:00:00.000Z",
    performance: null,
    style: null,
    ...overrides,
  };
}

const PERFORMANCE_DISTINCT_LIKE_AND_COMMENT: AnalysisPerformance = {
  computed: {
    reach: { value: 482_100, kind: "VIEWS", derivedFrom: "TOP_LEVEL", state: "AVAILABLE" },
    likes: { value: 31_412, state: "AVAILABLE" },
    comments: { value: 1_204, state: "AVAILABLE" },
    audience: { value: 10_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
    postAgeHours: 240,
    tier1: { denominator: "REACH", ratio: 0.068, reachKind: "VIEWS" },
    tier2: { median: 151_000, sampleSize: 8, bucketKey: "instagram:reel:full_video", multiplier: 3.2, minSample: 5 },
    tier3: null,
    tierUsed: "CREATOR_BASELINE",
    confidence: "HIGH",
    confidenceReason: null,
    provisional: false,
    unavailableReason: null,
  },
  judgement: { performanceScore: 4, verdict: "Strong hook.", drivers: ["Hook kuat sejak detik pertama."] },
};

const ROW_DISTINCT_COUNTS = baseRow({
  id: "row-distinct-counts",
  title: "Nasi Goreng Kampung",
  likeCount: 31_412,
  performance: PERFORMANCE_DISTINCT_LIKE_AND_COMMENT,
});

/** Row whose comment count is genuinely unknown while its like count is a real number. */
const ROW_UNKNOWN_COMMENTS = baseRow({
  id: "row-unknown-comments",
  title: "Partial data post",
  likeCount: 31_412,
  performance: {
    ...PERFORMANCE_DISTINCT_LIKE_AND_COMMENT,
    computed: {
      ...PERFORMANCE_DISTINCT_LIKE_AND_COMMENT.computed,
      comments: { value: null, state: "UNKNOWN" },
    },
  },
});

function buildFetchMock(rows: AnalysisListItem[]) {
  return async (): Promise<Response> => {
    const body: AnalysesListResponse = {
      analyses: rows,
      accounts: [...new Set(rows.map((r) => r.username))],
      pagination: { page: 1, pageSize: 50, total: rows.length, totalPages: 1 },
    };
    return new Response(JSON.stringify(body), { status: 200 });
  };
}

function renderTable(rows: AnalysisListItem[]) {
  globalThis.fetch = buildFetchMock(rows) as unknown as typeof fetch;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  render(
    <AnalysisDataTable onAnalysisClick={vi.fn()} onNewAnalysis={vi.fn()} onClearFilters={vi.fn()} />,
    { wrapper: Wrapper },
  );
}

describe("Ticket #205 / PR #210 blocker B1 — the Counts cell's comment figure is wired from row.tableDerived.commentCountState, not row.likeCountState", () => {
  it("renders the real, distinct comment count on the likes line — not the like count duplicated", async () => {
    renderTable([ROW_DISTINCT_COUNTS]);
    const row = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;

    // Col 4 (0-indexed: content, creator, posted, counts).
    const countsCell = row.querySelectorAll("td")[3] as HTMLElement;

    // The real comment figure (1_204 -> "1.2K") must be present...
    expect(within(countsCell).getByText("1.2K")).toBeInTheDocument();
    // ...and the like figure (31_412 -> "31.4K") must appear exactly once in the cell — if
    // `commentCountState` were wired from `row.likeCountState` instead, "31.4K" would render
    // twice (once for likes, once for the mis-wired "comments").
    expect(within(countsCell).getAllByText("31.4K")).toHaveLength(1);
    expect(countsCell.textContent).toContain("31.4K · 1.2K");
  });

  it("a row with a real like count but an unknown comment count does NOT borrow the like figure for comments", async () => {
    renderTable([ROW_UNKNOWN_COMMENTS]);
    const row = (await screen.findByText("Partial data post")).closest("tr") as HTMLElement;
    const countsCell = row.querySelectorAll("td")[3] as HTMLElement;

    // The like figure renders exactly once...
    expect(within(countsCell).getAllByText("31.4K")).toHaveLength(1);
    // ...and the comment figure is the accessible "comments unknown" dash, never a second
    // "31.4K" — which is exactly what `commentCountState={row.likeCountState}` would produce.
    expect(within(countsCell).getByRole("img", { name: "comments unknown" })).toBeInTheDocument();
  });
});
