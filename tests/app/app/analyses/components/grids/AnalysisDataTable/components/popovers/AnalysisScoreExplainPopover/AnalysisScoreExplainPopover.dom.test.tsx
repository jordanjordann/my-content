import fs from "node:fs";
import path from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisScoreExplainPopover } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/popovers/AnalysisScoreExplainPopover";
import { deriveAnalysisTablePerformance } from "@/lib/api/analyses/helpers";
import type { AnalysisListItemIndexed, AnalysisPerformance } from "@/lib/api/analyses/types";

/**
 * Ticket #147 — the explain popover, the core of this ticket. Fixtures reproduce the REAL
 * `#144` response shape and are run through the REAL `deriveAnalysisTablePerformance` (the
 * exact function `hooks.ts`'s `select` calls) so `disagreementLine` is production logic, not
 * a hand-typed stand-in.
 */

function buildRow(performance: AnalysisPerformance, overrides: Partial<AnalysisListItemIndexed> = {}): AnalysisListItemIndexed {
  return {
    id: "row-under-test",
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
    postDate: "2026-07-10T00:00:00.000Z",
    durationSec: 30,
    caption: null,
    title: "Nasi Goreng Kampung",
    createdAt: "2026-07-12T00:00:00.000Z",
    performance,
    style: null,
    searchText: "",
    viewCountState: { kind: "count", value: 482_100 },
    likeCountState: { kind: "count", value: 31_412 },
    tableDerived: deriveAnalysisTablePerformance(performance, "reel", null),
    ...overrides,
  };
}

/** Score 4 (high), multiplier 3.2 (high) — AGREE, no disagreement line. */
const AGREEING_PERFORMANCE: AnalysisPerformance = {
  computed: {
    reach: { value: 482_100, kind: "VIEWS", derivedFrom: "TOP_LEVEL", state: "AVAILABLE" },
    likes: { value: 31_412, state: "AVAILABLE" },
    comments: { value: 1_204, state: "AVAILABLE" },
    audience: { value: 10_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
    postAgeHours: 240,
    tier1: { denominator: "REACH", ratio: 0.068, reachKind: "VIEWS" },
    tier2: { median: 151_000, sampleSize: 7, bucketKey: "instagram:reel:full_video", multiplier: 3.2 },
    tier3: null,
    tierUsed: "CREATOR_BASELINE",
    confidence: "HIGH",
    confidenceReason: null,
    provisional: false,
    unavailableReason: null,
  },
  judgement: { performanceScore: 4, verdict: "Strong hook.", drivers: ["Hook kuat sejak detik pertama."] },
};

/** Score 2 (low), multiplier 3.2 (high) — the canonical OR-6 disagreement example, D2. */
const DISAGREEING_PERFORMANCE: AnalysisPerformance = {
  ...AGREEING_PERFORMANCE,
  judgement: { performanceScore: 2, verdict: "Weak content, strong reach.", drivers: ["Konten kurang kuat."] },
};

const D2_TEXT =
  "The 1–5 reads this less favourably than the measured comparison does — it came in over this creator's usual for this kind of post. The measured figures above are the ones to quote.";

function openPopover(row: AnalysisListItemIndexed) {
  render(<AnalysisScoreExplainPopover row={row} />);
  fireEvent.click(screen.getByRole("button", { name: "How was this score worked out?" }));
  return screen.getByRole("tooltip");
}

describe("AnalysisScoreExplainPopover — content order (TDD §9.4 / DESIGN-3B §7, 'order is itself an argument')", () => {
  it("renders the six sections in the required order: judgement intro, measured figures, operands, disagreement, drivers, footer", () => {
    const popup = openPopover(buildRow(DISAGREEING_PERFORMANCE));
    const text = popup.textContent ?? "";

    const iIntro = text.indexOf("The 1–5 is a judgement of the numbers below");
    const iMeasured = text.indexOf("of the people who saw it engaged");
    const iOperands = text.indexOf("What went into this");
    const iDisagreement = text.indexOf(D2_TEXT);
    const iDrivers = text.indexOf("Why it did what it did");
    const iFooter = text.indexOf("Measured 12 Jul 2026");

    expect(iIntro).toBeGreaterThanOrEqual(0);
    expect(iMeasured).toBeGreaterThan(iIntro);
    expect(iOperands).toBeGreaterThan(iMeasured);
    expect(iDisagreement).toBeGreaterThan(iOperands);
    expect(iDrivers).toBeGreaterThan(iDisagreement);
    expect(iFooter).toBeGreaterThan(iDrivers);
  });

  it("the measured figures render ABOVE the operand list, and the intro states which figures are measured", () => {
    const popup = openPopover(buildRow(AGREEING_PERFORMANCE));
    expect(popup.textContent).toContain(
      "The measured figures are the percentage and the multiplier.",
    );
  });
});

describe("AnalysisScoreExplainPopover — the disagreement line (OR-6, DESIGN-3B §3.1.1 amendment B5)", () => {
  it("fires D2 on the canonical OR-6 row — score 2 / multiplier 3.2×", () => {
    const popup = openPopover(buildRow(DISAGREEING_PERFORMANCE));
    expect(popup.textContent).toContain(D2_TEXT);
  });

  it("does NOT fire when score and multiplier agree", () => {
    const popup = openPopover(buildRow(AGREEING_PERFORMANCE));
    expect(popup.textContent).not.toContain(D2_TEXT);
    expect(popup.textContent).not.toContain("came in under this creator's usual");
  });
});

describe("AnalysisScoreExplainPopover — no worked division (R-13.3.4)", () => {
  it("never shows a worked quotient like '31,412 + 1,204 ÷ 482,100 = 6.8%' — only the stored operands and the stored result", () => {
    const popup = openPopover(buildRow(AGREEING_PERFORMANCE));
    const text = popup.textContent ?? "";
    expect(text).not.toContain("÷");
    expect(text).not.toContain("31,412 + 1,204");
    // The stored operands and the stored result both appear, independently.
    expect(text).toContain("31,412");
    expect(text).toContain("1,204");
    expect(text).toContain("6.8%");
  });
});

describe("AnalysisScoreExplainPopover — Indonesian drivers, unedited (TDD §9.4 item 5)", () => {
  it("renders drivers[] verbatim under 'Why it did what it did'", () => {
    const popup = openPopover(buildRow(AGREEING_PERFORMANCE));
    expect(popup.textContent).toContain("Why it did what it did");
    expect(popup.textContent).toContain("Hook kuat sejak detik pertama.");
  });
});

describe("AnalysisScoreExplainPopover — the unconditional footer (TDD §9.4 item 6)", () => {
  it("renders every time, using the exact approved sentence", () => {
    const popup = openPopover(buildRow(AGREEING_PERFORMANCE));
    expect(popup.textContent).toContain(
      "Measured 12 Jul 2026. These numbers are frozen at the time of analysis and don't update.",
    );
  });
});

describe("AnalysisScoreExplainPopover — numeral allow-list (R-13.3.4)", () => {
  it("every numeral rendered traces to the fixture's own computed block or the footer date — nothing fabricated", () => {
    const popup = openPopover(buildRow(AGREEING_PERFORMANCE));
    const text = popup.textContent ?? "";
    const digitRuns = text.match(/\d+/g) ?? [];

    // Every digit-run present in the fixture's computed block (likes, comments, reach,
    // audience, tier2 median/sampleSize/multiplier, tier1 ratio-as-percent) or in the footer
    // date (day/year) — nothing else is permitted to appear. Reviewer N4: this is a
    // hand-verified allow-list, not derived from the fixture object at runtime — deriving it
    // would require re-implementing the popover's own formatting (percent rounding, K-abbrev,
    // date locale) in the test, which risks the test and the component agreeing by
    // construction rather than by assertion. Every entry below is traced to a real rendered
    // string in this describe block's fixture; `performanceScore` (4) is NOT included because
    // the score numeral is not rendered anywhere in the popover body (it lives in the cell,
    // not here) — an untraceable entry was removed per N4 rather than kept "for resilience".
    const allowed = new Set([
      "1", "5", // the "1–5" in the approved judgement-intro sentence (DESIGN-3B §7 point 1)
      "31", "412", // likes (31,412 — comma splits the regex match into two runs)
      "204", // comments (1,204 — the leading "1" is covered by the "1–5" entry above)
      "482", "100", // reach (482,100)
      "151", // tier2 median, abbreviated (formatAbbrev -> "151.0K")
      "7", // tier2 sampleSize
      "3", "2", // tier2 multiplier (3.2×)
      "6", "8", // tier1 ratio as a percent (0.068 -> 6.8%)
      "12", "2026", // footer date (12 Jul 2026)
      "0", // decimal-formatting artifact (e.g. formatAbbrev's "151.0K")
    ]);

    for (const run of digitRuns) {
      expect(allowed.has(run), `unexpected numeral "${run}" in popover text: ${text}`).toBe(true);
    }
  });
});

describe("AnalysisScoreExplainPopover — R-13.4.4 has teeth (AC-29, banned phrasings)", () => {
  const bannedPhrasings = [
    "posts settle after 72 hours",
    "the standard settling window",
    "research shows",
    "typically stabilises within",
  ];

  it("the copy source, INCLUDING lib/api/analyses/helpers.ts where the disagreement strings live, contains no hour count and none of the four banned phrasings", () => {
    const moduleDir = path.join(
      process.cwd(),
      "app/app/analyses/components/grids/AnalysisDataTable/components/popovers/AnalysisScoreExplainPopover",
    );
    // PR #201 review, blocking item 4 (AC-29 coverage hole) — this PR placed the two D1/D2
    // disagreement strings, and the comment describing them, in `lib/api/analyses/helpers.ts`
    // (the `select`-layer derivation, outside the popover module). The original scan covered
    // only the three popover-module files and missed it entirely.
    const sourceFiles = [
      path.join(moduleDir, "constants.ts"),
      path.join(moduleDir, "helpers.ts"),
      path.join(moduleDir, "AnalysisScoreExplainPopover.tsx"),
      path.join(process.cwd(), "lib/api/analyses/helpers.ts"),
    ];
    const combinedSource = sourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");

    // No literal hour count anywhere in the copy source ("72 hours", "3 days", "after 72h").
    expect(combinedSource).not.toMatch(/\d+\s*(hours?|h\b|days?)/i);

    for (const phrase of bannedPhrasings) {
      expect(combinedSource.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it("the rendered popover text contains no hour count and none of the four banned phrasings (agreeing fixture)", () => {
    const popup = openPopover(buildRow(AGREEING_PERFORMANCE));
    const text = (popup.textContent ?? "").toLowerCase();

    expect(text).not.toMatch(/\d+\s*(hours?|h\b|days?)/i);
    for (const phrase of bannedPhrasings) {
      expect(text).not.toContain(phrase.toLowerCase());
    }
  });

  it("the rendered popover text contains no hour count and none of the four banned phrasings, run against a DISAGREEING fixture so the D1/D2 copy is actually exercised", () => {
    // PR #201 review, blocking item 4 — the agreeing fixture never renders a disagreement
    // line by construction, so it can never fail this scan even if D1/D2 were non-compliant.
    // This fixture triggers D2 (score 2, multiplier 3.2× — see DISAGREEING_PERFORMANCE above).
    const popup = openPopover(buildRow(DISAGREEING_PERFORMANCE));
    const text = (popup.textContent ?? "").toLowerCase();

    expect(text).toContain(D2_TEXT.toLowerCase());
    expect(text).not.toMatch(/\d+\s*(hours?|h\b|days?)/i);
    for (const phrase of bannedPhrasings) {
      expect(text).not.toContain(phrase.toLowerCase());
    }
  });
});
