import { existsSync } from "node:fs";
import path from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisGridSkeleton } from "@/app/app/analyses/components/grids/AnalysisGridSkeleton";

/**
 * Ticket #149 / TDD §9.8, DESIGN-3C §12, RUNBOOK §8.5 — `AnalysisGrid` and `AnalysisCard` are
 * confirmed dead code and are deleted by this ticket. `AnalysisGridSkeleton` is a DIFFERENT,
 * live module and must survive, despite the similar name.
 */
describe("dead-code deletion (ticket #149)", () => {
  it("AnalysisGrid's module directory no longer exists", () => {
    const dir = path.join(process.cwd(), "app/app/analyses/components/grids/AnalysisGrid");
    expect(existsSync(dir)).toBe(false);
  });

  it("AnalysisCard's module directory no longer exists", () => {
    const dir = path.join(process.cwd(), "app/app/analyses/components/cards/AnalysisCard");
    expect(existsSync(dir)).toBe(false);
  });

  it("AnalysisGridSkeleton's module directory still exists (NOT deleted by association)", () => {
    const dir = path.join(process.cwd(), "app/app/analyses/components/grids/AnalysisGridSkeleton");
    expect(existsSync(dir)).toBe(true);
  });

  it("AnalysisGridSkeleton still renders real skeleton content", () => {
    render(<AnalysisGridSkeleton />);
    // Real behavioural assertion, not just "the import succeeded" — three shimmer
    // placeholders, matching the component's own `Array.from({ length: 3 })`.
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
  });
});
