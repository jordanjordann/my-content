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

    // PR #229 re-review blocker A — R-D19 (the hover underline) was rejected on the premise that
    // the focus-visible ring and the active-sort arrow remain the only sort affordances on these
    // two headers. Pin the ring here so a later class-string tidy-up cannot silently drop it.
    expect(reachButton).toHaveClass("focus-visible:ring-2");
    expect(reachButton).toHaveClass("focus-visible:ring-ring");
    // Idle (not the active-sort column here — sortBy="posted"): no direction arrow rendered.
    expect(reachButton?.querySelector("svg")).toBeNull();
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

    // PR #229 re-review blocker A — same guard as the HOVER test, in the active-sort state: the
    // focus-visible ring and the direction arrow are the only surviving sort affordances on this
    // colour-carrying column (R-D19 rejected the hover underline on the premise both remain).
    expect(reachButton).toHaveClass("focus-visible:ring-2");
    expect(reachButton).toHaveClass("focus-visible:ring-ring");
    expect(reachButton?.querySelector("svg")).not.toBeNull();
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

/**
 * Ticket #223 (3C-F4, DESIGN-3C §4.2 amendment A6) — the two engagement column-header
 * tooltip triggers. `AnalysisEngagementHeaderTooltip` itself is unit-tested in full under
 * `tests/.../AnalysisDataTable/components/tooltips/AnalysisEngagementHeaderTooltip/`; this block only
 * covers what requires the REAL `<th>` DOM this file already renders: R-D6's sibling
 * placement (not nested inside the sort button) and R-D12's "no third trigger" count.
 */
describe("AnalysisTableColumnHeaders — ticket #223 (3C-F4) tooltip trigger placement", () => {
  const noop = () => {};

  it("(R-D6) engagementReach: sort button and tooltip trigger are siblings under the same <th>, neither contains the other", () => {
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

    const th = document.querySelector('th[data-column-id="engagementReach"]') as HTMLTableCellElement;
    const buttons = Array.from(th.querySelectorAll("button"));
    expect(buttons).toHaveLength(2);

    const sortButton = buttons.find((btn) => /^sort by eng\. \/ reach/i.test(btn.getAttribute("aria-label") ?? ""));
    const tooltipTrigger = buttons.find(
      (btn) => btn.getAttribute("aria-label") === "How is engagement against reach worked out?",
    );
    expect(sortButton).toBeDefined();
    expect(tooltipTrigger).toBeDefined();

    // Sibling, not ancestor/descendant, either direction.
    expect(sortButton?.contains(tooltipTrigger as Node)).toBe(false);
    expect(tooltipTrigger?.contains(sortButton as Node)).toBe(false);
    expect(sortButton?.parentElement).toBe(tooltipTrigger?.parentElement);

    // Clicking the sort button sorts; it does not open the tooltip.
    fireEvent.click(sortButton as HTMLButtonElement);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("(R-D6) engagementFollowers: same sibling guarantee", () => {
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

    const th = document.querySelector('th[data-column-id="engagementFollowers"]') as HTMLTableCellElement;
    const buttons = Array.from(th.querySelectorAll("button"));
    expect(buttons).toHaveLength(2);

    const sortButton = buttons.find((btn) =>
      /^sort by eng\. \/ followers/i.test(btn.getAttribute("aria-label") ?? ""),
    );
    const tooltipTrigger = buttons.find(
      (btn) => btn.getAttribute("aria-label") === "How is engagement against followers worked out?",
    );
    expect(sortButton).toBeDefined();
    expect(tooltipTrigger).toBeDefined();
    expect(sortButton?.contains(tooltipTrigger as Node)).toBe(false);
    expect(tooltipTrigger?.contains(sortButton as Node)).toBe(false);
    expect(sortButton?.parentElement).toBe(tooltipTrigger?.parentElement);
  });

  it("(R-D12) exactly two tooltip triggers exist table-wide, and every other header's <th> has exactly one button", () => {
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

    const tooltipTriggerNames = [
      "How is engagement against reach worked out?",
      "How is engagement against followers worked out?",
    ];
    for (const name of tooltipTriggerNames) {
      expect(screen.getAllByRole("button", { name })).toHaveLength(1);
    }

    const allHeaders = Array.from(document.querySelectorAll<HTMLTableCellElement>("th[data-column-id]"));
    for (const th of allHeaders) {
      const buttonCount = th.querySelectorAll("button").length;
      if (th.dataset.columnId === "engagementReach" || th.dataset.columnId === "engagementFollowers") {
        expect(buttonCount).toBe(2);
      } else if (th.dataset.columnId === "creator" || th.dataset.columnId === "posted") {
        // sanity check on a couple of ordinary sortable columns
        expect(buttonCount).toBe(1);
      }
    }
  });

  it("(R-D8) the sort button's own accessible name and aria-sort behaviour are unaffected by the tooltip trigger", () => {
    render(
      <table>
        <AnalysisTableColumnHeaders
          columns={ANALYSES_TABLE_COLUMNS}
          sortBy="engagementFollowers"
          sortDir="asc"
          onSortChange={noop}
        />
      </table>,
    );

    const th = document.querySelector('th[data-column-id="engagementFollowers"]') as HTMLTableCellElement;
    expect(th).toHaveAttribute("aria-sort", "ascending");
    expect(
      screen.getByRole("button", { name: "Sort by Eng. / followers, currently ascending" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "How is engagement against followers worked out?" }),
    ).toBeInTheDocument();
  });
});
