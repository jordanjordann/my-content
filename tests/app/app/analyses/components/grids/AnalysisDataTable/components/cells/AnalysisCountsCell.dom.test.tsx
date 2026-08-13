import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisCountsCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisCountsCell";

/**
 * Ticket #146 / OR-11 — the Counts cell's absent-count reason. The `"unknown"` `CountState`
 * (a bare `—`) must never render alone; it is always followed by one of OR-11's three-case
 * reasons. Case 1 (`CREATOR_DISABLED`) is structurally unreachable from this branch — a `true`
 * disabled flag always classifies as `"hidden"`, not `"unknown"` — verified by a negative
 * assertion below.
 */
describe("AnalysisCountsCell — OR-11's three-case absent-count reason", () => {
  it("TYPE_NOT_REPORTED renders beside the bare '—', never blank", () => {
    render(
      <AnalysisCountsCell
        reachCountState={{ kind: "unknown" }}
        likeCountState={{ kind: "unknown" }}
        commentCountState={{ kind: "unknown" }}
        absentCountReason="TYPE_NOT_REPORTED"
        comfortable={false}
      />,
    );
    expect(screen.getByText("This post type doesn't report counts")).toBeInTheDocument();
  });

  it("NOT_AVAILABLE (the mandatory non-fallback default) renders its own distinct string, never the creator-disabled sentence", () => {
    render(
      <AnalysisCountsCell
        reachCountState={{ kind: "unknown" }}
        likeCountState={{ kind: "unknown" }}
        commentCountState={{ kind: "unknown" }}
        absentCountReason="NOT_AVAILABLE"
        comfortable={false}
      />,
    );
    expect(screen.getByText("Counts weren't available")).toBeInTheDocument();
    expect(screen.queryByText(/turned off/i)).not.toBeInTheDocument();
  });

  it("a genuine zero renders '0' with no reason text appended — a real measured value needs no explanation", () => {
    render(
      <AnalysisCountsCell
        reachCountState={{ kind: "zero" }}
        likeCountState={{ kind: "zero" }}
        commentCountState={{ kind: "zero" }}
        absentCountReason="NOT_AVAILABLE"
        comfortable={false}
      />,
    );
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("Counts weren't available")).not.toBeInTheDocument();
  });

  it("the hidden state (case 1) shows 'Hidden' with its own tooltip trigger, not OR-11's short reason text", () => {
    render(
      <AnalysisCountsCell
        reachCountState={{ kind: "hidden" }}
        likeCountState={{ kind: "hidden" }}
        commentCountState={{ kind: "hidden" }}
        absentCountReason="CREATOR_DISABLED"
        comfortable={false}
      />,
    );
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.queryByText("Creator turned off counts")).not.toBeInTheDocument();
  });
});

/**
 * Ticket #205 — the comfortable-density likes-line's comment figure. Previously a hardcoded,
 * `aria-hidden="true"` em-dash (`AnalysisCountsCell.tsx:32`) that rendered identically on every
 * row regardless of data. `commentCountState` is now threaded through from
 * `performance.computed.comments` (`classifyCommentCountState`, `lib/api/analyses/helpers.ts`)
 * exactly like `reachCountState` is threaded from `performance.computed.reach` — asserted here
 * via the accessibility tree (`getByRole`/accessible name), not `getByText`, because `getByText`
 * does not respect `aria-hidden` and is exactly what let the original hardcoded dash pass review.
 */
describe("AnalysisCountsCell — ticket #205's comment count", () => {
  it("a real, present comment count renders the actual abbreviated figure on the likes line, reachable by its own accessible text", () => {
    const { container } = render(
      <AnalysisCountsCell
        reachCountState={{ kind: "count", value: 500_000 }}
        likeCountState={{ kind: "count", value: 31_400 }}
        commentCountState={{ kind: "count", value: 1_200 }}
        absentCountReason="NOT_AVAILABLE"
        comfortable
      />,
    );

    // The exact shipped abbreviation (`formatAbbrev`, EngagementCount/helpers.ts):
    // 1_200 -> "1.2K". Asserted as a real, non-`aria-hidden` text node — `getByText` only
    // matches nodes actually reachable in the rendered tree's plain content.
    const commentFigure = screen.getByText("1.2K");
    expect(commentFigure).toBeInTheDocument();
    expect(commentFigure.closest('[aria-hidden="true"]')).toBeNull();

    // Full likes-line text, proving the middot separates two real values, not a dangling
    // dash — matches the issue's own worked example ("31.4K · 1.2K").
    expect(container.textContent).toContain("31.4K · 1.2K");

    // The old hardcoded placeholder must be gone entirely.
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("an absent comment count (state UNKNOWN) announces 'comments unknown' via role=img, not a bare unlabelled dash", () => {
    render(
      <AnalysisCountsCell
        reachCountState={{ kind: "count", value: 500_000 }}
        likeCountState={{ kind: "count", value: 31_400 }}
        commentCountState={{ kind: "unknown" }}
        absentCountReason="NOT_AVAILABLE"
        comfortable
      />,
    );

    // `getByRole` walks the accessibility tree — an `aria-hidden="true"` node (the original
    // defect) is excluded from it entirely, so this assertion would fail exactly the way the
    // shipped bug should have been caught.
    const commentFigure = screen.getByRole("img", { name: "comments unknown" });
    expect(commentFigure).toBeInTheDocument();
    expect(commentFigure).toHaveTextContent("—");
  });
});
