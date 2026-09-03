import { describe, expect, it } from "vitest";

import { getTrapFocusTarget } from "@/components/Sidebar/helpers";

/**
 * Pure-arithmetic tests for the rail's focus-trap helper (ticket #336 / TDD
 * #284 §5.4). Plain-array fixtures, index-identity assertions — no DOM.
 */
describe("getTrapFocusTarget", () => {
  const els = [
    { id: "toggle" } as unknown as HTMLElement,
    { id: "middle" } as unknown as HTMLElement,
    { id: "last" } as unknown as HTMLElement,
  ];

  it("wraps Shift+Tab off the first element to the last", () => {
    expect(getTrapFocusTarget(els, 0, true)).toBe(els[2]);
  });

  it("wraps Tab off the last element to the first", () => {
    expect(getTrapFocusTarget(els, 2, false)).toBe(els[0]);
  });

  it("returns null for Tab from a middle element (no wrap needed)", () => {
    expect(getTrapFocusTarget(els, 1, false)).toBe(null);
  });

  it("returns null for Shift+Tab from a middle element (no wrap needed)", () => {
    expect(getTrapFocusTarget(els, 1, true)).toBe(null);
  });

  it("returns null for Tab from the first element (no wrap needed)", () => {
    expect(getTrapFocusTarget(els, 0, false)).toBe(null);
  });

  it("returns null for Shift+Tab from the last element (no wrap needed)", () => {
    expect(getTrapFocusTarget(els, 2, true)).toBe(null);
  });

  it("returns null when the list of focusables is empty", () => {
    expect(getTrapFocusTarget([], -1, false)).toBe(null);
    expect(getTrapFocusTarget([], -1, true)).toBe(null);
  });

  it("wraps correctly for a two-element list in both directions", () => {
    const pair = [{ id: "a" } as unknown as HTMLElement, { id: "b" } as unknown as HTMLElement];

    expect(getTrapFocusTarget(pair, 0, true)).toBe(pair[1]);
    expect(getTrapFocusTarget(pair, 1, false)).toBe(pair[0]);
  });
});
