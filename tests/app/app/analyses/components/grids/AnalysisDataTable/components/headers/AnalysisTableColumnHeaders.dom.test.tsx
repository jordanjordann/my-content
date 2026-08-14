import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisTableColumnHeaders } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/headers/AnalysisTableColumnHeaders";
import { ANALYSES_TABLE_COLUMNS } from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";
import type { AnalysesSortField } from "@/lib/api/analyses/types";
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

  it("(M3, §4 distinguisher 3) the two engagement headers carry different colour classes from each other and from every other header, IDLE state", () => {
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

    // `headerColorClassName` lands on both the `<th>` (the column-field mechanism, unchanged)
    // and, per the owner's ruling below, directly on the `<button>` itself — the element that
    // actually renders the text a user reads.
    expect(reachHeader).toHaveClass("text-accent");
    expect(reachHeader).not.toHaveClass("text-teal");
    expect(reachHeader?.querySelector("button")).toHaveClass("text-accent");
    expect(followersHeader).toHaveClass("text-teal");
    expect(followersHeader).not.toHaveClass("text-accent");
    expect(followersHeader?.querySelector("button")).toHaveClass("text-teal");

    for (const th of allHeaders) {
      if (th.dataset.columnId === "engagementReach" || th.dataset.columnId === "engagementFollowers") continue;
      expect(th).not.toHaveClass("text-accent");
      expect(th).not.toHaveClass("text-teal");
    }
  });

  it("(M3, PR #229 blocker 1) HOVER state — the owner's ruling keeps the engagement header colour on the button, no text-foreground swap", () => {
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

    const reachButton = container.querySelector<HTMLButtonElement>('th[data-column-id="engagementReach"] button');
    // Owner's ruling: "The engagement column-header colour must be kept in ALL states — idle,
    // hover, and active-sort." jsdom applies no stylesheet, so real `:hover` cannot be triggered
    // or observed here — this asserts the STATIC class list the button carries, which is what
    // determines the rendered colour in a browser. For an engagement (colour-carrying) column,
    // the button no longer carries `hover:text-foreground` at all, so there is no competing
    // `color` for `:hover` to introduce — `text-accent` is the button's own unconditional class.
    expect(reachButton).toHaveClass("text-accent");
    expect(reachButton).not.toHaveClass("hover:text-foreground");
  });

  it("(M3, PR #229 blocker 1) ACTIVE-SORT state — sorting by an engagement column keeps its header colour on the button", () => {
    const { container } = render(
      <table>
        <AnalysisTableColumnHeaders
          columns={ANALYSES_TABLE_COLUMNS}
          sortBy="engagementReach"
          sortDir="desc"
          onSortChange={noop}
        />
      </table>,
    );

    const reachButton = container.querySelector<HTMLButtonElement>('th[data-column-id="engagementReach"] button');
    // Owner's ruling (resolves PR #229 blocker 1): the engagement header colour is kept in ALL
    // states, including active-sort. The button no longer sets its own `active && "text-foreground"`
    // for a colour-carrying column, so `text-accent` — now the button's own unconditional class,
    // not just an inherited one — renders instead of being overridden. The active-sort direction
    // arrow (`ArrowUp`/`ArrowDown`) remains the sort affordance for this state, since
    // `text-foreground` is dropped as a competing colour for these two columns only.
    expect(reachButton).toHaveClass("text-accent");
    expect(reachButton).not.toHaveClass("text-foreground");
    const reachHeader = container.querySelector('th[data-column-id="engagementReach"]');
    expect(reachHeader).toHaveClass("text-accent");
  });

  it("(M3, PR #229 blocker 1) non-engagement headers keep their existing hover/active text-foreground behaviour, unaffected", () => {
    const { container } = render(
      <table>
        <AnalysisTableColumnHeaders
          columns={ANALYSES_TABLE_COLUMNS}
          sortBy="creator"
          sortDir="asc"
          onSortChange={noop}
        />
      </table>,
    );

    const creatorButton = container.querySelector<HTMLButtonElement>('th[data-column-id="creator"] button');
    expect(creatorButton).toHaveClass("hover:text-foreground");
    expect(creatorButton).toHaveClass("text-foreground");
    expect(creatorButton).not.toHaveClass("text-accent");
    expect(creatorButton).not.toHaveClass("text-teal");

    const postedButton = container.querySelector<HTMLButtonElement>('th[data-column-id="posted"] button');
    expect(postedButton).toHaveClass("hover:text-foreground");
    expect(postedButton).not.toHaveClass("text-foreground");
  });

  it("(§10) aria-sort appears only on the active header, the group header keeps colspan/scope, and clicking a sort button still sorts", () => {
    const sortEvents: AnalysesSortField[] = [];
    const handleSortChange = (field: AnalysesSortField) => sortEvents.push(field);
    render(
      <table>
        <AnalysisTableColumnHeaders
          columns={ANALYSES_TABLE_COLUMNS}
          sortBy="posted"
          sortDir="desc"
          onSortChange={handleSortChange}
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
    expect(sortEvents).toEqual(["creator"]);
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
