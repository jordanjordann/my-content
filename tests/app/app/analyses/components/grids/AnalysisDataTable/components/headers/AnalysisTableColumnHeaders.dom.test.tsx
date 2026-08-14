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

    // `headerColorClassName` lands on the `<th>`, not the `<button>` — the button never carries
    // `text-accent`/`text-teal` as its own class; it renders that colour by CSS INHERITANCE from
    // its `<th>` ancestor, because the button's own `className` sets no `color` when idle
    // (`active` is `false` and `:hover` is not engaged). PR #229 review, blocker 1: asserting
    // only the `<th>` cannot see that this inheritance is exactly what the hover/active-sort
    // states below defeat — the button DOES set its own `color` in those states, and an
    // element's own explicit colour always wins over an inherited one. This test asserts the
    // element that actually carries the colour source (`<th>`) AND confirms the button sets no
    // competing colour of its own here, which is what makes the inherited colour the one that
    // renders.
    expect(reachHeader).toHaveClass("text-accent");
    expect(reachHeader).not.toHaveClass("text-teal");
    expect(reachHeader?.querySelector("button")).not.toHaveClass("text-foreground");
    expect(followersHeader).toHaveClass("text-teal");
    expect(followersHeader).not.toHaveClass("text-accent");
    expect(followersHeader?.querySelector("button")).not.toHaveClass("text-foreground");

    for (const th of allHeaders) {
      if (th.dataset.columnId === "engagementReach" || th.dataset.columnId === "engagementFollowers") continue;
      expect(th).not.toHaveClass("text-accent");
      expect(th).not.toHaveClass("text-teal");
    }
  });

  it("(M3, §4 distinguisher 3) HOVER state — the button carries hover:text-foreground alongside its column colour", () => {
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

    const reachHeader = container.querySelector('th[data-column-id="engagementReach"]');
    const reachButton = container.querySelector<HTMLButtonElement>('th[data-column-id="engagementReach"] button');
    // jsdom applies no stylesheet, so `:hover` cannot be triggered or observed here — this only
    // asserts the STATIC class the button carries, which is what determines the real, rendered
    // hover colour in a browser. `hover:text-foreground` is present on EVERY sortable header's
    // button, unconditionally (it is not new to this ticket) — on real mouse-over it sets the
    // button's own `color`, which then wins over the colour it otherwise inherits from the `<th>`
    // (`text-accent` here), because inheritance only applies where the descendant sets no
    // explicit value of its own. See the PR body / handoff report for why this is left
    // unresolved rather than "fixed" — DESIGN-3C and the TDD do not say what an engagement
    // header should look like on hover, and inventing an answer here would not be implementing
    // the ticket.
    expect(reachHeader).toHaveClass("text-accent");
    expect(reachButton).toHaveClass("hover:text-foreground");
  });

  it("(M3, §4 distinguisher 3) ACTIVE-SORT state — sorting by an engagement column currently drops its header colour (spec gap, unresolved — see PR body)", () => {
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
    // Pins TODAY's actual, unchanged behaviour: `active && "text-foreground"` is the button's own
    // explicit `color`, which wins over the `<th>`'s inherited `text-accent` regardless of source
    // order, because CSS inheritance only applies where a descendant sets no explicit value of
    // its own. This is the exact defect the review flagged — the header stops reading as
    // reach-denominated at the one moment (active sort) that distinction matters most (R6). No
    // design doc rules on the wanted hover/active-sort behaviour for a colour-coded header, so
    // this test intentionally documents the current state rather than asserting a fix that was
    // never specified. Do not read this as "correct" — it is a pinned baseline pending an owner
    // ruling, tracked as a follow-up on ticket #221.
    expect(reachButton).toHaveClass("text-foreground");
    // `<th>` itself still carries the field-driven colour — the mechanism (M3) is intact; only
    // the RENDERED colour of the text a user reads is affected, because the button's own
    // explicit `text-foreground` overrides the `text-accent` it would otherwise inherit from its
    // `<th>` ancestor. The button never carries `text-accent` as its own class in any state —
    // idle or active — so `<th>` is the only element that ever names the colour; whether that
    // colour actually renders depends on whether a descendant sets its own competing `color`.
    const reachHeader = container.querySelector('th[data-column-id="engagementReach"]');
    expect(reachHeader).toHaveClass("text-accent");
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
