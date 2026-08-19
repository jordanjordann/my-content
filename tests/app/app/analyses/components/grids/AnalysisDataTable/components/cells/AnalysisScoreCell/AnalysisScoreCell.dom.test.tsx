import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisScoreCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell";
import { deriveAnalysisTablePerformance } from "@/lib/api/analyses/helpers";
import type { AnalysisListItemIndexed, AnalysisPerformance } from "@/lib/api/analyses/types";

/**
 * Ticket #147 — direct component tests for the real build this ticket owns (score pips +
 * numeral cell). Fixtures reproduce the REAL `PerformanceComputed`/`PerformanceJudgement`
 * shape (`lib/api/analyses/types.ts`) and run through the REAL `deriveAnalysisTablePerformance`
 * (the same function `hooks.ts`'s `select` calls) rather than a hand-typed `tableDerived`
 * approximation, so `disagreementLine`/`multiplierCell` are exactly what production produces.
 */

const SCORED_PERFORMANCE: AnalysisPerformance = {
  computed: {
    reach: { value: 482_100, kind: "VIEWS", derivedFrom: "TOP_LEVEL", state: "AVAILABLE" },
    likes: { value: 31_412, state: "AVAILABLE" },
    comments: { value: 1_204, state: "AVAILABLE" },
    audience: { value: 10_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
    postAgeHours: 240,
    tier1: { denominator: "REACH", ratio: 0.068, reachKind: "VIEWS" },
    tier2: { median: 151_000, sampleSize: 7, bucketKey: "instagram:reel:full_video", multiplier: 3.2, minSample: 5 },
    tier3: null,
    tierUsed: "CREATOR_BASELINE",
    confidence: "HIGH",
    confidenceReason: null,
    provisional: false,
    unavailableReason: null,
  },
  judgement: { performanceScore: 4, verdict: "Strong hook.", drivers: ["Hook kuat dalam tiga detik pertama."] },
};

function buildRow(performance: AnalysisPerformance): AnalysisListItemIndexed {
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
  };
}

const ROW = buildRow(SCORED_PERFORMANCE);

describe("AnalysisScoreCell — content variant (DESIGN-3C §5, TDD §9.3)", () => {
  it("renders five discrete square pips, aria-hidden, plus the numeral", () => {
    render(<AnalysisScoreCell variant="content" score={4} />);

    const group = screen.getByRole("group", { name: "Content 4 out of 5" });
    expect(within(group).getByText("4")).toBeInTheDocument();

    // N1's fix made the numeral text ALSO `aria-hidden`, so it is no longer safe to grab the
    // first `[aria-hidden="true"]` match — the pip track is specifically the one with
    // discrete pip children, so select on that shape rather than on `aria-hidden` alone.
    const pipTrack = Array.from(group.querySelectorAll('[aria-hidden="true"]')).find(
      (el) => el.querySelectorAll("span").length === 5,
    );
    expect(pipTrack).not.toBeUndefined();
    expect(pipTrack?.querySelectorAll("span")).toHaveLength(5);
  });

  it("never renders a second line — structurally, not just visually empty", () => {
    render(<AnalysisScoreCell variant="content" score={4} />);
    expect(screen.queryByTestId("performance-score-second-line")).not.toBeInTheDocument();
  });

  it("hides the numeral text from the accessibility tree — the group label already carries it (N1)", () => {
    render(<AnalysisScoreCell variant="content" score={4} />);
    expect(screen.getByText("4")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the muted-foreground pip fill, distinct from the performance axis (D7)", () => {
    render(<AnalysisScoreCell variant="content" score={4} />);
    const filledPip = document.querySelector('[aria-hidden="true"] > span');
    expect(filledPip).toHaveClass("bg-muted-foreground");
  });

  it("the Content numeral does NOT carry text-primary (DESIGN-3C §9.2, audit M5)", () => {
    render(<AnalysisScoreCell variant="content" score={4} />);
    expect(screen.getByText("4")).not.toHaveClass("text-primary");
  });

  // R2 (PR #233 review) — pip COUNT is guarded (`length: MAX_SCORE - 1` kills 2 tests) but
  // pip FILL was not: the only pre-existing fill assertions inspected pip [0] and pip [4] for
  // a single score, which an off-by-one satisfies either direction. This pins the exact fill
  // class of ALL 5 pips at every reachable score (0..5, the two degenerate all-empty /
  // all-filled cases included), independently of the source's own constants (literal class
  // names, not an import), so it cannot be a self-referential guard.
  it.each([0, 1, 2, 3, 4, 5])(
    "score=%i fills exactly that many of the 5 pips, in order, and no others (content)",
    (score) => {
      render(<AnalysisScoreCell variant="content" score={score} />);

      const group = screen.getByRole("group");
      const pipTrack = Array.from(group.querySelectorAll('[aria-hidden="true"]')).find(
        (el) => el.querySelectorAll("span").length === 5,
      );
      expect(pipTrack).not.toBeUndefined();
      const pips = Array.from(pipTrack!.querySelectorAll("span"));
      expect(pips).toHaveLength(5);

      pips.forEach((pip, index) => {
        if (index < score) {
          expect(pip).toHaveClass("bg-muted-foreground");
          expect(pip).not.toHaveClass("bg-[#5c6c86]");
        } else {
          expect(pip).toHaveClass("bg-[#5c6c86]");
          expect(pip).not.toHaveClass("bg-muted-foreground");
        }
      });
    },
  );
});

describe("AnalysisScoreCell — performance variant (DESIGN-3C §5.1, TDD §9.3)", () => {
  it("announces the combined judgement in one utterance: 'Performance 4 out of 5, compared to their usual, high confidence'", () => {
    render(
      <AnalysisScoreCell
        variant="performance"
        score={4}
        tierPhrase="vs their usual"
        isTier3={false}
        confidenceWord="high confidence"
        row={ROW}
      />,
    );

    expect(
      screen.getByRole("group", { name: "Performance 4 out of 5, compared to their usual, high confidence" }),
    ).toBeInTheDocument();
  });

  it("hides the duplicate text descendants from the accessibility tree, so the group label is the only thing announced for them (PR #201 review, N1)", () => {
    render(
      <AnalysisScoreCell
        variant="performance"
        score={4}
        tierPhrase="vs their usual"
        isTier3={false}
        confidenceWord="high confidence"
        row={ROW}
      />,
    );

    const numeral = screen.getByText("4");
    expect(numeral).toHaveAttribute("aria-hidden", "true");

    const tierPhrase = screen.getByText("vs their usual");
    expect(tierPhrase).toHaveAttribute("aria-hidden", "true");

    const confidence = screen.getByText("high confidence");
    expect(confidence).toHaveAttribute("aria-hidden", "true");

    // The trigger itself must stay OUT of the hidden scope — it is a real interactive
    // element with its own accessible name, not duplicate judgement text.
    const trigger = screen.getByRole("button", { name: "How was this score worked out?" });
    expect(trigger).not.toHaveAttribute("aria-hidden");
  });

  it("AC-26 — renders numeral, tier phrase and confidence with no interaction", () => {
    render(
      <AnalysisScoreCell
        variant="performance"
        score={4}
        tierPhrase="vs their usual"
        isTier3={false}
        confidenceWord="high confidence"
        row={ROW}
      />,
    );

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("vs their usual")).toBeInTheDocument();
    expect(screen.getByText("high confidence")).toBeInTheDocument();
  });

  it("uses the primary pip fill, distinct from the content axis (D7)", () => {
    render(
      <AnalysisScoreCell
        variant="performance"
        score={4}
        tierPhrase="vs their usual"
        isTier3={false}
        confidenceWord="high confidence"
        row={ROW}
      />,
    );
    const filledPip = document.querySelector('[aria-hidden="true"] > span');
    expect(filledPip).toHaveClass("bg-primary");
  });

  it("renders Tier 3 in muted italic (R-13.2.4 — the weakest tier reads as the weakest)", () => {
    render(
      <AnalysisScoreCell
        variant="performance"
        score={2}
        tierPhrase="rough — vs audience size"
        isTier3
        confidenceWord="medium confidence"
        row={ROW}
      />,
    );
    // N1's fix wraps the tier-phrase text in its own `aria-hidden` span; the `italic` class
    // lives on the enclosing `<p>`, which is what actually renders the style.
    expect(screen.getByText("rough — vs audience size").closest("p")).toHaveClass("italic");
  });

  it("ALWAYS renders the second-line wrapper — a Performance cell with no second line is a bug (design §5)", () => {
    const { rerender } = render(
      <AnalysisScoreCell
        variant="performance"
        score={4}
        tierPhrase="vs their usual"
        isTier3={false}
        confidenceWord="high confidence"
        row={ROW}
      />,
    );
    expect(screen.getByTestId("performance-score-second-line")).toBeInTheDocument();

    // Even in the structurally-unreachable-in-production edge case of a null tier phrase
    // and null confidence word, the wrapper element itself must still be present — its
    // ABSENCE, not its emptiness, is what the enforcement rule is about.
    rerender(
      <AnalysisScoreCell variant="performance" score={4} tierPhrase={null} isTier3={false} confidenceWord={null} row={ROW} />,
    );
    expect(screen.getByTestId("performance-score-second-line")).toBeInTheDocument();
  });

  it("renders exactly one ⓘ trigger, carrying data-row-exempt, with the accessible name 'How was this score worked out?'", () => {
    render(
      <AnalysisScoreCell
        variant="performance"
        score={4}
        tierPhrase="vs their usual"
        isTier3={false}
        confidenceWord="high confidence"
        row={ROW}
      />,
    );

    const triggers = screen.getAllByRole("button", { name: "How was this score worked out?" });
    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toHaveAttribute("data-row-exempt", "true");
  });

  it("clicking the ⓘ trigger opens the popover (role='tooltip')", () => {
    render(
      <AnalysisScoreCell
        variant="performance"
        score={4}
        tierPhrase="vs their usual"
        isTier3={false}
        confidenceWord="high confidence"
        row={ROW}
      />,
    );

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "How was this score worked out?" }));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("the Performance numeral DOES carry text-primary — distinct from the Content numeral (DESIGN-3C §9.2, audit M5)", () => {
    render(
      <AnalysisScoreCell
        variant="performance"
        score={4}
        tierPhrase="vs their usual"
        isTier3={false}
        confidenceWord="high confidence"
        row={ROW}
      />,
    );
    expect(screen.getByText("4")).toHaveClass("text-primary");
  });

  it("the numeral weight is font-semibold, not font-medium (audit L3)", () => {
    render(
      <AnalysisScoreCell
        variant="performance"
        score={4}
        tierPhrase="vs their usual"
        isTier3={false}
        confidenceWord="high confidence"
        row={ROW}
      />,
    );
    const numeral = screen.getByText("4");
    expect(numeral).toHaveClass("font-semibold");
    expect(numeral).not.toHaveClass("font-medium");
  });

  it("the unfilled pip track uses §9.4's explicit token, never an opacity modifier off muted-foreground (audit L3)", () => {
    render(
      <AnalysisScoreCell
        variant="performance"
        score={4}
        tierPhrase="vs their usual"
        isTier3={false}
        confidenceWord="high confidence"
        row={ROW}
      />,
    );
    const emptyPip = document.querySelectorAll('[aria-hidden="true"] > span')[4];
    expect(emptyPip).toHaveClass("bg-[#5c6c86]");
    expect(emptyPip?.className).not.toMatch(/muted-foreground\//);
  });

  it("pips are 7px with 2px rounding, not the old 6px/1px step (audit L3)", () => {
    render(
      <AnalysisScoreCell
        variant="performance"
        score={4}
        tierPhrase="vs their usual"
        isTier3={false}
        confidenceWord="high confidence"
        row={ROW}
      />,
    );
    const firstPip = document.querySelector('[aria-hidden="true"] > span');
    expect(firstPip).toHaveClass("size-[7px]");
    expect(firstPip).toHaveClass("rounded-[2px]");
  });

  // R2 (PR #233 review) — same fill-count gap as the content variant, on the performance
  // axis's own fill colour and track token. Every pip inspected, not just the ends.
  it.each([0, 1, 2, 3, 4, 5])(
    "score=%i fills exactly that many of the 5 pips, in order, and no others (performance)",
    (score) => {
      render(
        <AnalysisScoreCell
          variant="performance"
          score={score}
          tierPhrase="vs their usual"
          isTier3={false}
          confidenceWord="high confidence"
          row={ROW}
        />,
      );

      const group = screen.getByRole("group");
      const pipTrack = Array.from(group.querySelectorAll('[aria-hidden="true"]')).find(
        (el) => el.querySelectorAll("span").length === 5,
      );
      expect(pipTrack).not.toBeUndefined();
      const pips = Array.from(pipTrack!.querySelectorAll("span"));
      expect(pips).toHaveLength(5);

      pips.forEach((pip, index) => {
        if (index < score) {
          expect(pip).toHaveClass("bg-primary");
          expect(pip).not.toHaveClass("bg-[#5c6c86]");
        } else {
          expect(pip).toHaveClass("bg-[#5c6c86]");
          expect(pip).not.toHaveClass("bg-primary");
        }
      });
    },
  );
});
