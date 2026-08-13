import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalysesListResponse, AnalysisListItem } from "@/lib/api/analyses/types";

/**
 * PR #203 review, blocker 1 — `AnalysesContent` (the real `/app/analyses` page shell) renders
 * both the filter bar (needs the full corpus for its counts) and `AnalysisDataTable` (needs the
 * full corpus for its own rows). Before this fix those were two independent `useAnalysesQuery`
 * calls with different query keys, so the real page fired TWO 5000-row fetches on every load.
 * This mounts the REAL component tree (not a stand-in) and counts the actual `fetch` calls.
 *
 * `next/navigation` is mocked minimally (no shared test harness exists yet for it in this repo)
 * — a static pathname/searchParams and no-op router, sufficient for this page's own reads
 * (`usePathname`/`useSearchParams`/`useRouter`) without exercising real Next.js routing.
 */
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/analyses",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const { AnalysesContent } = await import("@/app/app/analyses/components/AnalysesContent");

function makeAnalysis(index: number): AnalysisListItem {
  return {
    id: `analysis-${index}`,
    prompt: null,
    status: "completed",
    url: "https://instagram.com/reel/x",
    platform: "instagram",
    mediaType: "reel",
    username: `creator-${index}`,
    overallScore: null,
    scorecard: null,
    schemaVersion: 3,
    thumbnailUrl: null,
    viewCount: null,
    playCount: null,
    likeCount: null,
    likeAndViewCountsDisabled: null,
    postDate: "2026-07-01T00:00:00.000Z",
    durationSec: null,
    caption: null,
    title: `Row ${index}`,
    createdAt: "2026-07-01T00:00:00.000Z",
    performance: null,
    style: null,
  };
}

const ALL_ROWS: AnalysisListItem[] = Array.from({ length: 5 }, (_, i) => makeAnalysis(i));

function buildFetchMock() {
  return async (): Promise<Response> => {
    const body: AnalysesListResponse = {
      analyses: ALL_ROWS,
      accounts: [...new Set(ALL_ROWS.map((r) => r.username))],
      pagination: { page: 1, pageSize: 5000, total: ALL_ROWS.length, totalPages: 1 },
    };
    return new Response(JSON.stringify(body), { status: 200 });
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AnalysesContent — full-corpus fetch is not doubled (PR #203 review, blocker 1)", () => {
  it("mounting the real page fires exactly ONE full-corpus network request, not two", async () => {
    let fetchCallCount = 0;
    const baseFetch = buildFetchMock();
    globalThis.fetch = (async () => {
      fetchCallCount += 1;
      return baseFetch();
    }) as unknown as typeof fetch;

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    render(<AnalysesContent />, { wrapper: Wrapper });

    await screen.findByText("Row 0");

    expect(fetchCallCount).toBe(1);
  });
});
