import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AnalysisDataTable } from "@/app/app/analyses/components/grids/AnalysisDataTable";
import type { AnalysesListResponse, AnalysisListItem, AnalysisPerformance } from "@/lib/api/analyses/types";

/**
 * Ticket #219 (3C-F2, DESIGN-3B §5.5 amendment B8) — the Performance cell's three-way
 * absent-score split: row 8 (judgement returned no 1–5), row 9 (no performance block at
 * all) and `INSUFFICIENT_HISTORY` (declared, never produced, keeps the muted `—`).
 * Fixtures reproduce the REAL `AnalysisListItem`/`AnalysisPerformance` shape each state is
 * reachable through in production, not a convenient approximation of the derived cell.
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

const SCORED_PERFORMANCE: AnalysisPerformance = {
  computed: {
    reach: { value: 482_100, kind: "VIEWS", derivedFrom: "TOP_LEVEL", state: "AVAILABLE" },
    likes: { value: 31_412, state: "AVAILABLE" },
    comments: { value: 1_204, state: "AVAILABLE" },
    audience: { value: 10_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
    postAgeHours: 240,
    tier1: { denominator: "REACH", ratio: 0.068, reachKind: "VIEWS" },
    tier2: {
      median: 151_000,
      sampleSize: 8,
      bucketKey: "instagram:reel:full_video",
      multiplier: 3.2,
      minSample: 5,
      state: "MEASURED",
      reason: null,
    },
    tier3: null,
    tierUsed: "CREATOR_BASELINE",
    confidence: "HIGH",
    confidenceReason: null,
    provisional: false,
    unavailableReason: null,
  },
  judgement: { performanceScore: 4, verdict: "Strong hook.", drivers: ["Hook kuat sejak detik pertama."] },
};

const ROW_SCORED = baseRow({ id: "row-scored", title: "Nasi Goreng Kampung", performance: SCORED_PERFORMANCE });

/**
 * Row 8 (DESIGN-3B §5.5) — a performance block is present and intact (reach/likes/comments/
 * audience all measured, `tier1`/`tier2` both resolved), `unavailableReason` is `null`, and
 * the model's judgement returned no 1–5. This is the production condition, not a fixture
 * that sets the derived cell shape directly.
 */
const ROW_8_NO_JUDGEMENT = baseRow({
  id: "row-8-no-judgement",
  title: "Judgement-less post",
  performance: {
    computed: {
      reach: { value: 200_000, kind: "VIEWS", derivedFrom: "TOP_LEVEL", state: "AVAILABLE" },
      likes: { value: 9_000, state: "AVAILABLE" },
      comments: { value: 300, state: "AVAILABLE" },
      audience: { value: 10_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 120,
      tier1: { denominator: "REACH", ratio: 0.045, reachKind: "VIEWS" },
      tier2: {
        median: 180_000,
        sampleSize: 6,
        bucketKey: "instagram:reel:full_video",
        multiplier: 1.1,
        minSample: 5,
        state: "MEASURED",
        reason: null,
      },
      tier3: null,
      tierUsed: "CREATOR_BASELINE",
      confidence: "HIGH",
      confidenceReason: null,
      provisional: false,
      unavailableReason: null,
    },
    judgement: { performanceScore: null, verdict: null, drivers: ["Beberapa insight tetap tercatat."] },
  },
});

/**
 * Row 9 (DESIGN-3B §5.5) — a completed analysis with `performance: null`, so
 * `row.tableDerived == null` (`deriveAnalysisTablePerformance` returns `null` iff
 * `performance == null`). `isNonCompletedRow(row) === false` because `status` is
 * `"completed"` — this must NOT get the failed-row treatment.
 *
 * Deliberately a schema-3 row (inherits `baseRow`'s `schemaVersion: 3`) whose performance
 * step simply never ran — the second, previously-untested history behind row 9. The other
 * history is a pre-schema-3 row, which never had a performance step to run at all; that
 * distinction only shows up in `schemaVersion`, never in `performance` (both are `null`
 * either way), so a guard that keys off `schemaVersion` instead of `performance` would pass
 * every test that only exercises the pre-schema-3 history.
 */
const ROW_9_NO_PERFORMANCE_BLOCK = baseRow({
  id: "row-9-no-performance-block",
  title: "Never scored at all",
  performance: null,
});

/** `INSUFFICIENT_HISTORY` — declared on `UnavailableReason`, never produced server-side. */
const ROW_INSUFFICIENT_HISTORY = baseRow({
  id: "row-insufficient-history",
  title: "Too new to judge",
  performance: {
    computed: {
      reach: { value: null, kind: null, derivedFrom: "NONE", state: "UNKNOWN" },
      likes: { value: null, state: "UNKNOWN" },
      comments: { value: null, state: "UNKNOWN" },
      audience: { value: null, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 1,
      tier1: null,
      tier2: null,
      tier3: null,
      tierUsed: "UNAVAILABLE",
      confidence: "NONE",
      confidenceReason: null,
      provisional: false,
      unavailableReason: "INSUFFICIENT_HISTORY",
    },
    judgement: { performanceScore: null, verdict: null, drivers: [] },
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

describe("Ticket #219 — Performance cell row 8 (DESIGN-3B §5.5): judgement returned no 1–5", () => {
  it("renders 'No 1–5 for this post' and carries exactly one ⓘ", async () => {
    renderTable([ROW_8_NO_JUDGEMENT]);
    const row = (await screen.findByText("Judgement-less post")).closest("tr") as HTMLElement;
    const cells = row.querySelectorAll("td");
    const performanceCell = cells[5] as HTMLElement;

    expect(within(performanceCell).getByText("No 1–5 for this post")).toBeInTheDocument();
    expect(within(performanceCell).getAllByRole("button")).toHaveLength(1);
    expect(row).not.toHaveClass("border-l-rose-500");
  });
});

describe("Ticket #219 — Performance cell row 9 (DESIGN-3B §5.5): no performance block at all", () => {
  it("renders 'Performance wasn't measured', carries no ⓘ, and gets no failed-row treatment", async () => {
    renderTable([ROW_9_NO_PERFORMANCE_BLOCK]);
    const row = (await screen.findByText("Never scored at all")).closest("tr") as HTMLElement;
    const cells = row.querySelectorAll("td");
    const performanceCell = cells[5] as HTMLElement;

    expect(within(performanceCell).getByText("Performance wasn't measured")).toBeInTheDocument();
    // No button (the ⓘ) anywhere in this cell — the popover has no computed block to show
    // and must not be reachable at all, never mind opening onto emptiness.
    expect(within(performanceCell).queryByRole("button")).not.toBeInTheDocument();
    expect(within(performanceCell).queryByText("Not analysed")).not.toBeInTheDocument();
    expect(row).not.toHaveClass("border-l-rose-500");
  });
});

describe("Ticket #219 — Performance cell INSUFFICIENT_HISTORY (DESIGN-3B §5.5): declared, never produced", () => {
  it("still renders the muted '—', with no new string anywhere in the cell", async () => {
    renderTable([ROW_INSUFFICIENT_HISTORY]);
    const row = (await screen.findByText("Too new to judge")).closest("tr") as HTMLElement;
    const cells = row.querySelectorAll("td");
    const performanceCell = cells[5] as HTMLElement;

    expect(within(performanceCell).getByText("—")).toBeInTheDocument();
    expect(within(performanceCell).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Ticket #219 — popover heading/intro swap is conditional on row 8 only (DESIGN-3B §5.5)", () => {
  it("row 8's popover heading reads 'Why there's no 1–5 here' and its own L2 as the opening paragraph", async () => {
    renderTable([ROW_8_NO_JUDGEMENT]);
    const row = (await screen.findByText("Judgement-less post")).closest("tr") as HTMLElement;
    const trigger = within(row).getByRole("button");
    trigger.focus();

    expect(await screen.findByText("Why there's no 1–5 here")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The 1–5 is a judgement, and none was returned for this post. The measurements are unaffected and are shown as normal. We can't tell why no judgement was reached, so we're not going to guess.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("How this score was reached")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "The 1–5 is a judgement of the numbers below, not a number we measured. The measured figures are the percentage and the multiplier.",
      ),
    ).not.toBeInTheDocument();
  });

  it("a normal scored row's popover heading is still 'How this score was reached'", async () => {
    renderTable([ROW_SCORED]);
    const row = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;
    const trigger = within(row).getByRole("button", { name: "How was this score worked out?" });
    trigger.focus();

    expect(await screen.findByText("How this score was reached")).toBeInTheDocument();
    expect(screen.queryByText("Why there's no 1–5 here")).not.toBeInTheDocument();
  });
});
