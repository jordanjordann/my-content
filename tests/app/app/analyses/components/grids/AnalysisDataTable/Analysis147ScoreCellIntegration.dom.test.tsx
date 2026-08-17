import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AnalysisDataTable } from "@/app/app/analyses/components/grids/AnalysisDataTable";
import type { AnalysesListResponse, AnalysisListItem, AnalysisPerformance } from "@/lib/api/analyses/types";

/**
 * Ticket #147 — full-table integration tests, kept in a SEPARATE file from #145's
 * `AnalysisDataTable.dom.test.tsx` deliberately: that file is also in #146/#149's edit
 * scope this cycle, and this ticket's own fixtures/assertions have no need to live inside
 * it. Fixtures reproduce the REAL `AnalysisListItem`/`AnalysisPerformance` shape
 * (`lib/api/analyses/types.ts`), not a convenient approximation.
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
    tier2: { median: 151_000, sampleSize: 8, bucketKey: "instagram:reel:full_video", multiplier: 3.2 },
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

/** Row 3 — nothing usable published, hidden-counts flag absent (DESIGN-3B §5 row 3). */
const ROW_ABSENT_1 = baseRow({
  id: "row-absent-1",
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

/** Row 3b — follower count known, exactly one of like/comment usable (DESIGN-3B §5.4). */
const ROW_ABSENT_3B = baseRow({
  id: "row-absent-3b",
  title: "Partially published",
  performance: {
    computed: {
      reach: { value: null, kind: null, derivedFrom: "NONE", state: "UNKNOWN" },
      likes: { value: 40, state: "AVAILABLE" },
      comments: { value: null, state: "UNKNOWN" },
      audience: { value: 5_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 300,
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

/** Row 1 — creator hid the counts, flag explicitly `true`. */
const ROW_ABSENT_HIDDEN = baseRow({
  id: "row-absent-hidden",
  title: "Hidden counts post",
  likeAndViewCountsDisabled: true,
  performance: {
    computed: {
      reach: { value: null, kind: null, derivedFrom: "NONE", state: "HIDDEN" },
      likes: { value: null, state: "HIDDEN" },
      comments: { value: null, state: "UNKNOWN" },
      audience: { value: null, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 100,
      tier1: null,
      tier2: null,
      tier3: null,
      tierUsed: "UNAVAILABLE",
      confidence: "NONE",
      confidenceReason: null,
      provisional: false,
      unavailableReason: "REACH_HIDDEN",
    },
    judgement: { performanceScore: null, verdict: null, drivers: [] },
  },
});

/** Row 4 — no cached follower count, image post. */
const ROW_ABSENT_NO_AUDIENCE = baseRow({
  id: "row-absent-no-audience",
  mediaType: "post",
  title: "Image post, no audience data",
  performance: {
    computed: {
      reach: { value: null, kind: null, derivedFrom: "NONE", state: "UNKNOWN" },
      likes: { value: 10, state: "AVAILABLE" },
      comments: { value: 1, state: "AVAILABLE" },
      audience: { value: null, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 50,
      tier1: null,
      tier2: null,
      tier3: null,
      tierUsed: "UNAVAILABLE",
      confidence: "NONE",
      confidenceReason: null,
      provisional: false,
      unavailableReason: "NO_AUDIENCE_DATA",
    },
    judgement: { performanceScore: null, verdict: null, drivers: [] },
  },
});

/** Row 8 (DESIGN-3B §5.5, amendment B8 / §5.5.1 amendment B10, S-P8) — a performance block
 * exists, `unavailableReason` is `null`, and the judgement returned no 1–5. */
const ROW_NO_JUDGEMENT = baseRow({
  id: "row-no-judgement",
  title: "Judged, no 1-5",
  performance: {
    computed: SCORED_PERFORMANCE.computed,
    judgement: { performanceScore: null, verdict: "Strong hook.", drivers: ["Hook kuat sejak detik pertama."] },
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

  const onAnalysisClick = vi.fn();
  render(
    <AnalysisDataTable onAnalysisClick={onAnalysisClick} onNewAnalysis={vi.fn()} onClearFilters={vi.fn()} />,
    { wrapper: Wrapper },
  );

  return { onAnalysisClick };
}

describe("AC-15 — sample size renders in the SAME cell as the multiplier (non-regression, #145's shipped code)", () => {
  it("the 'vs their usual' cell carries both the multiplier and its sample size together", async () => {
    renderTable([ROW_SCORED]);
    const row = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;
    const cells = row.querySelectorAll("td");
    // Col 7 (0-indexed: content, creator, posted, counts, contentScore, performance, multiplier).
    const multiplierCell = cells[6] as HTMLElement;
    expect(within(multiplierCell).getByText("3.2×")).toBeInTheDocument();
    expect(within(multiplierCell).getByText("based on 8 reels")).toBeInTheDocument();
  });
});

describe("AC-30 — four absent-score cases render four distinct strings (non-regression, #145's shipped code)", () => {
  it("renders four genuinely different sentences, none blank/0/em-dash-without-reason, none an enum identifier", async () => {
    renderTable([ROW_ABSENT_1, ROW_ABSENT_3B, ROW_ABSENT_HIDDEN, ROW_ABSENT_NO_AUDIENCE]);
    await screen.findByText("Quiet post");

    const row1 = (await screen.findByText("Quiet post")).closest("tr") as HTMLElement;
    const row3b = (await screen.findByText("Partially published")).closest("tr") as HTMLElement;
    const rowHidden = (await screen.findByText("Hidden counts post")).closest("tr") as HTMLElement;
    const rowNoAudience = (await screen.findByText("Image post, no audience data")).closest("tr") as HTMLElement;

    const performanceCellText = (row: HTMLElement) => (row.querySelectorAll("td")[5] as HTMLElement).textContent;

    const strings = [
      performanceCellText(row1),
      performanceCellText(row3b),
      performanceCellText(rowHidden),
      performanceCellText(rowNoAudience),
    ];

    // All four distinct.
    expect(new Set(strings).size).toBe(4);

    for (const s of strings) {
      expect(s).not.toBe("");
      expect(s).not.toBe("0");
      expect(s).not.toBe("—");
      // No raw enum identifiers, field names or error codes leaking into copy.
      expect(s).not.toMatch(/CAUSE_NOT_DETERMINABLE|REACH_HIDDEN|NO_AUDIENCE_DATA|UNAVAILABLE/);
    }
  });
});

describe("Ticket #147 — the ⓘ trigger carries data-row-exempt and does not open the row detail modal", () => {
  it("clicking the ⓘ glyph itself does NOT call onAnalysisClick, but clicking elsewhere in the row does", async () => {
    const { onAnalysisClick } = renderTable([ROW_SCORED]);
    const row = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;

    const trigger = within(row).getByRole("button", { name: "How was this score worked out?" });
    fireEvent.click(trigger);
    expect(onAnalysisClick).not.toHaveBeenCalled();

    // Baseline still works: a real click on the row body (not the trigger) opens the modal.
    fireEvent.click(within(row).getByText("Nasi Goreng Kampung"));
    expect(onAnalysisClick).toHaveBeenCalledWith("row-scored");
  });

  /**
   * PR #201 review, N2 — the test above cannot distinguish the `data-row-exempt` guard from
   * the trigger's own `event.stopPropagation()`: the trigger's click handler stops native
   * propagation before the row's `onClick` ever runs, so deleting the attribute does not fail
   * that test. `AnalysisTableRow`'s own comment documents the guard as general — "a
   * descendant added later only needs the one attribute to keep working" — independent of
   * whether that descendant also calls `stopPropagation()`. This test exercises exactly that
   * general contract: a bare element carrying `data-row-exempt`, with NO `stopPropagation`
   * of its own, so the click bubbles to the row's real handler with propagation intact. Only
   * `AnalysisTableRow`'s `isExemptTarget` guard — not any interaction with `stopPropagation`
   * — can be preventing `onOpen` from firing here.
   */
  it("a bare data-row-exempt descendant with no stopPropagation of its own still blocks the row click (isolates the guard from the trigger's stopPropagation)", async () => {
    const { onAnalysisClick } = renderTable([ROW_SCORED]);
    const row = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;

    const exemptProbe = document.createElement("span");
    exemptProbe.textContent = "exempt probe";
    exemptProbe.setAttribute("data-row-exempt", "true");
    row.appendChild(exemptProbe);

    fireEvent.click(exemptProbe);
    expect(onAnalysisClick).not.toHaveBeenCalled();

    // Same probe, attribute removed: an identical click, same lack of stopPropagation, now
    // DOES reach `onOpen` — isolating `data-row-exempt` itself as the load-bearing mechanism.
    exemptProbe.removeAttribute("data-row-exempt");
    fireEvent.click(exemptProbe);
    expect(onAnalysisClick).toHaveBeenCalledWith("row-scored");
  });
});

describe("Ticket #147 — the Performance cell always carries a second line (design §5, enforced)", () => {
  it("a real scored row's Performance <td> renders the second-line wrapper", async () => {
    renderTable([ROW_SCORED]);
    const row = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;
    const performanceCell = row.querySelectorAll("td")[5] as HTMLElement;
    expect(within(performanceCell).getByTestId("performance-score-second-line")).toBeInTheDocument();
  });
});

describe("DESIGN-3B §5.5.1 (S-P8) — row 8's ⓘ name, exercised through the real table", () => {
  it("row 8 carries exactly one ⓘ trigger, named 'Why is there no 1–5 for this post?', not the scored-row name", async () => {
    renderTable([ROW_NO_JUDGEMENT]);
    const row = (await screen.findByText("Judged, no 1-5")).closest("tr") as HTMLElement;

    expect(within(row).getByText("No 1–5 for this post")).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: "Why is there no 1–5 for this post?" }),
    ).toBeInTheDocument();
    expect(
      within(row).queryByRole("button", { name: "How was this score worked out?" }),
    ).not.toBeInTheDocument();
    // One ⓘ per row (DESIGN-3C §5.1) — must still hold on row 8.
    expect(within(row).getAllByRole("button", { name: /1–5/ })).toHaveLength(1);
  });

  it("a scored row in the SAME table keeps 'How was this score worked out?' — the two rows must not cross-contaminate", async () => {
    renderTable([ROW_SCORED, ROW_NO_JUDGEMENT]);
    const scoredRow = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;
    const noJudgementRow = (await screen.findByText("Judged, no 1-5")).closest("tr") as HTMLElement;

    expect(
      within(scoredRow).getByRole("button", { name: "How was this score worked out?" }),
    ).toBeInTheDocument();
    expect(
      within(noJudgementRow).getByRole("button", { name: "Why is there no 1–5 for this post?" }),
    ).toBeInTheDocument();
  });
});
