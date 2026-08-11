import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnalysisDataTable } from "@/app/app/analyses/components/grids/AnalysisDataTable";
import type { AnalysesListResponse, AnalysisListItem } from "@/lib/api/analyses/types";

/**
 * Ticket #145 — the analyses table shell. Fixtures reproduce the REAL `AnalysisListItem` /
 * `AnalysisPerformance` shape shipped by #144 (`lib/api/analyses/types.ts`), not a
 * convenient approximation — every field the table's cells branch on is present.
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
    likeCount: 1_200,
    likeAndViewCountsDisabled: null,
    postDate: "2026-07-12T00:00:00.000Z",
    durationSec: 30,
    caption: "Resep sederhana, hasil istimewa",
    title: "Untitled default row",
    createdAt: "2026-07-12T00:00:00.000Z",
    performance: null,
    ...overrides,
  };
}

/** Row A — scored, Tier 2 measured, reach-denominated, provisional (Early badge). */
const ROW_A_SCORED = baseRow({
  id: "row-a-scored",
  title: "Nasi Goreng Kampung",
  performance: {
    computed: {
      reach: { value: 482_100, kind: "VIEWS", derivedFrom: "TOP_LEVEL", state: "AVAILABLE" },
      likes: { value: 1_200, state: "AVAILABLE" },
      comments: { value: 40, state: "AVAILABLE" },
      audience: { value: 10_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 10,
      tier1: { denominator: "REACH", ratio: 0.041, reachKind: "VIEWS" },
      tier2: { median: 1.0, sampleSize: 8, bucketKey: "instagram:reel:full_video", multiplier: 3.2 },
      tier3: null,
      tierUsed: "CREATOR_BASELINE",
      confidence: "HIGH",
      confidenceReason: null,
      provisional: true,
      unavailableReason: null,
    },
    judgement: { performanceScore: 4, verdict: "Strong hook.", drivers: [] },
  },
});

/** Row B — scored, Tier 2 cold start (§5.3): "2 of 5 carousels" / "builds as you analyse more". */
const ROW_B_COLD_START = baseRow({
  id: "row-b-cold-start",
  mediaType: "carousel",
  title: "10 Ide Konten Ramadan",
  performance: {
    computed: {
      reach: { value: null, kind: null, derivedFrom: "NONE", state: "UNKNOWN" },
      likes: { value: 900, state: "AVAILABLE" },
      comments: { value: 12, state: "AVAILABLE" },
      audience: { value: 284_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 200,
      tier1: { denominator: "FOLLOWERS", ratio: 0.162 },
      tier2: { median: null, sampleSize: 2, bucketKey: "instagram:carousel:full_video", multiplier: null },
      tier3: null,
      tierUsed: "AUDIENCE_FALLBACK",
      confidence: "MEDIUM",
      confidenceReason: "CACHED_FOLLOWER_DENOMINATOR",
      provisional: false,
      unavailableReason: null,
    },
    judgement: { performanceScore: 3, verdict: "Rough read.", drivers: [] },
  },
});

/** Row C — completed, NO performance score at all (row 3, `CAUSE_NOT_DETERMINABLE`) — sinks. */
const ROW_C_SCORELESS = baseRow({
  id: "row-c-scoreless",
  title: "Quiet post",
  performance: {
    computed: {
      reach: { value: null, kind: null, derivedFrom: "NONE", state: "UNKNOWN" },
      likes: { value: null, state: "UNKNOWN" },
      comments: { value: null, state: "UNKNOWN" },
      audience: { value: null, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 500,
      tier1: null,
      tier2: null,
      tier3: null,
      tierUsed: "UNAVAILABLE",
      confidence: "NONE",
      confidenceReason: null,
      provisional: false,
      unavailableReason: "CAUSE_NOT_DETERMINABLE",
    },
    judgement: { performanceScore: null, verdict: null, drivers: [] },
  },
});

/** Row D — failed, no performance block at all. */
const ROW_D_FAILED = baseRow({
  id: "row-d-failed",
  status: "failed",
  title: "Broken upload",
  performance: null,
});

const ALL_ROWS = [ROW_A_SCORED, ROW_B_COLD_START, ROW_C_SCORELESS, ROW_D_FAILED];

function buildFetchMock(rows: AnalysisListItem[], capturedUrls: string[]) {
  return async (input: unknown): Promise<Response> => {
    const url = String(input);
    capturedUrls.push(url);
    const body: AnalysesListResponse = {
      analyses: rows,
      accounts: [...new Set(rows.map((r) => r.username))],
      pagination: { page: 1, pageSize: 50, total: rows.length, totalPages: 1 },
    };
    return new Response(JSON.stringify(body), { status: 200 });
  };
}

function renderTable(rows: AnalysisListItem[] = ALL_ROWS, props: Partial<React.ComponentProps<typeof AnalysisDataTable>> = {}) {
  const capturedUrls: string[] = [];
  globalThis.fetch = buildFetchMock(rows, capturedUrls) as unknown as typeof fetch;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  const onAnalysisClick = vi.fn();
  const onNewAnalysis = vi.fn();
  const onClearFilters = vi.fn();

  const utils = render(
    <AnalysisDataTable
      onAnalysisClick={onAnalysisClick}
      onNewAnalysis={onNewAnalysis}
      onClearFilters={onClearFilters}
      {...props}
    />,
    { wrapper: Wrapper },
  );

  return { ...utils, capturedUrls, onAnalysisClick, onNewAnalysis, onClearFilters };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AnalysisDataTable — default render (OR-1, OR-7, OR-8)", () => {
  it("renders exactly 9 column headers, no Style column, and requests the server default page size", async () => {
    const { capturedUrls } = renderTable();

    await screen.findAllByRole("columnheader");
    // 9 leaf column headers (`scope="col"`) plus the one `scope="colgroup"` Scores group
    // header (also exposed as `columnheader` by the accessibility tree) = 10 total.
    const leafHeaders = document.querySelectorAll('th[scope="col"]');
    expect(leafHeaders).toHaveLength(9);
    expect(screen.queryByRole("columnheader", { name: /style/i })).not.toBeInTheDocument();

    // OR-8: no explicit `pageSize` override — relies on the server's default (50).
    expect(capturedUrls.some((u) => u.includes("/api/analyses"))).toBe(true);
    expect(capturedUrls.every((u) => !u.includes("pageSize"))).toBe(true);
  });

  it("renders the shared Scores group header spanning columns 5-6, with Content/Performance sub-labels", async () => {
    renderTable();
    const groupHeader = await screen.findByRole("columnheader", { name: "Scores" });
    expect(groupHeader).toHaveAttribute("colspan", "2");
    // Two headers are named "Content" (col 1's leaf header AND the Scores group's
    // "Content" sub-label) — assert the sub-header row itself carries both sub-labels.
    const subHeaderRow = groupHeader.closest("tr")?.nextElementSibling as HTMLElement;
    expect(within(subHeaderRow).getByRole("columnheader", { name: /^content$/i })).toBeInTheDocument();
    expect(within(subHeaderRow).getByRole("columnheader", { name: /^performance/i })).toBeInTheDocument();
  });

  it("defaults sort to Posted descending — aria-sort correct on the active header, absent elsewhere", async () => {
    renderTable();
    const postedHeader = await screen.findByRole("columnheader", { name: /posted/i });
    expect(postedHeader).toHaveAttribute("aria-sort", "descending");

    const creatorHeader = screen.getByRole("columnheader", { name: /creator/i });
    expect(creatorHeader).not.toHaveAttribute("aria-sort");
  });

  it("moving the sort to another column moves aria-sort with it", async () => {
    renderTable();
    await screen.findByRole("columnheader", { name: /posted/i });

    fireEvent.click(screen.getByRole("button", { name: /sort by creator/i }));

    const creatorHeader = screen.getByRole("columnheader", { name: /creator/i });
    expect(creatorHeader).toHaveAttribute("aria-sort", "ascending");
    const postedHeader = screen.getByRole("columnheader", { name: /posted/i });
    expect(postedHeader).not.toHaveAttribute("aria-sort");
  });
});

describe("AnalysisDataTable — compact density (design §3.2 hard rule)", () => {
  it("still renders every denominator, tier phrase, sample size, Early badge and absent-score reason", async () => {
    renderTable();
    await screen.findAllByRole("columnheader");

    fireEvent.click(screen.getByRole("button", { name: /compact/i }));

    // Denominator qualifier (Eng. / reach, row A).
    expect(await screen.findByText("of 482.1K views")).toBeInTheDocument();
    // Tier phrase (Performance cell, row A) — scoped to the row, since the "vs their
    // usual" column header button carries the same text.
    const rowA = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;
    expect(within(rowA).getByText("vs their usual")).toBeInTheDocument();
    // Sample size (vs their usual cell, row A).
    expect(screen.getByText("based on 8 reels")).toBeInTheDocument();
    // Early badge (Posted cell, row A — provisional: true).
    expect(screen.getByText("Early")).toBeInTheDocument();
    // Absent-score reason — row C has no `unavailableReason`-derived text elsewhere to
    // collide with; it legitimately renders in both the Performance and "vs their usual"
    // cells (both are genuinely unscored for the same reason), so assert presence, not
    // uniqueness.
    expect(screen.getAllByText("No performance data published").length).toBeGreaterThan(0);
    // Cold-start figure with its format noun attached, and the reassurance line (row B).
    expect(screen.getByText("2 of 5 carousels")).toBeInTheDocument();
    expect(screen.getByText("builds as you analyse more")).toBeInTheDocument();
  });
});

describe("AnalysisDataTable — failed row treatment (OR-4)", () => {
  it("renders 'Not analysed' in the Performance cell, never an absent-score reason string", async () => {
    renderTable();
    const failedRow = (await screen.findByText("Broken upload")).closest("tr");
    expect(failedRow).not.toBeNull();

    const scoped = within(failedRow as HTMLElement);
    expect(scoped.getByText("Not analysed")).toBeInTheDocument();
    expect(scoped.queryByText("No performance data published")).not.toBeInTheDocument();
    expect(scoped.queryByText("Engagement data incomplete")).not.toBeInTheDocument();
  });

  it("groups failed rows under their own labelled, counted divider, separate from the sink group", async () => {
    renderTable();
    await screen.findByText("Broken upload");
    expect(screen.getByText(/1 post with no performance score — sorted separately/i)).toBeInTheDocument();
    expect(screen.getByText(/1 analysis failed — sorted separately/i)).toBeInTheDocument();
  });
});

describe("AnalysisDataTable — four distinct states (design §7)", () => {
  it("loading: renders skeleton rows in the column grid with the header intact, never a spinner", () => {
    // Never-resolving fetch — the component stays in the loading state for this assertion.
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AnalysisDataTable onAnalysisClick={vi.fn()} onNewAnalysis={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("columnheader", { name: /posted/i })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(document.querySelectorAll("tbody tr").length).toBeGreaterThan(0);
  });

  it("error: renders a retry action with the header intact", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("boom", { status: 500 }))) as unknown as typeof fetch;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AnalysisDataTable onAnalysisClick={vi.fn()} onNewAnalysis={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/couldn't load analyses/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /posted/i })).toBeInTheDocument();
  });

  it("empty — nothing analysed: distinct copy and action from empty-no-match", async () => {
    const { onNewAnalysis } = renderTable([], { hasActiveFilters: false });
    expect(await screen.findByText("No analyses yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /analyse a post/i }));
    expect(onNewAnalysis).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/no analyses match these filters/i)).not.toBeInTheDocument();
  });

  it("empty — no rows match filters: distinct copy and action from empty-nothing", async () => {
    const { onClearFilters } = renderTable([], { hasActiveFilters: true });
    expect(await screen.findByText(/no analyses match these filters/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /clear all filters/i }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("No analyses yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^analyse a post$/i })).not.toBeInTheDocument();
  });
});

describe("AnalysisDataTable — interaction (design §8)", () => {
  it("row click opens the detail modal via onAnalysisClick", async () => {
    const { onAnalysisClick } = renderTable();
    const row = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;
    fireEvent.click(row);
    expect(onAnalysisClick).toHaveBeenCalledWith("row-a-scored");
  });

  it("Enter opens the detail modal for a focused row", async () => {
    const { onAnalysisClick } = renderTable();
    const row = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onAnalysisClick).toHaveBeenCalledWith("row-a-scored");
  });

  it("returns focus to the row that opened the modal once it closes", async () => {
    globalThis.fetch = buildFetchMock(ALL_ROWS, []) as unknown as typeof fetch;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    const { rerender } = render(
      <AnalysisDataTable onAnalysisClick={vi.fn()} onNewAnalysis={vi.fn()} openAnalysisId="row-a-scored" />,
      { wrapper: Wrapper },
    );
    const row = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;

    rerender(
      <AnalysisDataTable onAnalysisClick={vi.fn()} onNewAnalysis={vi.fn()} openAnalysisId={null} />,
    );

    expect(row).toHaveFocus();
  });
});
