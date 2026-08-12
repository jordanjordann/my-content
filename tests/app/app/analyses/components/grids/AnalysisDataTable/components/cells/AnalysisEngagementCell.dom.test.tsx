import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisEngagementCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisEngagementCell";
import type { AnalysisTableEngagementCell } from "@/lib/api/analyses/types";

/**
 * Ticket #146 — OR-3 / R-12.3.4 (Direction A, two dedicated columns, never one) and R-D3
 * (video-bearing carousel, first-slide-derived reach). Renders the REAL
 * `AnalysisTableEngagementCell` shape `deriveEngagementCell` (`lib/api/analyses/helpers.ts`)
 * produces — not a convenient approximation.
 */

const REEL_REACH_CELL: AnalysisTableEngagementCell = {
  kind: "value",
  ratio: 0.041,
  denominator: "REACH",
  reachKind: "VIEWS",
  reachValue: 482_100,
  firstSlideOnly: false,
};

const FOLLOWER_CELL: AnalysisTableEngagementCell = {
  kind: "value",
  ratio: 0.162,
  denominator: "FOLLOWERS",
  followersValue: 284_000,
};

const PLAYS_REACH_CELL: AnalysisTableEngagementCell = {
  kind: "value",
  ratio: 0.05,
  denominator: "REACH",
  reachKind: "PLAYS",
  reachValue: 116_300,
  firstSlideOnly: false,
};

const FIRST_SLIDE_ONLY_CELL: AnalysisTableEngagementCell = {
  kind: "value",
  ratio: 0.023,
  denominator: "REACH",
  reachKind: "VIEWS",
  reachValue: 88_200,
  firstSlideOnly: true,
};

const REASON_CELL: AnalysisTableEngagementCell = {
  kind: "reason",
  text: "not published for image posts",
};

/**
 * PR #200 review, blocker B2 — `readModel.ts:153` coalesces a null `perf_reach_kind` column to
 * `"UNKNOWN"` on a row that nonetheless has a resolved tier-1 REACH ratio. The reach VALUE and
 * RATIO are real; only the kind word (views vs plays) is unknown.
 */
const UNKNOWN_KIND_REACH_CELL: AnalysisTableEngagementCell = {
  kind: "value",
  ratio: 0.03,
  denominator: "REACH",
  reachKind: "UNKNOWN",
  reachValue: 50_000,
  firstSlideOnly: false,
};

describe("AnalysisEngagementCell — Direction A value rendering (AC-21, AC-25, no interaction)", () => {
  it("a reach-denominated value shows its qualifier with no hover/focus needed, amber colour, no ≈ prefix", () => {
    render(<AnalysisEngagementCell cell={REEL_REACH_CELL} denominator="REACH" />);
    expect(screen.getByText("4.1%")).toBeInTheDocument();
    expect(screen.getByText("of 482.1K views")).toBeInTheDocument();
    expect(screen.getByText("4.1%").className).toMatch(/text-accent/);
  });

  it("a follower-denominated value carries the mandatory ≈ prefix, its own distinct qualifier text, and the teal colour", () => {
    render(<AnalysisEngagementCell cell={FOLLOWER_CELL} denominator="FOLLOWERS" />);
    expect(screen.getByText("≈16.2%")).toBeInTheDocument();
    expect(screen.getByText("of 284.0K followers")).toBeInTheDocument();
    expect(screen.getByText("≈16.2%").className).toMatch(/text-teal-500/);
    // Reach and follower qualifiers are never the same string (AC-25/AC-21 distinguisher).
    expect(screen.queryByText("of 482.1K views")).not.toBeInTheDocument();
  });

  it("the two qualifier strings are present in accessible text with no interaction — no hover, no focus, no click fired", () => {
    render(<AnalysisEngagementCell cell={REEL_REACH_CELL} denominator="REACH" />);
    const container = screen.getByRole("img");
    expect(container).toHaveAccessibleName("4.1 percent of 482,100 views");
  });
});

describe("AnalysisEngagementCell — AC-16, the reach kind word is mandatory and matches the stored kind", () => {
  it("a PLAYS row renders the word 'plays' and the string 'views' appears nowhere in the cell", () => {
    const { container } = render(<AnalysisEngagementCell cell={PLAYS_REACH_CELL} denominator="REACH" />);
    expect(screen.getByText("of 116.3K plays")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/views/i);
  });

  it("a VIEWS row renders 'views' and never 'plays'", () => {
    const { container } = render(<AnalysisEngagementCell cell={REEL_REACH_CELL} denominator="REACH" />);
    expect(screen.getByText("of 482.1K views")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/plays/i);
  });

  it("an UNKNOWN reachKind row never fabricates 'views' or 'plays' — renders the honest absent dash instead", () => {
    const { container } = render(<AnalysisEngagementCell cell={UNKNOWN_KIND_REACH_CELL} denominator="REACH" />);
    expect(container.textContent).not.toMatch(/views/i);
    expect(container.textContent).not.toMatch(/plays/i);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("AnalysisEngagementCell — number and denominator announce in one phrase, not two detached fragments", () => {
  it("the accessible name combines percent and denominator into a single phrase", () => {
    render(<AnalysisEngagementCell cell={REEL_REACH_CELL} denominator="REACH" />);
    expect(screen.getByRole("img")).toHaveAccessibleName("4.1 percent of 482,100 views");
  });

  it("the follower-denominated accessible phrase also reads as one phrase, marked approximate", () => {
    render(<AnalysisEngagementCell cell={FOLLOWER_CELL} denominator="FOLLOWERS" />);
    expect(screen.getByRole("img")).toHaveAccessibleName("approximately 16.2 percent of 284,000 followers");
  });
});

describe("AnalysisEngagementCell — R-D3, the video-bearing carousel's first-slide-derived reach", () => {
  it("appends '· first slide only' to the qualifier and never reads as an unqualified per-post reach", () => {
    render(<AnalysisEngagementCell cell={FIRST_SLIDE_ONLY_CELL} denominator="REACH" />);
    expect(screen.getByText("of 88.2K views · first slide only")).toBeInTheDocument();
    expect(screen.queryByText("of 88.2K views")).not.toBeInTheDocument();
  });

  it("a normal top-level reach figure never carries the first-slide-only suffix", () => {
    render(<AnalysisEngagementCell cell={REEL_REACH_CELL} denominator="REACH" />);
    expect(screen.queryByText(/first slide only/)).not.toBeInTheDocument();
  });
});

describe("AnalysisEngagementCell — the other column's reason, never a blank", () => {
  it("renders the plain-language reason text for the 'reason' kind", () => {
    render(<AnalysisEngagementCell cell={REASON_CELL} denominator="REACH" />);
    expect(screen.getByText("not published for image posts")).toBeInTheDocument();
  });

  it("renders an honest dash for the 'dash' kind (no performance data for this row at all)", () => {
    render(<AnalysisEngagementCell cell={{ kind: "dash" }} denominator="REACH" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
