import { describe, expect, it } from "vitest";

import { buildComputedPerformanceBlock } from "@/lib/server/analysis/performance/readModel";
import type { PerformanceBlockRow } from "@/lib/server/analysis/performance/readModel";

/**
 * Ticket #144. `buildComputedPerformanceBlock` is the read-path assembly of
 * TDD §7's `performance.computed` shape from a DB row, without a new
 * migration. Covers a scored row, a cold-start row, and an unavailable row
 * (the ticket's own three verification states), plus D8 (byte-identical
 * across two reads of the same row) and R-N... reach-state reconstruction.
 */

function baseRow(overrides: Partial<PerformanceBlockRow> = {}): PerformanceBlockRow {
  return {
    platform: "instagram",
    likeCount: 100,
    commentCount: 10,
    likeAndViewCountsDisabled: false,
    followerCount: 10_000,
    audienceSourceFetchedAt: "2026-08-01T00:00:00.000Z",
    createdAt: "2026-08-05T00:00:00.000Z",
    perfReachValue: 5_000,
    perfReachKind: "VIEWS",
    perfReachDerivedFrom: "TOP_LEVEL",
    perfTier1Ratio: 0.022,
    perfTier1Denominator: "REACH",
    perfBucketKey: "instagram:reel:full_video",
    perfBaselineMedian: 4_000,
    perfBaselineSampleSize: 7,
    perfMultiplier: 1.25,
    perfPostAgeHours: 48,
    perfTierUsed: "CREATOR_BASELINE",
    perfConfidence: "HIGH",
    perfConfidenceReason: null,
    perfProvisional: false,
    perfUnavailableReason: null,
    ...overrides,
  };
}

/** Structural D8 comparison helper (finding 3, PR #235 review) — drops `sampleSize` (the one deliberately live field) so every OTHER `tier2` field is compared without hand-listing them, and a future field is covered automatically. */
function omitSampleSize<T extends { sampleSize: unknown }>(tier2: T): Omit<T, "sampleSize"> {
  const clone: Partial<T> = { ...tier2 };
  delete clone.sampleSize;
  return clone as Omit<T, "sampleSize">;
}

describe("buildComputedPerformanceBlock — null gate (TDD §7)", () => {
  it("returns null when perfTierUsed is null (row predates schema 3)", () => {
    expect(buildComputedPerformanceBlock(baseRow({ perfTierUsed: null }))).toBeNull();
  });
});

describe("buildComputedPerformanceBlock — a scored row (CREATOR_BASELINE, Tier 2 measured)", () => {
  it("shapes reach/likes/comments/audience/tier1/tier2/tier3 from stored columns", () => {
    const result = buildComputedPerformanceBlock(baseRow());

    expect(result).not.toBeNull();
    expect(result!.reach).toEqual({ value: 5_000, kind: "VIEWS", derivedFrom: "TOP_LEVEL", state: "AVAILABLE" });
    expect(result!.likes).toEqual({ value: 100, state: "AVAILABLE" });
    expect(result!.comments).toEqual({ value: 10, state: "AVAILABLE" });
    expect(result!.audience).toEqual({
      value: 10_000,
      capturedAt: "2026-08-05T00:00:00.000Z",
      sourceFetchedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(result!.tier1).toEqual({ denominator: "REACH", ratio: 0.022, reachKind: "VIEWS" });
    expect(result!.tier2).toEqual({
      median: 4_000,
      sampleSize: 7,
      bucketKey: "instagram:reel:full_video",
      multiplier: 1.25,
    });
    // reach ÷ followers = 5000 / 10000 = 0.5 — recomputed via ratios.ts's own function, not stored.
    expect(result!.tier3).toEqual({ reachPerFollower: 0.5 });
    expect(result!.tierUsed).toBe("CREATOR_BASELINE");
    expect(result!.confidence).toBe("HIGH");
    expect(result!.provisional).toBe(false);
    expect(result!.unavailableReason).toBeNull();
  });

  it("likes HIDDEN when like_and_view_counts_disabled is confirmed true — reconstructed via availability.ts, not a stored state column", () => {
    const result = buildComputedPerformanceBlock(baseRow({ likeAndViewCountsDisabled: true }));

    expect(result!.likes).toEqual({ value: null, state: "HIDDEN" });
    // Comments are unaffected by the flag (V1) — still usable.
    expect(result!.comments).toEqual({ value: 10, state: "AVAILABLE" });
  });
});

describe("buildComputedPerformanceBlock — a cold-start row (Tier 2 COLD_START, R-C4 partial absence)", () => {
  it("tier2.median/multiplier are null, sampleSize/bucketKey still carried — a Tier 1 ratio can still exist", () => {
    const result = buildComputedPerformanceBlock(
      baseRow({
        perfTierUsed: "REACH_ONLY",
        perfBaselineMedian: null,
        perfMultiplier: null,
        perfBaselineSampleSize: 2,
      }),
    );

    expect(result!.tier2).toEqual({
      median: null,
      sampleSize: 2,
      bucketKey: "instagram:reel:full_video",
      multiplier: null,
    });
    // Tier 1 still renders — cold start is a partial absence (R-C4), not a suppression.
    expect(result!.tier1).toEqual({ denominator: "REACH", ratio: 0.022, reachKind: "VIEWS" });
  });
});

describe("buildComputedPerformanceBlock — an unavailable row", () => {
  it("no reach, no tier1/tier2/tier3, tierUsed UNAVAILABLE with a reason — never fabricates a zero", () => {
    const result = buildComputedPerformanceBlock(
      baseRow({
        perfReachValue: null,
        perfReachKind: null,
        perfReachDerivedFrom: "NONE",
        perfTier1Ratio: null,
        perfTier1Denominator: null,
        perfTierUsed: "UNAVAILABLE",
        perfConfidence: "NONE",
        perfUnavailableReason: "REACH_HIDDEN",
        likeAndViewCountsDisabled: true,
        followerCount: null,
      }),
    );

    expect(result!.reach).toEqual({ value: null, kind: null, derivedFrom: "NONE", state: "UNKNOWN" });
    expect(result!.tier1).toBeNull();
    expect(result!.tier3).toBeNull();
    expect(result!.tierUsed).toBe("UNAVAILABLE");
    expect(result!.confidence).toBe("NONE");
    expect(result!.unavailableReason).toBe("REACH_HIDDEN");
  });
});

describe("buildComputedPerformanceBlock — reach.state reconstruction (never HIDDEN)", () => {
  it("value 0 reconstructs as ZERO, a corroborated genuine zero — not UNKNOWN, not fabricated as absent", () => {
    const result = buildComputedPerformanceBlock(baseRow({ perfReachValue: 0, perfReachKind: "VIEWS" }));
    expect(result!.reach.state).toBe("ZERO");
    expect(result!.reach.value).toBe(0);
  });
});

describe("buildComputedPerformanceBlock — D8, byte-identical across two reads", () => {
  it("two calls on the same row produce deep-equal output (no clock/now() dependency)", () => {
    const row = baseRow();
    const first = buildComputedPerformanceBlock(row);
    const second = buildComputedPerformanceBlock(row);
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  /**
   * Reviewer note on #206 (TDD §14.8a's "Consequential test note"): the
   * assertion above proves determinism-given-unchanged-input, not freezing
   * — `row` here is `MEASURED` (`perfMultiplier: 1.25` from `baseRow()`),
   * so it was never a candidate for the live carve-out in the first place
   * and stays green whether or not #206 lands. It is kept as-is (D8 is
   * still literally true for a MEASURED row) rather than edited, per the
   * TDD note's own instruction that only the cold-start field's carve-out
   * is a legitimate edit, not a wider one.
   */
});

describe("buildComputedPerformanceBlock — #206 carve-out, D8's actual boundary", () => {
  it("a MEASURED row's tier2.sampleSize ignores the injected live value entirely — frozen unconditionally", () => {
    const row = baseRow(); // perfMultiplier: 1.25, perfBaselineSampleSize: 7 — MEASURED.
    const withoutLive = buildComputedPerformanceBlock(row);
    const withLive = buildComputedPerformanceBlock(row, 999);

    expect(withoutLive!.tier2!.sampleSize).toBe(7);
    expect(withLive!.tier2!.sampleSize).toBe(7);
    expect(withLive).toEqual(withoutLive);
  });

  it("a COLD_START row's tier2.sampleSize takes the injected live value, not the stored column", () => {
    const row = baseRow({ perfMultiplier: null, perfBaselineMedian: null, perfBaselineSampleSize: 2 });

    const first = buildComputedPerformanceBlock(row, 2);
    const second = buildComputedPerformanceBlock(row, 5);

    // Same row object, two calls — but a THIRD input (the injected live
    // value) differs between them, so tier2.sampleSize legitimately
    // differs. This is the field-scoped carve-out from TDD §14.8a: prove
    // it moves on the one field it's allowed to move on...
    expect(first!.tier2!.sampleSize).toBe(2);
    expect(second!.tier2!.sampleSize).toBe(5);

    // ...and prove every OTHER field is still byte-identical between the
    // two calls, i.e. the carve-out did not leak into anything else.
    // Structural, not hand-listed: destructure sampleSize off tier2 and
    // toEqual the remainder, so a future PerformanceTier2 field is covered
    // automatically instead of silently falling outside this assertion.
    const { tier2: tier2First, ...restFirst } = first!;
    const { tier2: tier2Second, ...restSecond } = second!;
    expect(restFirst).toEqual(restSecond);
    expect(omitSampleSize(tier2First!)).toEqual(omitSampleSize(tier2Second!));
  });

  it("no injected value (undefined) falls back to the stored column — pre-#206 call sites are unaffected", () => {
    const row = baseRow({ perfMultiplier: null, perfBaselineMedian: null, perfBaselineSampleSize: 2 });
    const result = buildComputedPerformanceBlock(row);
    expect(result!.tier2!.sampleSize).toBe(2);
  });
});

describe("buildComputedPerformanceBlock — ticket #251, a NOT_COMPARABLE row must not be classified as cold start", () => {
  it("a full-baseline, unresolved-multiplier row (median present, multiplier null) ignores the injected live value — its sampleSize stays the FROZEN stored column, not the live count", () => {
    // Shape of production row 9470151e-833f-4342-a55d-2f922a401937 (verified against
    // Turso, 2026-08-19): perf_baseline_median 7698, perf_baseline_sample_size 5,
    // perf_multiplier NULL — a full baseline exists, this post's own metric didn't
    // resolve. Pre-#251, `isColdStart = row.perfMultiplier == null` misclassified this
    // exact shape as cold start and let the injected live value clobber sampleSize.
    const row = baseRow({ perfMultiplier: null, perfBaselineMedian: 7_698, perfBaselineSampleSize: 5 });

    const withoutLive = buildComputedPerformanceBlock(row);
    const withLive = buildComputedPerformanceBlock(row, 999);

    expect(withoutLive!.tier2).toEqual({
      median: 7_698,
      sampleSize: 5,
      bucketKey: "instagram:reel:full_video",
      multiplier: null,
    });
    // The injected "live cold-start" value must NOT reach a NOT_COMPARABLE row's
    // sampleSize — there is no progress to report, so nothing here is live.
    expect(withLive!.tier2!.sampleSize).toBe(5);
    expect(withLive).toEqual(withoutLive);
  });

  it("a genuine cold-start row (median absent too) is unaffected by this fix — still takes the live value", () => {
    const row = baseRow({ perfMultiplier: null, perfBaselineMedian: null, perfBaselineSampleSize: 2 });
    const result = buildComputedPerformanceBlock(row, 4);
    expect(result!.tier2!.sampleSize).toBe(4);
  });
});
