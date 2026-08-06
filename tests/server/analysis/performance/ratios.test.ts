import { describe, expect, it } from "vitest";

import {
  computeEngagementRate,
  computeReachEngagementRatio,
  computeReachPerFollower,
} from "@/lib/server/analysis/performance/ratios";
import type { Tier1Ratio } from "@/lib/server/analysis/performance/types";

describe("computeEngagementRate — follower-denominated Tier 1 (relocated from #139, unchanged arithmetic)", () => {
  it("computes (likes + comments) / followers as a fraction", () => {
    const result = computeEngagementRate({ likeCount: 900, commentCount: 42, followerCount: 10_000 });

    expect(result).toEqual({ denominator: "FOLLOWERS", ratio: 0.0942 });
  });

  it("returns null when followerCount is null — R-12.2.4, no substitute denominator", () => {
    expect(computeEngagementRate({ likeCount: 10, commentCount: 2, followerCount: null })).toBeNull();
  });

  it("returns null when followerCount is 0", () => {
    expect(computeEngagementRate({ likeCount: 10, commentCount: 2, followerCount: 0 })).toBeNull();
  });

  it("treats a missing likeCount/commentCount as 0, not as null-propagation", () => {
    const result = computeEngagementRate({
      likeCount: null,
      commentCount: undefined,
      followerCount: 1_000,
    });

    expect(result).toEqual({ denominator: "FOLLOWERS", ratio: 0 });
  });

  it("OR-20 defence-in-depth — a negative likeCount never produces a negative ratio", () => {
    const result = computeEngagementRate({ likeCount: -1, commentCount: 5, followerCount: 1_000 });

    expect(result).not.toBeNull();
    expect(result!.ratio).toBeGreaterThanOrEqual(0);
    // -1 is treated as unusable (0 contribution), not subtracted.
    expect(result).toEqual({ denominator: "FOLLOWERS", ratio: 0.005 });
  });
});

describe("computeReachEngagementRatio — reach-denominated Tier 1 (new in #140)", () => {
  it("computes (likes + comments) / reach, tagged with the reach kind", () => {
    const result = computeReachEngagementRatio({
      likeCount: 900,
      commentCount: 100,
      reachValue: 100_000,
      reachKind: "PLAYS",
    });

    expect(result).toEqual({ denominator: "REACH", ratio: 0.01, reachKind: "PLAYS" });
  });

  it("returns null when reachValue is null (no reach denominator available)", () => {
    expect(
      computeReachEngagementRatio({
        likeCount: 10,
        commentCount: 2,
        reachValue: null,
        reachKind: "PLAYS",
      }),
    ).toBeNull();
  });

  it("returns null when reachValue is 0 — dividing by a corroborated genuine zero is undefined, not a ratio", () => {
    expect(
      computeReachEngagementRatio({
        likeCount: 10,
        commentCount: 2,
        reachValue: 0,
        reachKind: "PLAYS",
      }),
    ).toBeNull();
  });

  it("R-4.3.2 — returns null when reachKind is UNKNOWN, even if a numeric reachValue is somehow present", () => {
    expect(
      computeReachEngagementRatio({
        likeCount: 10,
        commentCount: 2,
        reachValue: 5_000,
        reachKind: "UNKNOWN",
      }),
    ).toBeNull();
  });

  it("returns null when reachKind is null", () => {
    expect(
      computeReachEngagementRatio({
        likeCount: 10,
        commentCount: 2,
        reachValue: 5_000,
        reachKind: null,
      }),
    ).toBeNull();
  });

  it("OR-20 defence-in-depth — a negative commentCount never produces a negative ratio", () => {
    const result = computeReachEngagementRatio({
      likeCount: 50,
      commentCount: -3,
      reachValue: 1_000,
      reachKind: "VIEWS",
    });

    expect(result).not.toBeNull();
    expect(result!.ratio).toBeGreaterThanOrEqual(0);
    expect(result).toEqual({ denominator: "REACH", ratio: 0.05, reachKind: "VIEWS" });
  });

  it("carries VIEWS through the discriminant, never silently PLAYS", () => {
    const result = computeReachEngagementRatio({
      likeCount: 10,
      commentCount: 0,
      reachValue: 100,
      reachKind: "VIEWS",
    });

    expect(result?.reachKind).toBe("VIEWS");
  });
});

describe("computeReachPerFollower — Tier 3", () => {
  it("computes reach / followers", () => {
    expect(computeReachPerFollower({ reachValue: 50_000, followerCount: 10_000 })).toEqual({
      reachPerFollower: 5,
    });
  });

  it("returns null when reachValue is null", () => {
    expect(computeReachPerFollower({ reachValue: null, followerCount: 10_000 })).toBeNull();
  });

  it("returns null when followerCount is null or 0", () => {
    expect(computeReachPerFollower({ reachValue: 100, followerCount: null })).toBeNull();
    expect(computeReachPerFollower({ reachValue: 100, followerCount: 0 })).toBeNull();
  });

  it("returns null when reachValue is negative (defence-in-depth, never fabricates a negative result)", () => {
    expect(computeReachPerFollower({ reachValue: -1, followerCount: 10_000 })).toBeNull();
  });
});

describe("Tier1Ratio — R-12.3.5 type-level guard: dropping the denominator discriminator is a tsc failure", () => {
  it("both variants construct with their discriminator present (runtime sanity check for the type below)", () => {
    const reach: Tier1Ratio = { denominator: "REACH", ratio: 0.1, reachKind: "PLAYS" };
    const followers: Tier1Ratio = { denominator: "FOLLOWERS", ratio: 0.1 };

    expect(reach.denominator).toBe("REACH");
    expect(followers.denominator).toBe("FOLLOWERS");
  });

  it("type-only: constructing a Tier1Ratio without `denominator` does not compile", () => {
    // This assertion is checked by `tsc`, not by vitest at runtime — the
    // line below is invalid without `denominator`, so removing the
    // discriminator from `Tier1Ratio` (making it an optional field on a
    // single object shape instead of a discriminated union) would make
    // this line valid again, which turns the `@ts-expect-error` into an
    // "unused directive" error and fails `npx tsc --noEmit`. That is the
    // proof R-12.3.5 asks for.
    // @ts-expect-error — `denominator` is required; this object shape has neither variant's full field set.
    const invalid: Tier1Ratio = { ratio: 0.1 };
    expect(invalid).toBeDefined();
  });
});
