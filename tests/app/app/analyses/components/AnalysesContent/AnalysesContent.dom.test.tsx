import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalysesListResponse, AnalysisListItem, AnalyzeResponse } from "@/lib/api/analyses/types";

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

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
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
  toastError.mockClear();
  toastSuccess.mockClear();
});

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>;
}

/** Adds one valid Instagram Reel URL chip via the modal's URL input and submits. */
async function submitOneUrl() {
  fireEvent.click(screen.getByRole("button", { name: "New Analysis" }));
  const input = await screen.findByPlaceholderText(/paste.*url/i);
  fireEvent.change(input, { target: { value: "https://www.instagram.com/reel/abc123" } });
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
}

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

/**
 * Ticket #320 (TDD §4.3) — `handleAnalyze`'s `onSuccess` consumes the REAL `AnalyzeOutcome`
 * produced by `useAnalyzeContentMutation` (T2, #319) end to end: modal submit -> mocked
 * `/api/analyze` response -> progress panel renders per-URL reasons -> toast description
 * carries the same summary. Nothing under test is mocked beyond `fetch` and `sonner`.
 */
describe("AnalysesContent — per-URL failure reasons (#320)", () => {
  function mockFetchWithAnalyzeResponse(analyzeResponse: AnalyzeResponse) {
    const listBody: AnalysesListResponse = {
      analyses: [],
      accounts: [],
      pagination: { page: 1, pageSize: 5000, total: 0, totalPages: 0 },
    };
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/analyze") && init?.method === "POST") {
        return new Response(JSON.stringify(analyzeResponse), { status: 200 });
      }
      return new Response(JSON.stringify(listBody), { status: 200 });
    }) as unknown as typeof fetch;
  }

  it("all-failed outcome: panel shows the URL and the server's reason, toast carries the reason verbatim", async () => {
    mockFetchWithAnalyzeResponse({
      analysisIds: [],
      analysesCreated: 0,
      failedUrls: [
        {
          url: "https://www.instagram.com/reel/abc123",
          index: 0,
          error: "Content not found — it may be deleted or the URL is wrong.",
        },
      ],
    });

    render(<AnalysesContent />, { wrapper: Wrapper });

    await submitOneUrl();

    await screen.findByText("No analyses were created");
    expect(screen.getByText("www.instagram.com/reel/abc123")).toBeInTheDocument();
    expect(
      screen.getByText("Content not found — it may be deleted or the URL is wrong."),
    ).toBeInTheDocument();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith(
      "Analysis failed",
      expect.objectContaining({
        description: "Content not found — it may be deleted or the URL is wrong.",
      }),
    );
  });

  it("happy path (0 failures): panel renders exactly as before, no failure list", async () => {
    mockFetchWithAnalyzeResponse({
      analysisIds: ["id-1"],
      analysesCreated: 1,
      failedUrls: [],
    });

    render(<AnalysesContent />, { wrapper: Wrapper });

    await submitOneUrl();

    await screen.findByText("Analysis complete — 1 analyses created");
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
