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
    style: null,
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

/**
 * Row E — completed, `CAUSE_NOT_DETERMINABLE`, but genuinely row-3b-shaped (DESIGN-3B §5.4):
 * follower count known AND exactly one of like/comment usable (likes AVAILABLE, comments
 * UNKNOWN). Must render row 3b's `Engagement data incomplete`, never row 3's sentence.
 */
const ROW_E_ROW_3B = baseRow({
  id: "row-e-row-3b",
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

/**
 * Row F — a carousel whose raw `viewCount` (what `viewCountState` would classify) is
 * genuinely WRONG for the Counts cell: the judgement layer's `performance.computed.reach`
 * resolved a DIFFERENT, correct figure (a first-slide play count) via
 * `CAROUSEL_FIRST_SLIDE`. PR #198 review blocker 4 — the Counts cell must read
 * `performance.computed.reach`, never the raw view count, or it can show a confidently
 * wrong number under a wrong kind word.
 */
const ROW_F_CAROUSEL_RAW_MISMATCH = baseRow({
  id: "row-f-carousel-raw-mismatch",
  mediaType: "carousel",
  title: "Carousel with mismatched raw count",
  viewCount: 999_000, // WRONG for this cell — must never render.
  playCount: null,
  likeCount: 500,
  performance: {
    computed: {
      reach: { value: 120, kind: "PLAYS", derivedFrom: "CAROUSEL_FIRST_SLIDE", state: "AVAILABLE" },
      likes: { value: 500, state: "AVAILABLE" },
      comments: { value: 5, state: "AVAILABLE" },
      audience: { value: 8_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 50,
      tier1: { denominator: "REACH", ratio: 0.05, reachKind: "PLAYS" },
      tier2: null,
      tier3: null,
      tierUsed: "REACH_ONLY",
      confidence: "MEDIUM",
      confidenceReason: "CAROUSEL_FIRST_SLIDE",
      provisional: false,
      unavailableReason: null,
    },
    judgement: { performanceScore: 3, verdict: "Rough.", drivers: [] },
  },
});

/**
 * Row G — completed, `INSUFFICIENT_HISTORY` (PR #198 review, round 3, blocker 2). No
 * approved copy exists for this state (DESIGN-3B §5.2/`render.ts`'s own doc — it returns
 * `null` on purpose): the Performance cell must render the table's honest "—" placeholder,
 * never row 3's `No performance data published` sentence, which may be false for this post.
 */
const ROW_G_INSUFFICIENT_HISTORY = baseRow({
  id: "row-g-insufficient-history",
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

/**
 * Row H — completed, but `performance: null` (a pre-schema-3 row, `AnalysisListItemIndexed`'s
 * own doc: `tableDerived` is `null` iff `performance` is `null`). Distinct from Row D:
 * status is `"completed"`, so `AnalysisTableRow`'s whole-row failed treatment does NOT apply
 * and the Performance cell must reach the `row.tableDerived == null` branch directly.
 */
const ROW_H_PRE_SCHEMA_3 = baseRow({
  id: "row-h-pre-schema-3",
  title: "Pre-redesign row",
  schemaVersion: null,
  performance: null,
});

/**
 * Row I — a reel with the same `derivedFrom: "NONE"` + follower-denominated Tier 1 shape
 * as Row B's carousel, but `mediaType: "reel"` (PR #198 review, round 3, item 2: DESIGN-3C
 * R-13.5.2 forbids collapsing "not published for image posts" onto video content). The Eng.
 * / reach cell must read `no post-level reach` (DESIGN-3C §5.4 line 293), never the
 * image-posts string, which would be false for a reel.
 */
const ROW_I_REEL_NO_RESULT_REACH = baseRow({
  id: "row-i-reel-hidden-reach",
  mediaType: "reel",
  title: "Reel with hidden reach",
  performance: {
    computed: {
      reach: { value: null, kind: null, derivedFrom: "NONE", state: "UNKNOWN" },
      likes: { value: 300, state: "AVAILABLE" },
      comments: { value: 4, state: "AVAILABLE" },
      audience: { value: 50_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 20,
      tier1: { denominator: "FOLLOWERS", ratio: 0.006 },
      tier2: {
        median: null,
        sampleSize: 1,
        bucketKey: "instagram:reel:full_video",
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
    judgement: { performanceScore: 2, verdict: "Rough read.", drivers: [] },
  },
});

/**
 * Row J — PR #200 review, blocker B1 (OR-26, `docs/TDD-3A-3B-3C-phase-3.md:126`). A MIXED
 * image+video carousel: the cover slide (slide 0) carries no reach field, but a later slide
 * does — the server-computed `unavailableReason: "REACH_NOT_ON_FIRST_SLIDE"` is the real,
 * non-overloaded signal for this. This post genuinely DOES contain video and DOES publish
 * counts (just not on the first slide) — the Counts cell must NOT read the all-image-carousel
 * sentence ("This post type doesn't report counts"), which would be a fabricated diagnosis
 * (R-13.5.3a). `mediaType: "carousel"` + `reach.derivedFrom: "NONE"` alone is indistinguishable
 * from a genuine all-image carousel (Row B) — only `unavailableReason` disambiguates.
 */
const ROW_J_MIXED_CAROUSEL = baseRow({
  id: "row-j-mixed-carousel",
  mediaType: "carousel",
  title: "Mixed image and video carousel",
  likeAndViewCountsDisabled: false,
  performance: {
    computed: {
      reach: { value: null, kind: null, derivedFrom: "NONE", state: "UNKNOWN" },
      likes: { value: 200, state: "AVAILABLE" },
      comments: { value: 3, state: "AVAILABLE" },
      audience: { value: null, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 40,
      tier1: null,
      tier2: null,
      tier3: null,
      tierUsed: "UNAVAILABLE",
      confidence: "NONE",
      confidenceReason: null,
      provisional: false,
      unavailableReason: "REACH_NOT_ON_FIRST_SLIDE",
    },
    judgement: { performanceScore: null, verdict: null, drivers: [] },
  },
});

/**
 * Row K — a genuine all-image carousel (no video anywhere, no usable like/comment numerator
 * either — PRD §12.6's true collapse case): `unavailableReason: "CONTENT_KIND_UNSUPPORTED"`,
 * exactly what `judgement.ts`'s `resolveUnavailableReason` sets for this real shape. This is
 * the one fixture where the Counts cell's `TYPE_NOT_REPORTED` case genuinely applies.
 */
const ROW_K_ALL_IMAGE_CAROUSEL = baseRow({
  id: "row-k-all-image-carousel",
  mediaType: "carousel",
  title: "All-image carousel",
  likeAndViewCountsDisabled: false,
  performance: {
    computed: {
      reach: { value: null, kind: null, derivedFrom: "NONE", state: "UNKNOWN" },
      likes: { value: null, state: "UNKNOWN" },
      comments: { value: null, state: "UNKNOWN" },
      audience: { value: null, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 60,
      tier1: null,
      tier2: null,
      tier3: null,
      tierUsed: "UNAVAILABLE",
      confidence: "NONE",
      confidenceReason: null,
      provisional: false,
      unavailableReason: "CONTENT_KIND_UNSUPPORTED",
    },
    judgement: { performanceScore: null, verdict: null, drivers: [] },
  },
});

/**
 * Row L — ticket #149 / AC-13. A genuine all-image carousel whose `tier2.bucketKey` encodes
 * `analysisMode: "images_only"` (`platform:mediaType:analysisMode`, the same field
 * `bucketNoun()` already parses server-side) — the real shape `deriveAnalysisMode` reads. Must
 * render the labelled `Images only` mode chip in the Content cell (never `full_video`'s no-chip
 * state, never colour/icon alone — WCAG 1.4.1).
 */
const ROW_L_IMAGES_ONLY = baseRow({
  id: "row-l-images-only",
  mediaType: "carousel",
  title: "All-image carousel with a mode chip",
  performance: {
    computed: {
      reach: { value: null, kind: null, derivedFrom: "NONE", state: "UNKNOWN" },
      likes: { value: 10, state: "AVAILABLE" },
      comments: { value: 1, state: "AVAILABLE" },
      audience: { value: 1_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 10,
      tier1: null,
      tier2: {
        median: null,
        sampleSize: 0,
        bucketKey: "instagram:carousel:images_only",
        multiplier: null,
        minSample: 5,
        state: "COLD_START",
        reason: null,
      },
      tier3: null,
      tierUsed: "UNAVAILABLE",
      confidence: "NONE",
      confidenceReason: null,
      provisional: false,
      unavailableReason: "CONTENT_KIND_UNSUPPORTED",
    },
    judgement: { performanceScore: null, verdict: null, drivers: [] },
  },
});

/** Row M — ticket #149 / AC-13. `metadata_only` -> the `Caption only` mode chip. */
const ROW_M_METADATA_ONLY = baseRow({
  id: "row-m-metadata-only",
  mediaType: "post",
  title: "Text-only post with a mode chip",
  performance: {
    computed: {
      reach: { value: null, kind: null, derivedFrom: "NONE", state: "UNKNOWN" },
      likes: { value: 5, state: "AVAILABLE" },
      comments: { value: 0, state: "ZERO" },
      audience: { value: 1_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 10,
      tier1: null,
      tier2: {
        median: null,
        sampleSize: 0,
        bucketKey: "instagram:post:metadata_only",
        multiplier: null,
        minSample: 5,
        state: "COLD_START",
        reason: null,
      },
      tier3: null,
      tierUsed: "UNAVAILABLE",
      confidence: "NONE",
      confidenceReason: null,
      provisional: false,
      unavailableReason: "CONTENT_KIND_UNSUPPORTED",
    },
    judgement: { performanceScore: null, verdict: null, drivers: [] },
  },
});

/** Row N — `full_video` — must render NO mode chip at all (design §2.1). */
const ROW_N_FULL_VIDEO = baseRow({
  id: "row-n-full-video",
  mediaType: "reel",
  title: "Full video reel, no mode chip",
  performance: {
    computed: {
      reach: { value: 1_000, kind: "VIEWS", derivedFrom: "TOP_LEVEL", state: "AVAILABLE" },
      likes: { value: 10, state: "AVAILABLE" },
      comments: { value: 1, state: "AVAILABLE" },
      audience: { value: 1_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 10,
      tier1: { denominator: "REACH", ratio: 0.01, reachKind: "VIEWS" },
      tier2: {
        median: 1,
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
    judgement: { performanceScore: 3, verdict: "Fine.", drivers: [] },
  },
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

    // Ticket #149 — the table now fetches the full corpus (`ANALYSES_FETCH_ALL_PAGE_SIZE`) so
    // client-side filtering (see `AnalysisDataTable`'s own doc comment) has the whole dataset
    // to work against, not just one server page.
    expect(capturedUrls.some((u) => u.includes("/api/analyses"))).toBe(true);
    expect(capturedUrls.every((u) => u.includes("pageSize=5000"))).toBe(true);
  });

  it("R-D1 (amendment A5) — the footer states there is no totals row, exactly as specified, with no interaction", async () => {
    renderTable();
    expect(
      await screen.findByText(
        "No totals — some posts are measured against views or plays, others against follower count. The two can't be added or averaged.",
      ),
    ).toBeInTheDocument();
  });

  // R-D11 — the R-D1 footer sentence must be free to wrap, never clamped, and must never be
  // genuinely clipped by an ancestor either — `overflow-hidden` on the footer bar or any
  // ancestor up to the table's root would clip the sentence even with a clean class list on
  // the span itself, so this walks the full ancestor chain (not just the span's own
  // `className`) and fails if any of it carries a clipping class.
  it("R-D11 — the footer sentence carries no truncation classes anywhere in its ancestor chain", async () => {
    renderTable();
    const sentence = await screen.findByText(
      "No totals — some posts are measured against views or plays, others against follower count. The two can't be added or averaged.",
    );
    expect(sentence.className).not.toMatch(/truncate|text-ellipsis|overflow-hidden|line-clamp/);

    let ancestor: HTMLElement | null = sentence.parentElement;
    while (ancestor && ancestor !== document.body) {
      expect(ancestor.className).not.toMatch(/truncate|text-ellipsis|overflow-hidden|line-clamp/);
      ancestor = ancestor.parentElement;
    }
  });

  // R-D11, amended by the ticket #335 owner ruling — the footer bar's non-wrapping mechanism
  // now only applies AT `lg` (1024px) AND ABOVE, byte-identically to before: `lg:flex-nowrap`
  // restores nowrap at that breakpoint, and the pagination side's `min-w-0` is still what
  // gives the sentence room to wrap to a second line while the bar itself stays one row and
  // pagination stays right-aligned via the bar's own `justify-between`. Below `lg`, the bar
  // MAY now wrap (`flex-wrap`, unprefixed) — that is the owner-ruled fix for the 768px
  // overflow, not a regression. Both literal utility classes are asserted so a "fix" that
  // drops either the base `flex-wrap` (mobile branch) or the `lg:flex-nowrap` override
  // (desktop branch) fails this test — consistent with the toolbar's `h-11 lg:h-8` pattern.
  it("R-D11 (lg+) — the footer bar does not wrap to a second row at lg and above; the pagination side shrinks via min-w-0 instead, staying right-aligned", async () => {
    renderTable();
    const sentence = await screen.findByText(
      "No totals — some posts are measured against views or plays, others against follower count. The two can't be added or averaged.",
    );
    const footerBar = sentence.parentElement;
    expect(footerBar?.className).toMatch(/(?:^|\s)flex-wrap(?:\s|$)/);
    expect(footerBar?.className).toMatch(/lg:flex-nowrap/);
    expect(footerBar?.className).toMatch(/justify-between/);

    const paginationSide = screen.getByText(/^Page \d+ of \d+/).closest("div");
    expect(paginationSide?.className).toMatch(/min-w-0/);
    // The pagination side must be the footer bar's own direct child (not nested further),
    // so `justify-between` on the bar is what keeps it pinned to the end of the row.
    expect(paginationSide?.parentElement).toBe(footerBar);
  });

  // Below `lg`, the ticket #335 owner ruling explicitly allows the bar to wrap — this is the
  // sub-`lg` branch's own assertion, with a different literal expected value from the lg+
  // test above (`flex-wrap` present, unprefixed) so mutating away the base wrap class alone
  // (while leaving `lg:flex-nowrap` in place) fails THIS test specifically.
  it("R-D11 (below lg) — the footer bar carries the unprefixed flex-wrap utility so it is free to wrap below the lg breakpoint", async () => {
    renderTable();
    const sentence = await screen.findByText(
      "No totals — some posts are measured against views or plays, others against follower count. The two can't be added or averaged.",
    );
    const footerBar = sentence.parentElement;
    const classList = footerBar?.className.split(/\s+/) ?? [];
    expect(classList).toContain("flex-wrap");
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

  it("no header carries aria-sort — sorting was removed entirely (#266, DESIGN-3C amendment A10)", async () => {
    renderTable();
    await screen.findByRole("columnheader", { name: /posted/i });
    expect(document.querySelector("[aria-sort]")).toBeNull();
  });
});

describe("AnalysisDataTable — row density and type scale (DESIGN-3C §3.1 / §9, audit M8)", () => {
  it("the <table> uses the mockup's 12.5px body scale, not text-sm", async () => {
    renderTable();
    const table = (await screen.findAllByRole("columnheader"))[0].closest("table") as HTMLElement;
    expect(table).toHaveClass("text-[12.5px]");
    expect(table).not.toHaveClass("text-sm");
  });

  it("every <td> in a row is align-top, not align-middle — line 1s must align across the row", async () => {
    renderTable([ROW_A_SCORED]);
    const row = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;
    const cells = row.querySelectorAll("td");
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of Array.from(cells)) {
      expect(cell).toHaveClass("align-top");
      expect(cell).not.toHaveClass("align-middle");
    }
  });

  it("the Posted qualifier (age + Early) renders at the mockup's 11px, not text-xs", async () => {
    renderTable([ROW_A_SCORED]);
    const ageLine = (await screen.findByText("Early")).closest("p") as HTMLElement;
    expect(ageLine).toHaveClass("text-[11px]");
    expect(ageLine).not.toHaveClass("text-xs");
  });
});

describe("AnalysisDataTable — the Early badge (DESIGN-3C §9.3, audit M6 — styling only)", () => {
  it("fires only on the row whose performance.computed.provisional is true, built from real row fixtures — not a prop", async () => {
    renderTable([ROW_A_SCORED, ROW_B_COLD_START]);

    const rowA = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;
    const rowB = (await screen.findByText("10 Ide Konten Ramadan")).closest("tr") as HTMLElement;

    expect(within(rowA).getByText("Early")).toBeInTheDocument();
    expect(within(rowB).queryByText("Early")).not.toBeInTheDocument();
  });

  it("renders the §9.3 badge classes AND the exact word 'Early' — both halves, so changing either fails this test", async () => {
    renderTable([ROW_A_SCORED]);

    const badge = await screen.findByText("Early");
    expect(badge).toHaveTextContent("Early");
    expect(badge.tagName).toBe("SPAN");
    expect(badge).toHaveClass("rounded");
    expect(badge).toHaveClass("bg-accent/12");
    expect(badge).toHaveClass("text-accent");
    expect(badge).toHaveClass("text-[10px]");
    expect(badge).toHaveClass("font-semibold");
    expect(badge).toHaveClass("px-1.5");
    expect(badge).toHaveClass("py-0.5");
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

  // PR #198 review, blocker 6 — DESIGN-3C §3.2's Compact drop list is closed (caption
  // snippet, platform word, likes/comments line only); the confidence word is not on it and
  // must render unconditionally in both densities.
  it("still renders the confidence word in Compact density", async () => {
    renderTable();
    await screen.findAllByRole("columnheader");

    fireEvent.click(screen.getByRole("button", { name: /compact/i }));

    const rowA = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;
    expect(within(rowA).getByText("high confidence")).toBeInTheDocument();
  });
});

describe("AnalysisDataTable — row 3 vs row 3b (DESIGN-3B §5.4, PR #198 review blocker 3)", () => {
  it("a genuinely row-3b-shaped row (follower count known, exactly one of like/comment usable) renders 'Engagement data incomplete'", async () => {
    renderTable([...ALL_ROWS, ROW_E_ROW_3B]);
    const row = (await screen.findByText("Partially published")).closest("tr") as HTMLElement;
    // The same reason text legitimately repeats across several cells of the row (Performance,
    // vs-their-usual, both engagement columns) — assert presence, not uniqueness.
    expect(within(row).getAllByText("Engagement data incomplete").length).toBeGreaterThan(0);
    expect(within(row).queryByText("No performance data published")).not.toBeInTheDocument();
  });

  it("a genuinely row-3-shaped row (nothing usable) renders row 3's sentence, never row 3b's", async () => {
    renderTable([...ALL_ROWS, ROW_E_ROW_3B]);
    const row = (await screen.findByText("Quiet post")).closest("tr") as HTMLElement;
    expect(within(row).getAllByText("No performance data published").length).toBeGreaterThan(0);
    expect(within(row).queryByText("Engagement data incomplete")).not.toBeInTheDocument();
  });
});

describe("AnalysisDataTable — Performance cell never borrows another row's reason (PR #198 review, round 3, blocker 2)", () => {
  it("INSUFFICIENT_HISTORY (no approved copy exists) renders the honest '—' placeholder, never row 3's sentence", async () => {
    renderTable([ROW_G_INSUFFICIENT_HISTORY]);
    const row = (await screen.findByText("Too new to judge")).closest("tr") as HTMLElement;
    const scoped = within(row);
    expect(scoped.queryByText("No performance data published")).not.toBeInTheDocument();
    // The Performance cell (col 6) specifically — scope to its own <td> since other cells
    // in this row legitimately also render "—" (Counts, vs their usual, both engagement
    // columns all lack the data INSUFFICIENT_HISTORY describes).
    const cells = row.querySelectorAll("td");
    const performanceCell = cells[5] as HTMLElement;
    expect(within(performanceCell).getByText("—")).toBeInTheDocument();
  });

  it("a pre-schema-3 row (`performance: null`, status completed — `tableDerived == null`) renders row 9's sentence (DESIGN-3B §5.5), never row 3's sentence or a bare '—'", async () => {
    renderTable([ROW_H_PRE_SCHEMA_3]);
    const row = (await screen.findByText("Pre-redesign row")).closest("tr") as HTMLElement;
    const scoped = within(row);
    expect(scoped.queryByText("No performance data published")).not.toBeInTheDocument();
    const cells = row.querySelectorAll("td");
    const performanceCell = cells[5] as HTMLElement;
    expect(within(performanceCell).getByText("Performance wasn't measured")).toBeInTheDocument();
    expect(within(performanceCell).queryByText("—")).not.toBeInTheDocument();
  });
});

describe("AnalysisDataTable — Eng. / reach reason text does not collapse reel and image-post rows (PR #198 review, round 3, item 2, DESIGN-3C R-13.5.2 / §5.4 line 293)", () => {
  it("an image-only carousel (mediaType 'carousel', reach derivedFrom NONE) still reads 'not published for image posts'", async () => {
    renderTable([ROW_B_COLD_START]);
    const row = (await screen.findByText("10 Ide Konten Ramadan")).closest("tr") as HTMLElement;
    expect(within(row).getByText("not published for image posts")).toBeInTheDocument();
    expect(within(row).queryByText("no post-level reach")).not.toBeInTheDocument();
  });

  it("a reel with the same reach shape (mediaType 'reel') reads 'no post-level reach', never the image-posts string", async () => {
    renderTable([ROW_I_REEL_NO_RESULT_REACH]);
    const row = (await screen.findByText("Reel with hidden reach")).closest("tr") as HTMLElement;
    expect(within(row).getByText("no post-level reach")).toBeInTheDocument();
    expect(within(row).queryByText("not published for image posts")).not.toBeInTheDocument();
  });
});

describe("AnalysisDataTable — Eng. / followers 'measured against reach instead' (PR #200 review, S4 coverage gap; copy amended by A5, issue #207/#216)", () => {
  it("a reel whose Tier 1 resolved against REACH (not FOLLOWERS) reads 'measured against reach instead' in the Eng. / followers column", async () => {
    renderTable([ROW_A_SCORED]);
    const row = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;
    // Exact text match — this fails both if the withdrawn A5 string ever comes back and if
    // the branch is deleted outright (there would be no element with this text at all).
    expect(within(row).getByText("measured against reach instead")).toBeInTheDocument();
  });
});

describe("AnalysisDataTable — absent-count reason keys off unavailableReason, not the overloaded reach.derivedFrom (PR #200 review, blocker B1)", () => {
  it("a mixed image+video carousel (unavailableReason REACH_NOT_ON_FIRST_SLIDE) reads 'Counts weren't available', never the all-image-carousel sentence", async () => {
    renderTable([ROW_J_MIXED_CAROUSEL]);
    const row = (await screen.findByText("Mixed image and video carousel")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Counts weren't available")).toBeInTheDocument();
    expect(within(row).queryByText("This post type doesn't report counts")).not.toBeInTheDocument();
  });

  it("a genuine all-image carousel (unavailableReason CONTENT_KIND_UNSUPPORTED) still reads the all-image-carousel sentence", async () => {
    renderTable([ROW_K_ALL_IMAGE_CAROUSEL]);
    const row = (await screen.findByText("All-image carousel")).closest("tr") as HTMLElement;
    expect(within(row).getByText("This post type doesn't report counts")).toBeInTheDocument();
    expect(within(row).queryByText("Counts weren't available")).not.toBeInTheDocument();
  });
});

describe("AnalysisDataTable — Counts cell sources performance.computed.reach (PR #198 review blocker 4)", () => {
  it("renders the judgement-layer reach figure and kind word, never the raw (and here wrong) viewCount", async () => {
    renderTable([ROW_F_CAROUSEL_RAW_MISMATCH]);
    const row = (await screen.findByText("Carousel with mismatched raw count")).closest(
      "tr",
    ) as HTMLElement;
    const scoped = within(row);
    expect(scoped.getByText("120")).toBeInTheDocument();
    expect(scoped.getByText("plays")).toBeInTheDocument();
    expect(scoped.queryByText("999K")).not.toBeInTheDocument();
    expect(scoped.queryByText("999.0K")).not.toBeInTheDocument();
  });
});

describe("AnalysisDataTable — Content cell line 2 is never truncated (PR #198 review blocker 7)", () => {
  it("does not apply a truncate class to the failed/queued second line", async () => {
    renderTable();
    const secondLine = await screen.findByText("Analysis failed");
    expect(secondLine.className).not.toMatch(/truncate/);
  });

  it("does not apply a truncate class to the caption second line", async () => {
    renderTable();
    const secondLines = await screen.findAllByText("Resep sederhana, hasil istimewa");
    for (const line of secondLines) {
      expect(line.className).not.toMatch(/truncate/);
    }
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
    // PR #198 review, blocker 5.1 — no design doc approves a full sentence for the failed-group
    // divider, so this asserts the minimal non-prose marker actually shipped, not invented prose.
    expect(screen.getByText("Analysis failed — 1")).toBeInTheDocument();
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
    // Ticket #149 — the true unfiltered corpus (`pagination.total`) is zero, not merely a
    // filtered-to-zero view; this is the ONLY trigger for this state now (no external boolean).
    const { onNewAnalysis } = renderTable([]);
    expect(await screen.findByText("No analyses yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /analyse a post/i }));
    expect(onNewAnalysis).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/no analyses match these filters/i)).not.toBeInTheDocument();
  });

  it("empty — no rows match filters: distinct copy and action from empty-nothing", async () => {
    // Ticket #149 — the corpus is non-empty (`pagination.total` > 0 via `ALL_ROWS`), but the
    // supplied `filters` match none of them, so `filteredCount === 0 && totalCount > 0`.
    const { onClearFilters } = renderTable(ALL_ROWS, {
      filters: {
        account: ["someone-who-does-not-exist"],
        platform: [],
        contentKind: [],
        tier: [],
        status: [],
        q: "",
      },
    });
    expect(await screen.findByText(/no analyses match these filters/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /clear all filters/i }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("No analyses yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^analyse a post$/i })).not.toBeInTheDocument();
  });
});

describe("AnalysisDataTable — interaction (design §8)", () => {
  it("clicking a DESCENDANT of the row (a real click, never the bare <tr>) opens the detail modal", async () => {
    // PR #198 review, blocker 1 — a real browser click always lands on a `<td>`'s content,
    // never on the bare `<tr>` element itself. Firing the click on the title text node's
    // parent (a genuine descendant several levels deep) reproduces what a user actually does;
    // asserting via `fireEvent.click(row)` on the `<tr>` directly cannot catch a
    // `target !== currentTarget` regression, since only a synthetic click can satisfy that.
    const { onAnalysisClick } = renderTable();
    const titleText = await screen.findByText("Nasi Goreng Kampung");
    fireEvent.click(titleText);
    expect(onAnalysisClick).toHaveBeenCalledWith("row-a-scored");
  });

  it("clicking the creator cell's text (a plain descendant, no exemption wired yet) still opens the row", async () => {
    const { onAnalysisClick } = renderTable();
    const rowA = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;
    const creatorText = within(rowA).getByText("@dapurbunda");
    fireEvent.click(creatorText);
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

describe("AnalysisDataTable — AC-13, the Content cell's mode chip", () => {
  it("images_only renders the labelled 'Images only' badge in rendered text", async () => {
    renderTable([ROW_L_IMAGES_ONLY]);
    const row = (await screen.findByText("All-image carousel with a mode chip")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Images only")).toBeInTheDocument();
  });

  it("metadata_only renders the labelled 'Caption only' badge in rendered text", async () => {
    renderTable([ROW_M_METADATA_ONLY]);
    const row = (await screen.findByText("Text-only post with a mode chip")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Caption only")).toBeInTheDocument();
  });

  it("full_video renders NO mode chip at all", async () => {
    renderTable([ROW_N_FULL_VIDEO]);
    const row = (await screen.findByText("Full video reel, no mode chip")).closest("tr") as HTMLElement;
    expect(within(row).queryByText("Images only")).not.toBeInTheDocument();
    expect(within(row).queryByText("Caption only")).not.toBeInTheDocument();
  });
});

describe("AnalysisContentCell — kind badge reachable by assistive technology (PR #203 review, blocker 2)", () => {
  // `getByText` alone does not respect `aria-hidden` — the badge's TEXT is present either way.
  // The accessibility-tree-aware assertion is that the badge is not nested inside any
  // `aria-hidden="true"` ancestor: an `aria-hidden` ancestor removes every descendant from the
  // accessibility tree regardless of the descendant's own attributes (WAI-ARIA §6.2), which is
  // exactly the bug this cell shipped with.
  it("the kind badge text is NOT nested inside any aria-hidden ancestor", async () => {
    renderTable([ROW_A_SCORED]);
    const row = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;
    const badge = within(row).getByText("Reel");
    expect(badge.closest('[aria-hidden="true"]')).toBeNull();
  });

  it("a second kind (Carousel) is also reachable — not just the default reel fixture", async () => {
    renderTable([ROW_B_COLD_START]);
    const row = (await screen.findByText("10 Ide Konten Ramadan")).closest("tr") as HTMLElement;
    const badge = within(row).getByText("Carousel");
    expect(badge.closest('[aria-hidden="true"]')).toBeNull();
  });

  it("the thumbnail image itself remains decorative (aria-hidden) — only the badge was pulled out of that scope", async () => {
    renderTable([ROW_A_SCORED]);
    const row = (await screen.findByText("Nasi Goreng Kampung")).closest("tr") as HTMLElement;
    const badge = within(row).getByText("Reel");
    const cell = badge.closest("td") as HTMLElement;
    expect(cell.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("AnalysisDataTable — Columns menu (DESIGN-3C §6.3, ticket #149)", () => {
  // PR #203 review, blocker 3 — `checked={column.locked || visibleColumnIds.has(column.id)}` is
  // hardcoded `true` for a locked column, so `aria-selected="true"` alone is UNFALSIFIABLE (it
  // would pass even if the click genuinely hid the column). Falsifiable per-column: after
  // clicking, assert the column's HEADER is still actually rendered in the table, for EVERY one
  // of the four locked columns individually — the prior version of this test only re-checked
  // Content/Performance at the very end, never the two engagement columns R-12.3.1 exists to
  // protect.
  //
  // PR #203 round-3 review — the accessible-name lookup (`getAllByRole("columnheader", { name:
  // /^content$/i })`) was UNFALSIFIABLE specifically for the "content" case: it is also
  // satisfied by the unrelated Scores group's "Content" sub-header (`contentScore`, see
  // `ANALYSES_TABLE_COLUMNS`), so removing the actual `content` column's `<th>` still left a
  // match and the assertion could never fail. `AnalysisTableColumnHeaders` now stamps every
  // leaf `<th>` with `data-column-id={column.id}` specifically so this test can target the
  // real column's own header cell, independent of any accessible-name collision with a
  // same-labelled sibling.
  it.each([
    { name: /^content$/i, columnId: "content" },
    { name: /^performance$/i, columnId: "performance" },
    { name: /^eng\. \/ reach$/i, columnId: "engagementReach" },
    { name: /^eng\. \/ followers$/i, columnId: "engagementFollowers" },
  ])(
    "locked column '$name' cannot be hidden through the UI — its header stays rendered after the click",
    async ({ name, columnId }) => {
      renderTable();
      await screen.findAllByRole("columnheader");

      fireEvent.click(screen.getByRole("button", { name: /^columns/i }));
      const option = await screen.findByRole("option", { name });
      expect(option).toHaveAttribute("aria-selected", "true");

      // Behavioural: actually attempt the click, not merely assert a `locked` prop exists.
      fireEvent.click(within(option).getByRole("button"));

      // Falsifiable: the column's OWN header cell, identified by `data-column-id`, must still
      // be in the DOM. Unlike an accessible-name lookup, this cannot be satisfied by a
      // different, same-labelled header (e.g. the Scores group's "Content" sub-header for
      // `contentScore`) — it fails if, and only if, this specific column's `<th>` is gone.
      expect(document.querySelector(`th[data-column-id="${columnId}"]`)).toBeInTheDocument();
    },
  );

  it("attempting to click every locked column's toggle does not remove any of the four from the table at once", async () => {
    renderTable();
    await screen.findAllByRole("columnheader");

    fireEvent.click(screen.getByRole("button", { name: /^columns/i }));

    for (const name of [/^content$/i, /^performance$/i, /^eng\. \/ reach$/i, /^eng\. \/ followers$/i]) {
      const option = await screen.findByRole("option", { name });
      fireEvent.click(within(option).getByRole("button"));
    }

    expect(screen.getAllByRole("columnheader", { name: /^content$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("columnheader", { name: /^performance$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^eng\. \/ reach$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^eng\. \/ followers$/i })).toBeInTheDocument();
  });

  it("a locked column's toggle button is a genuinely disabled control, not merely checked — clicking it never reaches the same toggle handler Style's click reaches", async () => {
    renderTable();
    await screen.findAllByRole("columnheader");
    fireEvent.click(screen.getByRole("button", { name: /^columns/i }));

    const lockedOption = await screen.findByRole("option", { name: /^performance$/i });
    const lockedButton = within(lockedOption).getByRole("button");
    expect(lockedButton).toBeDisabled();

    const styleOption = await screen.findByRole("option", { name: /^style$/i });
    const styleButton = within(styleOption).getByRole("button");
    expect(styleButton).not.toBeDisabled();
  });

  it("hovering a locked entry shows the exact DESIGN-3C §6.3 tooltip string", async () => {
    renderTable();
    await screen.findAllByRole("columnheader");
    fireEvent.click(screen.getByRole("button", { name: /^columns/i }));

    const option = await screen.findByRole("option", { name: /^performance$/i });
    fireEvent.mouseEnter(option);

    // The popover primitive can briefly keep an exiting instance mounted during its own
    // transition — assert at least one visible copy of the exact string, not exactly one.
    const tooltips = await screen.findAllByText(
      "Always shown — this column carries information the numbers can't be read without.",
    );
    expect(tooltips.length).toBeGreaterThan(0);
  });
});

describe("AnalysisDataTable — Style column, off by default, toggled on, never persisted (Q3, OR-5, ticket #149 scope addition)", () => {
  it("Style is absent on first render", async () => {
    renderTable();
    await screen.findAllByRole("columnheader");
    expect(screen.queryByRole("columnheader", { name: /^style$/i })).not.toBeInTheDocument();
  });

  it("toggling Style on from the Columns menu makes the column appear", async () => {
    renderTable();
    await screen.findAllByRole("columnheader");

    fireEvent.click(screen.getByRole("button", { name: /^columns/i }));
    const styleOption = await screen.findByRole("option", { name: /^style$/i });
    fireEvent.click(within(styleOption).getByRole("button"));

    expect(await screen.findByRole("columnheader", { name: /^style$/i })).toBeInTheDocument();
  });

  it("does NOT persist across a simulated remount — Style resets to hidden, and nothing is written to storage", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    const { unmount } = renderTable();
    await screen.findAllByRole("columnheader");
    fireEvent.click(screen.getByRole("button", { name: /^columns/i }));
    const styleOption = await screen.findByRole("option", { name: /^style$/i });
    fireEvent.click(within(styleOption).getByRole("button"));
    await screen.findByRole("columnheader", { name: /^style$/i });

    unmount();

    // Remount fresh — simulates a reload / navigate-away-and-back.
    renderTable();
    await screen.findAllByRole("columnheader");
    expect(screen.queryByRole("columnheader", { name: /^style$/i })).not.toBeInTheDocument();

    // No `localStorage`/`sessionStorage` write anywhere in the toggle path (OR-5's hard rule).
    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });
});

/**
 * Ticket #260 — the cold-start progress cell's live `sampleSize` (readModel.ts's
 * `liveColdStartSampleSize` carve-out, ticket #206) is unbounded: it grows as the creator's
 * library grows even though this row's cold-start classification is frozen. Before this fix,
 * `AnalysisTableRow` rendered `{sampleSize} of {5}` with the `5` hardcoded and no clamp,
 * so a row past its own threshold rendered the nonsensical `6 of 5 reels`. The fix clamps
 * `sampleSize` to `tier2.minSample` — the server's own `BASELINE_MIN_SAMPLE`, now carried per
 * row instead of a hardcoded, driftable client constant — in the derive layer
 * (`deriveMultiplierCell`, `lib/api/analyses/helpers.ts`).
 */
describe("AnalysisDataTable — ticket #260, cold-start progress is clamped to its own threshold", () => {
  /** A cold-start row whose live `sampleSize` (6) has already overtaken `minSample` (5) — the
   * exact shape production served on five real reel rows (anonymised, #264). */
  const ROW_OVER_THRESHOLD = baseRow({
    id: "row-over-threshold",
    mediaType: "reel",
    title: "Cold start past its own threshold",
    performance: {
      computed: {
        reach: { value: null, kind: null, derivedFrom: "NONE", state: "UNKNOWN" },
        likes: { value: 500, state: "AVAILABLE" },
        comments: { value: 8, state: "AVAILABLE" },
        audience: { value: 120_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
        postAgeHours: 200,
        tier1: { denominator: "FOLLOWERS", ratio: 0.05 },
        tier2: {
          median: null,
          sampleSize: 6,
          bucketKey: "instagram:reel:full_video",
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

  it("clamps a live sampleSize (6) greater than the threshold (5) to '5 of 5 reels', never '6 of 5'", async () => {
    renderTable([ROW_OVER_THRESHOLD]);
    expect(await screen.findByText("5 of 5 reels")).toBeInTheDocument();
    expect(screen.queryByText("6 of 5 reels")).not.toBeInTheDocument();
  });

  /**
   * The server-side half of the fix (`PerformanceTier2.minSample` carrying the
   * env-overridable `BASELINE_MIN_SAMPLE`, `vi.stubEnv`-tested in
   * `tests/server/analysis/performance/readModel.test.ts`) is covered separately — this test
   * proves the client half: given a row whose `minSample` reflects a raised server threshold
   * (8), the cell renders that denominator, never the hardcoded `5`.
   */
  it("with the server threshold at 8 (unclamped, sampleSize 6 < 8), the cell renders '6 of 8 reels', never '6 of 5'", async () => {
    const rowWithHigherThreshold = baseRow({
      id: "row-higher-threshold",
      mediaType: "reel",
      title: "Cold start under a raised threshold",
      performance: {
        computed: {
          reach: { value: null, kind: null, derivedFrom: "NONE", state: "UNKNOWN" },
          likes: { value: 500, state: "AVAILABLE" },
          comments: { value: 8, state: "AVAILABLE" },
          audience: { value: 120_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
          postAgeHours: 200,
          tier1: { denominator: "FOLLOWERS", ratio: 0.05 },
          tier2: {
            median: null,
            sampleSize: 6,
            bucketKey: "instagram:reel:full_video",
            multiplier: null,
            minSample: 8,
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

    renderTable([rowWithHigherThreshold]);
    expect(await screen.findByText("6 of 8 reels")).toBeInTheDocument();
    expect(screen.queryByText("6 of 5 reels")).not.toBeInTheDocument();
  });
});

/**
 * Ticket #262 (DESIGN-3C §2) — the below-threshold `NOT_COMPARABLE` state-3 string. Own metric
 * unresolved, live pool below `minSample` (or never fetched) — `readModel.ts`'s `buildTier2`
 * step 2 emits `reason: "POST_METRIC_UNRESOLVED_NO_BASELINE"`, and `AnalysisTableRow` renders
 * it through the SAME generic `NOT_COMPARABLE_MULTIPLIER_CELL_COPY[content.reason]` lookup it
 * already used for `POST_METRIC_UNRESOLVED` — no new branch in the component (asserted by the
 * absence of any `AnalysisTableRow.tsx` diff in this PR, not just by this test).
 */
describe("AnalysisDataTable — ticket #262, below-threshold NOT_COMPARABLE state-3 string", () => {
  const ROW_BELOW_THRESHOLD = baseRow({
    id: "row-below-threshold-262",
    mediaType: "reel",
    title: "Own count unresolved, no baseline yet",
    performance: {
      computed: {
        reach: { value: null, kind: null, derivedFrom: "NONE", state: "UNKNOWN" },
        likes: { value: null, state: "UNKNOWN" },
        comments: { value: null, state: "UNKNOWN" },
        audience: { value: 50_000, capturedAt: "2026-08-01T00:00:00.000Z", sourceFetchedAt: null },
        postAgeHours: 40,
        tier1: null,
        tier2: {
          median: null,
          sampleSize: 1,
          bucketKey: "instagram:reel:full_video",
          multiplier: null,
          minSample: 5,
          state: "NOT_COMPARABLE",
          reason: "POST_METRIC_UNRESOLVED_NO_BASELINE",
        },
        tier3: null,
        tierUsed: "UNAVAILABLE",
        confidence: "NONE",
        confidenceReason: null,
        provisional: false,
        unavailableReason: "REACH_UNKNOWN",
      },
      judgement: { performanceScore: null, verdict: null, drivers: [] },
    },
  });

  it("renders exactly 'this post's own count wasn't published' — no 'N of N', no denominator, no 'builds as you analyse more'", async () => {
    renderTable([ROW_BELOW_THRESHOLD]);
    expect(await screen.findByText("this post's own count wasn't published")).toBeInTheDocument();
    expect(screen.queryByText(/of\s+\d+\s+reels/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/builds as you analyse more/i)).not.toBeInTheDocument();
    // The long form's now-false leading clause must never leak onto this row.
    expect(screen.queryByText(/this creator's usual is set/i)).not.toBeInTheDocument();
  });

  it("the cell is a plain statement — no button, no link, nothing interactive (OR-25: never a retry)", async () => {
    renderTable([ROW_BELOW_THRESHOLD]);
    const statement = await screen.findByText("this post's own count wasn't published");
    expect(statement.tagName).toBe("P");
    expect(within(statement).queryByRole("button")).not.toBeInTheDocument();
    expect(within(statement).queryByRole("link")).not.toBeInTheDocument();
  });

  /**
   * Sorting/grouping regression (#262's acceptance criteria) — a below-threshold state-3 row
   * must not be treated as cold start with progress `0`. Sorting is server-side SQL
   * (`ORDER BY a.updated_at DESC`, all sorting removed by #266/#268) and grouping has no notion
   * of cold-start progress at all (DESIGN-3C §3.3) — this pins the client-visible half: no
   * cold-start progress text renders for this row under any circumstance.
   */
  it("never renders cold-start progress framing ('N of minSample', a bare threshold number) for this row", async () => {
    renderTable([ROW_BELOW_THRESHOLD]);
    await screen.findByText("this post's own count wasn't published");
    expect(screen.queryByText("1 of 5 reels")).not.toBeInTheDocument();
    expect(screen.queryByText("0 of 5 reels")).not.toBeInTheDocument();
  });
});
