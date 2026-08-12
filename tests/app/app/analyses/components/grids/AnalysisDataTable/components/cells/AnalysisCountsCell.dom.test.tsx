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
        absentCountReason="CREATOR_DISABLED"
        comfortable={false}
      />,
    );
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.queryByText("Creator turned off counts")).not.toBeInTheDocument();
  });
});
