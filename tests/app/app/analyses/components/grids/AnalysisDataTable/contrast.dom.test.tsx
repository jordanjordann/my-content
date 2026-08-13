import { describe, expect, it } from "vitest";

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
