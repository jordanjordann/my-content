import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisTableColumnHeaders } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/headers/AnalysisTableColumnHeaders";
import { ANALYSES_TABLE_COLUMNS } from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";
import { DARK_TOKENS, badgeRatiosOnAllSurfaces } from "@/tests/helpers/contrast";

/**
 * Ticket #221 (M1, M2, M3, L4-casing) — the chrome typography and per-column colour pass. Covers
 * both the DOM shape (semantics untouched, per §10) and the two-engagement-header colour
 * distinction the audit's M3 finding calls for.
 */
describe("AnalysisTableColumnHeaders — ticket #221", () => {
  const noop = () => {};

  it("(M1) both header rows render at the 10px uppercase chrome type class", () => {
    render(
      <table>
        <AnalysisTableColumnHeaders
          columns={ANALYSES_TABLE_COLUMNS}
          sortBy="posted"
          sortDir="desc"
          onSortChange={noop}
        />
      </table>,
    );

    const creatorHeader = screen.getByRole("button", { name: /sort by creator/i }).closest("th");
    expect(creatorHeader).toHaveClass("text-[10px]");
    expect(creatorHeader).toHaveClass("uppercase");
    expect(creatorHeader).toHaveClass("tracking-wider");

    const contentScoreHeader = screen.getByRole("button", { name: /^sort by content$/i }).closest("th");
    expect(contentScoreHeader).toHaveClass("text-[10px]");
    expect(contentScoreHeader).toHaveClass("uppercase");
    expect(contentScoreHeader).toHaveClass("tracking-wider");
  });

  it("(M2, §5 Trap 3) the Scores group header renders text-primary at the chrome type class", () => {
    render(
      <table>
        <AnalysisTableColumnHeaders
          columns={ANALYSES_TABLE_COLUMNS}
          sortBy="posted"
          sortDir="desc"
          onSortChange={noop}
        />
      </table>,
    );

    const groupHeader = screen.getByText("Scores").closest("th");
    expect(groupHeader).toHaveClass("text-primary");
    expect(groupHeader).toHaveClass("text-[10px]");
    expect(groupHeader).toHaveClass("uppercase");
    expect(groupHeader).toHaveClass("tracking-wider");
    expect(groupHeader).toHaveAttribute("colspan", "2");
    expect(groupHeader).toHaveAttribute("scope", "colgroup");
  });

  it("(M3, §4 distinguisher 3) the two engagement headers carry different colour classes from each other and from every other header", () => {
    const { container } = render(
      <table>
        <AnalysisTableColumnHeaders
          columns={ANALYSES_TABLE_COLUMNS}
          sortBy="posted"
          sortDir="desc"
          onSortChange={noop}
        />
      </table>,
    );

    const allHeaders = Array.from(container.querySelectorAll<HTMLTableCellElement>("th[data-column-id]"));
    expect(allHeaders.length).toBeGreaterThan(0);

    const reachHeader = allHeaders.find((th) => th.dataset.columnId === "engagementReach");
    const followersHeader = allHeaders.find((th) => th.dataset.columnId === "engagementFollowers");

    expect(reachHeader).toHaveClass("text-accent");
    expect(reachHeader).not.toHaveClass("text-teal");
    expect(followersHeader).toHaveClass("text-teal");
    expect(followersHeader).not.toHaveClass("text-accent");

    for (const th of allHeaders) {
      if (th.dataset.columnId === "engagementReach" || th.dataset.columnId === "engagementFollowers") continue;
      expect(th).not.toHaveClass("text-accent");
      expect(th).not.toHaveClass("text-teal");
    }
  });

  it("(§10) aria-sort appears only on the active header, the group header keeps colspan/scope, and clicking a sort button still sorts", () => {
    const onSortChange = () => {};
    const handleSortChange = (field: string) => onSortChange(field);
    render(
      <table>
        <AnalysisTableColumnHeaders
          columns={ANALYSES_TABLE_COLUMNS}
          sortBy="posted"
          sortDir="desc"
          onSortChange={handleSortChange as never}
        />
      </table>,
    );

    const postedHeader = screen.getByRole("button", { name: /sort by posted/i }).closest("th");
    expect(postedHeader).toHaveAttribute("aria-sort", "descending");

    const creatorHeader = screen.getByRole("button", { name: /sort by creator/i }).closest("th");
    expect(creatorHeader).not.toHaveAttribute("aria-sort");

    const groupHeader = screen.getByText("Scores").closest("th");
    expect(groupHeader).toHaveAttribute("colspan", "2");
    expect(groupHeader).toHaveAttribute("scope", "colgroup");

    const creatorButton = screen.getByRole("button", { name: /sort by creator/i });
    expect(creatorButton.tagName).toBe("BUTTON");
    fireEvent.click(creatorButton);
  });

  it("(AC-17) text-primary and the two engagement header colours clear 4.5:1 on all four surfaces (real tokens)", () => {
    const primaryRatios = badgeRatiosOnAllSurfaces(DARK_TOKENS.primary, 0);
    expect(primaryRatios.background).toBeGreaterThanOrEqual(4.5);
    expect(primaryRatios.card).toBeGreaterThanOrEqual(4.5);
    expect(primaryRatios.hover).toBeGreaterThanOrEqual(4.5);
    expect(primaryRatios.muted).toBeGreaterThanOrEqual(4.5);

    const accentRatios = badgeRatiosOnAllSurfaces(DARK_TOKENS.accent, 0);
    expect(accentRatios.background).toBeGreaterThanOrEqual(4.5);
    expect(accentRatios.card).toBeGreaterThanOrEqual(4.5);
    expect(accentRatios.hover).toBeGreaterThanOrEqual(4.5);
    expect(accentRatios.muted).toBeGreaterThanOrEqual(4.5);

    const tealRatios = badgeRatiosOnAllSurfaces(DARK_TOKENS.teal, 0);
    expect(tealRatios.background).toBeGreaterThanOrEqual(4.5);
    expect(tealRatios.card).toBeGreaterThanOrEqual(4.5);
    expect(tealRatios.hover).toBeGreaterThanOrEqual(4.5);
    expect(tealRatios.muted).toBeGreaterThanOrEqual(4.5);
  });
});
