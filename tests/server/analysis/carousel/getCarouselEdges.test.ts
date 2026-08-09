import { describe, expect, it } from "vitest";

import { getCarouselEdges } from "@/lib/server/analysis/carousel";
import {
  makeCarousel,
  makeCarouselWithEdges,
  makeImageChild,
  makeReel,
} from "@/tests/fixtures/synthetic/instagramMedia";

/**
 * Step 0 (#175/#176) — `getCarouselEdges()` promoted out of
 * `performance/reach.ts` into a neutral `lib/server/analysis/carousel/`
 * module. This is the ONE canonical derivation every slide count/index in
 * the codebase now goes through (TDD §0.7 TR-1).
 */
describe("getCarouselEdges — the one canonical derivation", () => {
  it("returns the PRE-filter edges array, in order, unchanged", () => {
    const media = makeCarousel([makeImageChild({ id: "a" }), makeImageChild({ id: "b" })]);

    const edges = getCarouselEdges(media);

    expect(edges).toHaveLength(2);
    expect(edges[0]?.node?.id).toBe("a");
    expect(edges[1]?.node?.id).toBe("b");
  });

  it("returns an empty array for a non-carousel post", () => {
    expect(getCarouselEdges(makeReel())).toEqual([]);
  });

  it("SYNTHETIC — a null node counts toward the array's length like any other edge; it is not compacted away", () => {
    const media = makeCarouselWithEdges([makeImageChild({ id: "a" }), null, makeImageChild({ id: "b" })]);

    const edges = getCarouselEdges(media);

    expect(edges).toHaveLength(3);
    expect(edges[1]?.node).toBeUndefined();
  });
});
