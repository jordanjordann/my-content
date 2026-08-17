import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisEngagementCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisEngagementCell";
import type { AnalysisTableEngagementCell } from "@/lib/api/analyses/types";

/**
 * Ticket #223 (3C-F4), R-D5 — the two §4.2 explain triggers are the ONLY explain affordances
 * outside the Performance cell, and they live in the column HEADER, never in a cell. This is
 * a read-only guard against `AnalysisEngagementCell` (owned by ticket #222, NOT modified by
 * this PR) — it must fail if a future change adds a per-cell trigger here.
 */
describe("AnalysisEngagementCell — ticket #223 R-D5 guard", () => {
  const VALUE_CELL: AnalysisTableEngagementCell = {
    kind: "value",
    ratio: 0.041,
    denominator: "REACH",
    reachKind: "VIEWS",
    reachValue: 482_100,
    firstSlideOnly: false,
  };

  const REASON_CELL: AnalysisTableEngagementCell = {
    kind: "reason",
    text: "measured against reach instead",
  };

  const DASH_CELL: AnalysisTableEngagementCell = { kind: "dash" };

  it("(R-D5) a value cell renders no button", () => {
    const { container } = render(<AnalysisEngagementCell cell={VALUE_CELL} denominator="REACH" />);
    expect(container.querySelector("button")).toBeNull();
  });

  it("(R-D5) a reason cell renders no button", () => {
    const { container } = render(<AnalysisEngagementCell cell={REASON_CELL} denominator="FOLLOWERS" />);
    expect(container.querySelector("button")).toBeNull();
  });

  it("(R-D5) a dash cell renders no button", () => {
    const { container } = render(<AnalysisEngagementCell cell={DASH_CELL} denominator="FOLLOWERS" />);
    expect(container.querySelector("button")).toBeNull();
  });
});
