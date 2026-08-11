import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useAllAnalysesQuery, useAnalysesQuery } from "@/lib/api/analyses/hooks";
import type { AnalysesListResponse, AnalysisListItem } from "@/lib/api/analyses/types";

/**
 * B4 (PR #196 round-2 review) — before this fix, the OLD `/app/analyses` page
 * (`AnalysesContent.tsx`) called the zero-arg `useAnalysesQuery()`, which only
 * ever sees the server's default `ANALYSES_PAGE_SIZE` (50) rows. Once the
 * corpus exceeds 50 rows, an account whose rows all live past row 50 becomes
 * invisible to that page's client-side Account filter — a confident, wrong
 * "0 of N" empty state (the account is still offered in the dropdown, because
 * `accounts` is derived server-side from the whole corpus).
 *
 * This mock server behaves like the real `/api/analyses` route: it respects
 * `pageSize`/`page` and defaults to `ANALYSES_PAGE_SIZE` (50) when `pageSize`
 * is absent, exactly like `lib/server/db.ts`'s `getAnalysesList`. 55 rows are
 * seeded, sorted newest-first (the server's default), with `creator-50`
 * (0-indexed) the ONLY row past the 50-row default cutoff.
 */

const TOTAL_ROWS = 55;
const DEFAULT_PAGE_SIZE = 50;
const TARGET_INDEX = 50; // 0-indexed row that only exists past the default 50-row cap
const TARGET_ACCOUNT = `creator-${TARGET_INDEX}`;

function makeAnalysis(index: number): AnalysisListItem {
  // Newest first as index increases from 0 — mirrors the server's default
  // `sortBy: "posted", sortDir: "desc"` ordering.
  const postDate = new Date(Date.UTC(2026, 0, 1) - index * 86_400_000).toISOString();
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
    postDate,
    durationSec: null,
    caption: null,
    title: null,
    createdAt: postDate,
    performance: null,
  };
}

const ALL_ROWS: AnalysisListItem[] = Array.from({ length: TOTAL_ROWS }, (_, i) => makeAnalysis(i));
const ALL_ACCOUNTS = ALL_ROWS.map((row) => row.username);

function buildFetchMock() {
  return async (input: unknown): Promise<Response> => {
    const url = new URL(String(input), "http://localhost");
    const page = url.searchParams.has("page") ? Number(url.searchParams.get("page")) : 1;
    const pageSize = url.searchParams.has("pageSize")
      ? Number(url.searchParams.get("pageSize"))
      : DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;
    const analyses = ALL_ROWS.slice(offset, offset + pageSize);

    const body: AnalysesListResponse = {
      analyses,
      accounts: ALL_ACCOUNTS,
      pagination: {
        page,
        pageSize,
        total: TOTAL_ROWS,
        totalPages: Math.max(1, Math.ceil(TOTAL_ROWS / pageSize)),
      },
    };
    return new Response(JSON.stringify(body), { status: 200 });
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe("B4 — the OLD /app/analyses page's fetch-all bridge (useAllAnalysesQuery)", () => {
  it("useAnalysesQuery() (zero-arg, default page size) does NOT see an account past row 50 — the pre-fix bug", async () => {
    globalThis.fetch = buildFetchMock() as unknown as typeof fetch;

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAnalysesQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const usernames = result.current.data?.analyses.map((a) => a.username) ?? [];
    expect(usernames).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(usernames).not.toContain(TARGET_ACCOUNT);
  });

  it("useAllAnalysesQuery() fetches the full corpus, so an account past row 50 IS found", async () => {
    globalThis.fetch = buildFetchMock() as unknown as typeof fetch;

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAllAnalysesQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const usernames = result.current.data?.analyses.map((a) => a.username) ?? [];
    expect(usernames).toHaveLength(TOTAL_ROWS);
    expect(usernames).toContain(TARGET_ACCOUNT);
    expect(result.current.data?.pagination.total).toBe(TOTAL_ROWS);
  });
});
