import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnalysisDataTable } from "@/app/app/analyses/components/grids/AnalysisDataTable";
import { AnalysisCardList } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/lists/AnalysisCardList";
import { groupAnalysisRows } from "@/app/app/analyses/components/grids/AnalysisDataTable/helpers";
import { deriveAnalysisTablePerformance } from "@/lib/api/analyses/helpers";
import type {
  AnalysesListResponse,
  AnalysisListItem,
  AnalysisListItemIndexed,
} from "@/lib/api/analyses/types";
import { installMatchMediaStub } from "@/tests/setup/matchMediaStub";

/**
 * Ticket #337 (TDD §6.3, C-5/C-6/C-7) — the <640px stacked card list. Every acceptance
 * criterion here is asserted against the real rendered DOM via `@testing-library/react`, both
 * breakpoint branches exercised with `installMatchMediaStub()` in the same file with different
 * literal expected values.
 *
 * `AnalysisEngagementCell` is stubbed for this file ONLY so the "denominators survive" test
 * can assert the literal `denominator` prop `AnalysisSummaryCard` passes it, independent of
 * which of the two engagement columns a given fixture row happens to resolve a numeric value
 * for (the two columns are structurally mutually exclusive per row — see
 * `AnalysisTableEngagementCell`'s own doc comment — so no single row fixture can prove both
 * literal prop values any other way).
 */
vi.mock(
  "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisEngagementCell",
  () => ({
    AnalysisEngagementCell: ({
      cell,
      denominator,
    }: {
      cell: { kind: string };
      denominator: string;
    }) => (
      <div data-testid="engagement-cell" data-denominator={denominator} data-kind={cell.kind} />
    ),
  }),
);

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
    style: null,
    ...overrides,
  };
}

/** Row A — scored, Tier 1 REACH-denominated, provisional. */
const ROW_A_SCORED = baseRow({
  id: "row-a-scored",
  title: "Nasi Goreng Kampung",
  username: "creator_a",
  performance: {
    computed: {
      reach: { value: 482_100, kind: "VIEWS", derivedFrom: "TOP_LEVEL", state: "AVAILABLE" },
      likes: { value: 1_200, state: "AVAILABLE" },
      comments: { value: 40, state: "AVAILABLE" },
      audience: { value: 10_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 10,
      tier1: { denominator: "REACH", ratio: 0.041, reachKind: "VIEWS" },
      tier2: {
        median: 1.0,
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
      provisional: true,
      unavailableReason: null,
    },
    judgement: { performanceScore: 4, verdict: "Strong hook.", drivers: [] },
  },
});

/** Row B — scored, Tier 1 FOLLOWERS-denominated (cold start). */
const ROW_B_FOLLOWERS = baseRow({
  id: "row-b-followers",
  title: "10 Ide Konten Ramadan",
  username: "creator_b",
  mediaType: "carousel",
  performance: {
    computed: {
      reach: { value: null, kind: null, derivedFrom: "NONE", state: "UNKNOWN" },
      likes: { value: 900, state: "AVAILABLE" },
      comments: { value: 12, state: "AVAILABLE" },
      audience: { value: 284_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 200,
      tier1: { denominator: "FOLLOWERS", ratio: 0.162 },
      tier2: {
        median: null,
        sampleSize: 2,
        bucketKey: "instagram:carousel:full_video",
        multiplier: null,
        minSample: 5,
        state: "COLD_START",
        reason: null,
      },
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

/** Row C — completed, no performance score at all (sinks into the scoreless divider). */
const ROW_C_SCORELESS = baseRow({
  id: "row-c-scoreless",
  title: "Quiet post",
  username: "creator_c",
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

const THREE_ROWS = [ROW_A_SCORED, ROW_B_FOLLOWERS, ROW_C_SCORELESS];

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

function renderTable(rows: AnalysisListItem[], props: Partial<React.ComponentProps<typeof AnalysisDataTable>> = {}) {
  globalThis.fetch = buildFetchMock(rows) as unknown as typeof fetch;

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

  return { ...utils, onAnalysisClick, onNewAnalysis, onClearFilters };
}

let stub: ReturnType<typeof installMatchMediaStub> | undefined;

function belowSm() {
  stub = installMatchMediaStub();
  stub.setMatches("(max-width: 639.98px)", true);
  return stub;
}

function atOrAboveSm() {
  stub = installMatchMediaStub();
  stub.setMatches("(max-width: 639.98px)", false);
  return stub;
}

afterEach(() => {
  stub?.restore();
  stub = undefined;
  vi.restoreAllMocks();
});

describe("AnalysisCardList — exactly one view mounts (C-5)", () => {
  it("below 640px: no <table>, and a literal card count matching the fixture", async () => {
    belowSm();
    renderTable(THREE_ROWS);

    const cards = await screen.findAllByTestId("analysis-summary-card");
    expect(cards.length).toBe(3);
    expect(document.querySelectorAll("table").length).toBe(0);
  });

  it("at/above 640px: exactly one <table>, and zero cards", async () => {
    atOrAboveSm();
    renderTable(THREE_ROWS);

    await screen.findAllByRole("columnheader");
    expect(document.querySelectorAll("table").length).toBe(1);
    expect(document.querySelectorAll('[data-testid="analysis-summary-card"]').length).toBe(0);
  });
});

describe("AnalysisCardList — cards and table show the same rows, in the same order", () => {
  it("card branch renders the literal ordered id list", async () => {
    belowSm();
    renderTable(THREE_ROWS);

    const cards = await screen.findAllByTestId("analysis-summary-card");
    const ids = cards.map((card) => card.getAttribute("aria-label"));
    // Row order is scored-then-scoreless (R-S1/R-S2): A (scored), B (scored), then C
    // (scoreless, after its own divider) — same partition `AnalysisDataTable` computes.
    expect(ids).toEqual(["Nasi Goreng Kampung", "10 Ide Konten Ramadan", "Quiet post"]);
  });

  it("table branch renders the same literal ordered id list, asserted independently (never compared to the card branch directly)", async () => {
    atOrAboveSm();
    renderTable(THREE_ROWS);

    await screen.findByText("Quiet post");
    const contentCells = Array.from(document.querySelectorAll('tbody td[data-column-id="content"]'));
    const titles = contentCells.map((td) => td.querySelector("p")?.textContent ?? null);
    expect(titles).toEqual(["Nasi Goreng Kampung", "10 Ide Konten Ramadan", "Quiet post"]);
  });
});

describe("AnalysisCardList — every locked column plus Creator, in the exact owner-ruled order", () => {
  it("labels match the exact ordered array literally", async () => {
    belowSm();
    renderTable([ROW_A_SCORED]);

    const card = await screen.findByTestId("analysis-summary-card");
    const labels = within(card)
      .getAllByTestId("analysis-card-field-label")
      .map((el) => el.textContent);

    expect(labels).toEqual(["Content", "Performance", "Eng. / reach", "Eng. / followers", "Creator", "Posted"]);
  });
});

describe("AnalysisCardList — denominators survive (C-6)", () => {
  it("the two engagement fields carry their own distinct, literal denominator — paired, not two independent checks", async () => {
    belowSm();
    renderTable([ROW_A_SCORED]);

    const card = await screen.findByTestId("analysis-summary-card");
    const engagementCells = within(card).getAllByTestId("engagement-cell");
    expect(engagementCells.map((el) => el.getAttribute("data-denominator"))).toEqual([
      "REACH",
      "FOLLOWERS",
    ]);
  });
});

describe("AnalysisCardList — sink group divider text comes from one shared constant (do not retype it)", () => {
  it("card branch renders the exact literal scoreless-divider sentence", async () => {
    belowSm();
    renderTable([ROW_A_SCORED, ROW_C_SCORELESS]);

    await screen.findAllByTestId("analysis-summary-card");
    expect(
      screen.getByText("1 post with no performance score — sorted separately"),
    ).toBeInTheDocument();
  });

  it("table branch renders the byte-identical literal sentence", async () => {
    atOrAboveSm();
    renderTable([ROW_A_SCORED, ROW_C_SCORELESS]);

    await screen.findByText("Quiet post");
    expect(
      screen.getByText("1 post with no performance score — sorted separately"),
    ).toBeInTheDocument();
  });
});

describe("AnalysisCardList — tap opens the detail modal with the right id", () => {
  it("fireEvent.click fires onOpen exactly once with the literal row id", async () => {
    belowSm();
    const { onAnalysisClick } = renderTable(THREE_ROWS);

    const cards = await screen.findAllByTestId("analysis-summary-card");
    const rowBCard = cards.find((card) => card.getAttribute("aria-label") === "10 Ide Konten Ramadan")!;
    fireEvent.click(rowBCard);

    expect(onAnalysisClick).toHaveBeenCalledTimes(1);
    expect(onAnalysisClick).toHaveBeenCalledWith("row-b-followers");
  });
});

describe("AnalysisCardList — keyboard operable, a real <button> (not a styled <div>)", () => {
  it("the card is a BUTTON element", async () => {
    belowSm();
    renderTable([ROW_A_SCORED]);

    const card = await screen.findByTestId("analysis-summary-card");
    expect(card.tagName).toBe("BUTTON");
  });

  it("Enter fires onOpen exactly once with the literal row id", async () => {
    belowSm();
    const { onAnalysisClick } = renderTable([ROW_A_SCORED]);

    const card = await screen.findByTestId("analysis-summary-card");
    fireEvent.keyDown(card, { key: "Enter" });

    expect(onAnalysisClick).toHaveBeenCalledTimes(1);
    expect(onAnalysisClick).toHaveBeenCalledWith("row-a-scored");
  });
});

describe("AnalysisCardList — empty / error / skeleton states never smuggle a table back in", () => {
  it("nothing analysed — exact heading, no table", async () => {
    belowSm();
    renderTable([]);

    expect(await screen.findByText("No analyses yet")).toBeInTheDocument();
    expect(document.querySelectorAll("table").length).toBe(0);
  });

  it("no rows match filters — exact heading, no table", async () => {
    belowSm();
    renderTable(THREE_ROWS, {
      filters: {
        account: ["someone-who-does-not-exist"],
        platform: [],
        contentKind: [],
        tier: [],
        status: [],
        q: "",
      },
    });

    expect(await screen.findByText("No analyses match these filters")).toBeInTheDocument();
    expect(document.querySelectorAll("table").length).toBe(0);
  });

  it("error — exact heading, no table", async () => {
    belowSm();
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("boom", { status: 500 }))) as unknown as typeof fetch;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AnalysisDataTable onAnalysisClick={vi.fn()} onNewAnalysis={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Couldn't load analyses")).toBeInTheDocument();
    expect(document.querySelectorAll("table").length).toBe(0);
  });

  it("skeleton — no table while pending", () => {
    belowSm();
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AnalysisDataTable onAnalysisClick={vi.fn()} onNewAnalysis={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(document.querySelectorAll("table").length).toBe(0);
    expect(document.querySelectorAll('[data-testid="analysis-summary-card"]').length).toBe(0);
  });
});

describe("AnalysisCardList — owns no data logic (AGENTS.md)", () => {
  function toIndexed(item: AnalysisListItem): AnalysisListItemIndexed {
    return {
      ...item,
      searchText: "",
      viewCountState: { kind: "unknown" },
      likeCountState: { kind: "unknown" },
      tableDerived: deriveAnalysisTablePerformance(item.performance, item.mediaType, item.likeAndViewCountsDisabled),
    };
  }

  it("renders correctly when tableDerived is already populated, and does not throw when tableDerived is null (mirrors the table's own null handling)", () => {
    const populated = toIndexed(ROW_A_SCORED);
    const nullDerived = toIndexed(baseRow({ id: "row-null-derived", title: "No performance block", performance: null }));

    expect(populated.tableDerived).not.toBeNull();
    expect(nullDerived.tableDerived).toBeNull();

    const groups = groupAnalysisRows([populated, nullDerived]);

    expect(() =>
      render(
        <AnalysisCardList
          isPending={false}
          isError={false}
          errorMessage=""
          onRetry={vi.fn()}
          noneAtAll={false}
          noMatch={false}
          onNewAnalysis={vi.fn()}
          onClearFilters={vi.fn()}
          groups={groups}
          onOpen={vi.fn()}
        />,
      ),
    ).not.toThrow();

    expect(screen.getByText("Nasi Goreng Kampung")).toBeInTheDocument();
    expect(screen.getByText("Performance wasn't measured")).toBeInTheDocument();
  });
});
