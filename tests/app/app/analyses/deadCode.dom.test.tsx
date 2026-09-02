import { existsSync, readFileSync } from "node:fs";
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

/**
 * Ticket #323 / TDD-url-error-surfacing.md §7 — the per-chip `chip.error` / `onDismissError`
 * channel (plus its 3s auto-dismiss timer and `Chip.tsx`'s destructive `isError` variant) was
 * dead code: no caller ever set `chip.error` or passed `onDismissError`. Removed after #318
 * replaced it with the component-level `inputError` + `aria-live` region.
 */
describe("dead-code deletion (ticket #323)", () => {
  const chipInputDir = path.join(
    process.cwd(),
    "app/app/analyses/components/chips/UrlChipInput",
  );

  it("types.ts no longer declares onDismissError or a chip-level error field", () => {
    const source = readFileSync(path.join(chipInputDir, "types.ts"), "utf-8");
    expect(source).not.toContain("onDismissError");
    expect(source).not.toContain("error?:");
  });

  it("UrlChipInput.tsx no longer references onDismissError or the auto-dismiss timer", () => {
    const source = readFileSync(path.join(chipInputDir, "UrlChipInput.tsx"), "utf-8");
    expect(source).not.toContain("onDismissError");
    expect(source).not.toContain("chip.error");
  });

  it("Chip.tsx no longer renders the destructive isError variant", () => {
    const source = readFileSync(path.join(chipInputDir, "Chip.tsx"), "utf-8");
    expect(source).not.toContain("isError");
    expect(source).not.toContain("chip.error");
    expect(source).not.toContain("bg-destructive/10");
  });
});
