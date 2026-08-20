import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisTableColumnHeaders } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/headers/AnalysisTableColumnHeaders";
import { ANALYSES_TABLE_COLUMNS } from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";
import { DARK_TOKENS, badgeRatiosOnAllSurfaces } from "@/tests/helpers/contrast";

/**
 * Ticket #221 (M1, M2, M3, L4-casing) — the chrome typography and per-column colour pass. Covers
 * both the DOM shape (semantics untouched, per §10) and the two-engagement-header colour
 * distinction the audit's M3 finding calls for.
 *
 * #266 (2026-08-20 owner ruling, DESIGN-3C amendment A10) removed sorting entirely: every header
 * is now plain, non-interactive text — no sort `<button>`, no `aria-sort`, no direction arrow, no
 * hover/active-sort colour swap. Every test below that asserted sort affordances is deleted; the
 * colour, contrast, and tooltip-trigger tests are kept/rewritten against the static-text shape.
 */
describe("AnalysisTableColumnHeaders — ticket #221", () => {
  it("(M1) both header rows render at the 10px uppercase chrome type class", () => {
    render(
      <table>
        <AnalysisTableColumnHeaders columns={ANALYSES_TABLE_COLUMNS} />
      </table>,
    );

    const creatorHeader = screen.getByText("Creator").closest("th");
    expect(creatorHeader).toHaveClass("text-[10px]");
    expect(creatorHeader).toHaveClass("uppercase");
    expect(creatorHeader).toHaveClass("tracking-wider");

    const contentScoreHeader = document
      .querySelector('th[data-column-id="contentScore"]');
    expect(contentScoreHeader).toHaveClass("text-[10px]");
    expect(contentScoreHeader).toHaveClass("uppercase");
    expect(contentScoreHeader).toHaveClass("tracking-wider");
  });

  it("(M2, §5 Trap 3) the Scores group header renders text-primary at the chrome type class", () => {
    render(
      <table>
        <AnalysisTableColumnHeaders columns={ANALYSES_TABLE_COLUMNS} />
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

  it("(M3, §4 distinguisher 3, DESIGN-3C amendment A10 R-D18) the two engagement headers carry different colour classes from each other and from every other header — unconditionally, since there is no interactive state left to compete with it", () => {
    const { container } = render(
      <table>
        <AnalysisTableColumnHeaders columns={ANALYSES_TABLE_COLUMNS} />
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

  it("(M3, DESIGN-3C amendment A10) no header is interactive — no <button> exists for a column label, no aria-sort anywhere", () => {
    render(
      <table>
        <AnalysisTableColumnHeaders columns={ANALYSES_TABLE_COLUMNS} />
      </table>,
    );

    // The engagement headers still carry their own tooltip-trigger <button> (kept below); no
    // OTHER column may render a <button> for its label now that sorting is gone.
    for (const column of ANALYSES_TABLE_COLUMNS) {
      if (column.id === "engagementReach" || column.id === "engagementFollowers") continue;
      const th = document.querySelector(`th[data-column-id="${column.id}"]`);
      expect(th?.querySelector("button")).toBeNull();
    }

    expect(document.querySelector("[aria-sort]")).toBeNull();
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
 * Ticket #223 (3C-F4, DESIGN-3C §4.2 amendment A6), preserved unchanged by amendment A10 — the
 * two engagement column-header tooltip triggers. `AnalysisEngagementHeaderTooltip` itself is
 * unit-tested in full under
 * `tests/.../AnalysisDataTable/components/tooltips/AnalysisEngagementHeaderTooltip/`; this block
 * only covers what requires the REAL `<th>` DOM this file already renders: R-D6's sibling
 * placement (now a sibling of the plain-text label, not a sort button) and R-D12's "no third
 * trigger" count. Both rules are explicitly named as surviving amendment A10's `<th>` restructure
 * (DESIGN-3C-analyses-table.md §6.1 / A10's own text).
 */
describe("AnalysisTableColumnHeaders — ticket #223 (3C-F4) tooltip trigger placement", () => {
  it("(R-D6) engagementReach: label and tooltip trigger are siblings under the same <th>, neither contains the other", () => {
    render(
      <table>
        <AnalysisTableColumnHeaders columns={ANALYSES_TABLE_COLUMNS} />
      </table>,
    );

    const th = document.querySelector('th[data-column-id="engagementReach"]') as HTMLTableCellElement;
    expect(th.querySelectorAll("button")).toHaveLength(1);

    const label = within(th).getByText("Eng. / reach");
    const tooltipTrigger = within(th).getByRole("button", {
      name: "How is engagement against reach worked out?",
    });

    // Sibling, not ancestor/descendant, either direction.
    expect(label.contains(tooltipTrigger)).toBe(false);
    expect(tooltipTrigger.contains(label)).toBe(false);
    expect(label.parentElement).toBe(tooltipTrigger.parentElement);
  });

  it("(R-D6) engagementFollowers: same sibling guarantee", () => {
    render(
      <table>
        <AnalysisTableColumnHeaders columns={ANALYSES_TABLE_COLUMNS} />
      </table>,
    );

    const th = document.querySelector('th[data-column-id="engagementFollowers"]') as HTMLTableCellElement;
    expect(th.querySelectorAll("button")).toHaveLength(1);

    const label = within(th).getByText("Eng. / followers");
    const tooltipTrigger = within(th).getByRole("button", {
      name: "How is engagement against followers worked out?",
    });

    expect(label.contains(tooltipTrigger)).toBe(false);
    expect(tooltipTrigger.contains(label)).toBe(false);
    expect(label.parentElement).toBe(tooltipTrigger.parentElement);
  });

  it("(R-D12) exactly two tooltip triggers exist table-wide, and no other header carries a <button> at all", () => {
    render(
      <table>
        <AnalysisTableColumnHeaders columns={ANALYSES_TABLE_COLUMNS} />
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
        expect(buttonCount).toBe(1);
      } else {
        expect(buttonCount).toBe(0);
      }
    }
  });
});
