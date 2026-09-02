import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisGridSkeleton } from "@/app/app/analyses/components/grids/AnalysisGridSkeleton";
import { Chip } from "@/app/app/analyses/components/chips/UrlChipInput/Chip";
import type { UrlChip } from "@/app/app/analyses/components/chips/UrlChipInput";

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

  it("types.ts no longer declares onDismissError, and the UrlChip interface has no error field", () => {
    const source = readFileSync(path.join(chipInputDir, "types.ts"), "utf-8");
    expect(source).not.toContain("onDismissError");

    // Scoped to the `UrlChip` interface body specifically (not a whole-file text match), so
    // this can't miss a reintroduction on a *different* interface and can't be fooled by
    // rewording the field without a `?:` (e.g. `error: string | undefined`).
    const match = source.match(/export interface UrlChip \{[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    const urlChipBlock = match![0];
    expect(urlChipBlock).not.toMatch(/\berror\s*\??\s*:/);
  });

  it("UrlChipInput.tsx no longer references onDismissError or the auto-dismiss timer", () => {
    const source = readFileSync(path.join(chipInputDir, "UrlChipInput.tsx"), "utf-8");
    expect(source).not.toContain("onDismissError");
    expect(source).not.toContain("chip.error");
    expect(source).not.toContain("setTimeout");
  });

  it("Chip.tsx no longer renders the destructive isError variant", () => {
    const source = readFileSync(path.join(chipInputDir, "Chip.tsx"), "utf-8");
    expect(source).not.toContain("isError");
    expect(source).not.toContain("chip.error");
    expect(source).not.toContain("bg-destructive/10");
  });

  it("a rendered chip always uses the normal bg-secondary styling, never bg-destructive, and has no (error) suffix", () => {
    const chip: UrlChip = { url: "https://www.instagram.com/reel/aaa/" };
    const { container } = render(<Chip chip={chip} onRemove={() => {}} />);

    const chipEl = container.firstElementChild;
    expect(chipEl).not.toBeNull();

    // Real behavioural assertion on the rendered className, not a source-text search --
    // this fails if a `bg-destructive` variant is ever reintroduced, conditionally or not.
    expect(chipEl!.className).toContain("bg-secondary");
    expect(chipEl!.className).not.toContain("bg-destructive");
    expect(chipEl!.className).not.toContain("destructive");

    // No "(error)" suffix text node in the rendered output.
    expect(chipEl!.textContent).not.toMatch(/\(error\)/);
  });
});
