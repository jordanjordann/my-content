import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisEngagementCell } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisEngagementCell";
import type { AnalysisTableEngagementCell } from "@/lib/api/analyses/types";
import {
  DARK_TOKENS,
  badgeRatiosOnAllSurfaces,
  hexToSrgb255,
} from "@/tests/helpers/contrast";

/**
 * Issue #132 — automated contrast-regression guard, added on ticket #149 (this error class has
 * shipped non-compliant twice, RUNBOOK §8.4). Every ratio here is ≥ 4.5:1 by construction (the
 * WCAG AA floor for this table's text); a future colour/opacity change that drops any of these
 * below the floor now fails a real test instead of only a PR-body claim nobody re-checks.
 */
describe("contrast — ticket #149's new badges, real dark tokens, §8.4.6 method", () => {
  it("canary — bg-primary/12 text-primary on --muted clears 4.5:1 (methodology sanity check)", () => {
    const ratios = badgeRatiosOnAllSurfaces(DARK_TOKENS.primary, 0.12);
    expect(ratios.muted).toBeGreaterThanOrEqual(4.5);
  });

  it("AnalysisContentCell's kind-overlay / mode-chip badge (bg-slate-300/10 text-slate-300) clears 4.5:1 on all four surfaces", () => {
    const slate300 = hexToSrgb255("cbd5e1");
    const ratios = badgeRatiosOnAllSurfaces(slate300, 0.1);
    expect(ratios.background).toBeGreaterThanOrEqual(4.5);
    expect(ratios.card).toBeGreaterThanOrEqual(4.5);
    expect(ratios.hover).toBeGreaterThanOrEqual(4.5);
    expect(ratios.muted).toBeGreaterThanOrEqual(4.5);
  });

  it("AnalysisStyleCell's EnumValueBadge (bg-primary/10 text-primary), re-measured on the table's own surfaces, clears 4.5:1", () => {
    const ratios = badgeRatiosOnAllSurfaces(DARK_TOKENS.primary, 0.1);
    expect(ratios.background).toBeGreaterThanOrEqual(4.5);
    expect(ratios.card).toBeGreaterThanOrEqual(4.5);
    expect(ratios.hover).toBeGreaterThanOrEqual(4.5);
    expect(ratios.muted).toBeGreaterThanOrEqual(4.5);
  });

  it("qualifier text (text-muted-foreground, FULL opacity) clears 4.5:1 everywhere — the exact class PR #113 had to patch at /80", () => {
    const ratios = badgeRatiosOnAllSurfaces(DARK_TOKENS.mutedForeground, 0);
    expect(ratios.background).toBeGreaterThanOrEqual(4.5);
    expect(ratios.card).toBeGreaterThanOrEqual(4.5);
    expect(ratios.hover).toBeGreaterThanOrEqual(4.5);
    expect(ratios.muted).toBeGreaterThanOrEqual(4.5);
  });
});

/**
 * Ticket #217 (M4, L2) — DESIGN-3C §9.2 puts the reach/follower colour on the QUALIFIER line,
 * not the value line. Ratios below are computed from `DARK_TOKENS.accent`/`.teal`, which
 * `tests/helpers/contrast.ts` PARSES LIVE out of the real `.dark { ... }` block in
 * `app/globals.css` at module load — not a hand-copied fixture, and not the hex the design doc
 * names. Changing either token in `globals.css` changes what these assertions measure.
 */
describe("contrast — ticket #217, engagement qualifier colour (M4 inversion fix, L2 teal token)", () => {
  it("reach-denominated qualifier (text-accent, FULL opacity) clears 4.5:1 on all four surfaces", () => {
    const ratios = badgeRatiosOnAllSurfaces(DARK_TOKENS.accent, 0);
    expect(ratios.background).toBeGreaterThanOrEqual(4.5);
    expect(ratios.card).toBeGreaterThanOrEqual(4.5);
    expect(ratios.hover).toBeGreaterThanOrEqual(4.5);
    expect(ratios.muted).toBeGreaterThanOrEqual(4.5);
  });

  it("follower-denominated qualifier (text-teal, FULL opacity) clears 4.5:1 on all four surfaces", () => {
    const ratios = badgeRatiosOnAllSurfaces(DARK_TOKENS.teal, 0);
    expect(ratios.background).toBeGreaterThanOrEqual(4.5);
    expect(ratios.card).toBeGreaterThanOrEqual(4.5);
    expect(ratios.hover).toBeGreaterThanOrEqual(4.5);
    expect(ratios.muted).toBeGreaterThanOrEqual(4.5);
  });
});

/**
 * Ticket #217 (M4) — the DOM assertion that would have caught the inversion in the first
 * place: the QUALIFIER element carries the colour class and the VALUE element does not. A test
 * that only checked "text-accent exists somewhere in the tree" would still pass with the
 * classes swapped back onto the value line; asserting per-element is the only way this fails on
 * a regression.
 */
describe("contrast — ticket #217, colour sits on the qualifier element, not the value element", () => {
  const REACH_CELL: AnalysisTableEngagementCell = {
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

  it("a reach-denominated row: the qualifier ('of 482.1K views') carries text-accent, the value ('4.1%') does not", () => {
    render(<AnalysisEngagementCell cell={REACH_CELL} denominator="REACH" />);
    const value = screen.getByText("4.1%");
    const qualifier = screen.getByText("of 482.1K views");
    // `toHaveClass` matches a class TOKEN (whitespace-split) exactly, unlike a `\btext-accent\b`
    // regex — `\b` matches on both sides of a hyphen, so it would also match `text-accent-500`.
    expect(qualifier).toHaveClass("text-accent");
    // Pins the qualifier's font size — nothing else in this suite asserts it, and this PR also
    // dropped `text-muted-foreground` from the qualifier, so `text-xs` is now the only assertion
    // standing between "quiet, small qualifier line" and a silent regression to `text-sm`.
    expect(qualifier).toHaveClass("text-xs");
    expect(value).not.toHaveClass("text-accent");
    expect(value).toHaveClass("text-foreground");
  });

  it("a follower-denominated row: the qualifier ('of 284K followers') carries text-teal, the value ('≈16.2%') does not", () => {
    render(<AnalysisEngagementCell cell={FOLLOWER_CELL} denominator="FOLLOWERS" />);
    const value = screen.getByText("≈16.2%");
    const qualifier = screen.getByText("of 284.0K followers");
    // Same rationale as above: `toHaveClass` is a token-exact match, so a leftover
    // `text-teal-500` (the old, unmeasured Tailwind class) fails this, unlike a `\b` regex.
    expect(qualifier).toHaveClass("text-teal");
    // See the reach-denominated case above — pins the font size the same way.
    expect(qualifier).toHaveClass("text-xs");
    expect(value).not.toHaveClass("text-teal");
    expect(value).toHaveClass("text-foreground");
  });
});
