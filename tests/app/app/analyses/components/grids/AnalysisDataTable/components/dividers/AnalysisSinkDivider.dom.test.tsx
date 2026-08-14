import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisSinkDivider } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/dividers/AnalysisSinkDivider";

/**
 * Ticket #221 (L4-casing) — the sink divider moves to the §9/mockup chrome type class. The
 * label STRING is unchanged (audit's own correction to L4 — the count and the "— sorted
 * separately" wording are already correct); this test pins the exact byte-identical string so
 * the casing change cannot quietly become a wording change.
 */
describe("AnalysisSinkDivider — ticket #221 (L4-casing)", () => {
  it("renders the exact, byte-identical label string production builds today (AnalysisDataTable.tsx's scoreless template)", () => {
    render(
      <table>
        <tbody>
          <AnalysisSinkDivider label="3 posts with no performance score — sorted separately" colSpan={9} />
        </tbody>
      </table>,
    );

    expect(
      screen.getByText("3 posts with no performance score — sorted separately"),
    ).toBeInTheDocument();
  });

  it("renders at the §9/mockup chrome type class", () => {
    render(
      <table>
        <tbody>
          <AnalysisSinkDivider label="3 posts with no performance score — sorted separately" colSpan={9} />
        </tbody>
      </table>,
    );

    const label = screen.getByText("3 posts with no performance score — sorted separately");
    expect(label).toHaveClass("text-[10.5px]");
    expect(label).toHaveClass("uppercase");
    expect(label).toHaveClass("tracking-wider");
  });
});
