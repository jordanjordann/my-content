import { afterEach, describe, expect, it, vi } from "vitest";

import { buildComputedPerformanceBlock } from "@/lib/server/analysis/performance/readModel";
import type { LiveComparator, PerformanceBlockRow } from "@/lib/server/analysis/performance";

/**
 * Ticket #144. `buildComputedPerformanceBlock` is the read-path assembly of
 * TDD §7's `performance.computed` shape from a DB row, without a new
 * migration. Covers a scored row, a cold-start row, and an unavailable row
 * (the ticket's own three verification states), plus D8 (byte-identical
 * across two reads of the same row) and R-N... reach-state reconstruction.
 *
 * Ticket #252 extends this file: the live multiplier/state routing rule
 * (DESIGN-3C §3), the self-exclusion-before-median guarantee, and the
 * sample-size leak fix are all pinned in the "ticket #252" describe blocks
 * below.
 */

function baseRow(overrides: Partial<PerformanceBlockRow> = {}): PerformanceBlockRow {
  return {
    id: "row-under-test",
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

/** Builds a `LiveComparator[]` of `count` entries below `BASELINE_MIN_SAMPLE`, none sharing the observed row's id. */
function comparators(...values: number[]): LiveComparator[] {
  return values.map((value, i) => ({ id: `comparator-${i}`, value }));
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
      state: "MEASURED",
      reason: null,
      median: 4_000,
      sampleSize: 7,
      bucketKey: "instagram:reel:full_video",
      multiplier: 1.25,
      minSample: 5,
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
      state: "COLD_START",
      reason: null,
      median: null,
      sampleSize: 2,
      bucketKey: "instagram:reel:full_video",
      multiplier: null,
      minSample: 5,
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
  it("a MEASURED row's tier2 ignores the injected live pool entirely — frozen unconditionally", () => {
    const row = baseRow(); // perfMultiplier: 1.25, perfBaselineSampleSize: 7 — MEASURED.
    const withoutLive = buildComputedPerformanceBlock(row);
    const withLive = buildComputedPerformanceBlock(row, comparators(1, 2, 3));

    expect(withoutLive!.tier2!.sampleSize).toBe(7);
    expect(withLive!.tier2!.sampleSize).toBe(7);
    expect(withLive).toEqual(withoutLive);
  });

  it("a COLD_START row's tier2.sampleSize takes the injected live pool's (self-excluded) length, not the stored column", () => {
    const row = baseRow({ perfMultiplier: null, perfBaselineMedian: null, perfBaselineSampleSize: 2 });

    const first = buildComputedPerformanceBlock(row, comparators(10, 20));
    const second = buildComputedPerformanceBlock(row, comparators(10, 20, 30, 40));

    // Same row object, two calls — but a THIRD input (the injected live
    // pool) differs between them, so tier2.sampleSize legitimately
    // differs. This is the field-scoped carve-out from TDD §14.8a: prove
    // it moves on the one field it's allowed to move on...
    expect(first!.tier2!.sampleSize).toBe(2);
    expect(second!.tier2!.sampleSize).toBe(4);
    expect(first!.tier2!.state).toBe("COLD_START");
    expect(second!.tier2!.state).toBe("COLD_START");

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
    expect(result!.tier2!.state).toBe("COLD_START");
  });
});

describe("buildComputedPerformanceBlock — ticket #251, a NOT_COMPARABLE row must not be classified as cold start", () => {
  it("a full-baseline, unresolved-own-metric row (median present, multiplier null) ignores the injected live pool — its sampleSize stays the FROZEN stored column, not live; median is null (own-metric-unresolved has no median, #263 review Finding 1: a stored perfBaselineMedian no longer short-circuits/freezes this row)", () => {
    // Synthetic reconstruction of a production row shape (anonymised,
    // #264): perf_baseline_median 6100, perf_baseline_sample_size 5,
    // perf_multiplier NULL, perf_reach_value NULL — a full baseline exists,
    // this post's own reach never resolved.
    // Pre-#251, `isColdStart = row.perfMultiplier == null` misclassified
    // this exact shape as cold start and let the injected live value
    // clobber sampleSize. Post-#263-review-Finding-1, this row is no longer
    // routed through a frozen-reuse branch keyed on `perfBaselineMedian` —
    // it reaches step 2 (own metric unresolved) same as any other
    // `perfMultiplier == null` row, so `median` is `null` (no median exists
    // for this state), not the stale stored `6100`.
    const row = baseRow({
      id: "not-comparable-row-synth-1",
      perfMultiplier: null,
      perfBaselineMedian: 6_100,
      perfBaselineSampleSize: 5,
      perfReachValue: null,
    });

    const withoutLive = buildComputedPerformanceBlock(row);
    const withLive = buildComputedPerformanceBlock(row, comparators(1, 2, 3, 4, 5, 6, 7, 8, 9));

    // Ticket #262 — `livePool` was never fetched at all for `withoutLive` (the
    // `undefined` case, distinct from a genuinely fetched empty array), so the reason
    // degrades to the below-threshold short form (owner ruling: true in every pool
    // condition).
    expect(withoutLive!.tier2).toEqual({
      state: "NOT_COMPARABLE",
      reason: "POST_METRIC_UNRESOLVED_NO_BASELINE",
      median: null,
      sampleSize: 5,
      bucketKey: "instagram:reel:full_video",
      multiplier: null,
      minSample: 5,
    });
    // `withLive`'s pool of 9 clears `BASELINE_MIN_SAMPLE` — a genuine creator baseline
    // exists, so the reason is the long form.
    expect(withLive!.tier2).toEqual({
      state: "NOT_COMPARABLE",
      reason: "POST_METRIC_UNRESOLVED",
      median: null,
      sampleSize: 5,
      bucketKey: "instagram:reel:full_video",
      multiplier: null,
      minSample: 5,
    });
    // The injected live pool must NOT reach a NOT_COMPARABLE row's
    // sampleSize — there is no progress to report, so nothing here is live. Only the
    // REASON responds to the live pool's size/presence (ticket #262).
    expect(withLive!.tier2!.sampleSize).toBe(5);
  });

  it("a genuine cold-start row (median absent too) is unaffected by this fix — still takes the live pool's length", () => {
    const row = baseRow({ perfMultiplier: null, perfBaselineMedian: null, perfBaselineSampleSize: 2 });
    const result = buildComputedPerformanceBlock(row, comparators(1, 2, 3, 4));
    expect(result!.tier2!.sampleSize).toBe(4);
    expect(result!.tier2!.state).toBe("COLD_START");
  });
});

/**
 * Ticket #260 — `PerformanceTier2.minSample` carries the server's own `BASELINE_MIN_SAMPLE`
 * (`constants.ts`) per row, replacing the deleted client-side hardcoded-`5` duplicate
 * constant. Env-override pattern mirrors `tests/server/analysis/performance/constants.test.ts`.
 */
describe("buildComputedPerformanceBlock — ticket #260, tier2.minSample carries BASELINE_MIN_SAMPLE", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to 5 when PERFORMANCE_BASELINE_MIN_SAMPLE is unset", () => {
    const result = buildComputedPerformanceBlock(baseRow());
    expect(result!.tier2!.minSample).toBe(5);
  });

  it("carries the PERFORMANCE_BASELINE_MIN_SAMPLE override (8) unclamped — the numerator, not this field, is what gets clamped, and clamping itself happens client-side in the derive layer", async () => {
    vi.stubEnv("PERFORMANCE_BASELINE_MIN_SAMPLE", "8");
    vi.resetModules();
    const { buildComputedPerformanceBlock: buildWithOverride } = await import(
      "@/lib/server/analysis/performance/readModel"
    );

    const row = baseRow({ perfMultiplier: null, perfBaselineMedian: null, perfBaselineSampleSize: 1 });
    const result = buildWithOverride(row, comparators(1, 2, 3, 4, 5, 6));

    expect(result!.tier2!.minSample).toBe(8);
    expect(result!.tier2!.sampleSize).toBe(6);
    // 6 < the overridden threshold of 8 — still cold start.
    expect(result!.tier2!.state).toBe("COLD_START");
  });
});

/**
 * Ticket #252 (DESIGN-3C §3) — the live routing rule. All five states of
 * the rule are pinned here, plus the two constraints called out explicitly
 * in the ticket: the D8 freeze fixture (a stored multiplier must never move
 * even though its live recomputation would differ) and self-exclusion
 * (median must be taken over comparators EXCLUDING the row's own id).
 */
describe("buildComputedPerformanceBlock — ticket #252, the live routing rule (DESIGN-3C §3)", () => {
  it("D8 regression fixture: a stored multiplier (7.976190476190476) stays byte-identical even though live recomputation over the SAME shape of pool would give a different number (4.1875x, not 7.98x)", () => {
    // Synthetic reconstruction of a production row shape (anonymised, #264):
    // perf_multiplier 7.976190476190476, perf_baseline_median 4200 (frozen,
    // computed over a SMALLER pool at write time). Its live median, over a
    // CURRENT 6 comparators in its bucket, is 8000 — which would give
    // 33500 / 8000 = 4.1875x if the frozen multiplier were ever recomputed.
    const row = baseRow({
      id: "d8-frozen-row-synth-1",
      perfReachValue: 33_500,
      perfMultiplier: 7.976190476190476,
      perfBaselineMedian: 4_200,
      perfBaselineSampleSize: 5,
    });

    // The live pool a caller would have batched for this row today — 6
    // comparators whose median is 8000, deliberately NOT 4200, so this test
    // fails loudly if the live path ever engages on a MEASURED row.
    const livePoolToday: LiveComparator[] = [
      { id: "live-comparator-a", value: 900 },
      { id: "live-comparator-b", value: 3_000 },
      { id: "live-comparator-c", value: 5_000 },
      { id: "live-comparator-d", value: 11_000 },
      { id: "live-comparator-e", value: 60_000 },
      { id: "live-comparator-f", value: 95_000 },
    ];

    const result = buildComputedPerformanceBlock(row, livePoolToday);

    expect(result!.tier2!.state).toBe("MEASURED");
    expect(result!.tier2!.reason).toBeNull();
    expect(result!.tier2!.multiplier).toBe(7.976190476190476);
    expect(result!.tier2!.multiplier).not.toBeCloseTo(4.1875, 1);
    expect(result!.tier2!.median).toBe(4_200);
    expect(result!.tier2!.median).not.toBe(8_000);
  });

  it("production shape: own reach 620000 gets a live ~82.7x multiplier off a median that excludes every other reel in the pool, itself included", () => {
    // Synthetic reconstruction of a production row shape (anonymised, #264)
    // — an 8-row `instagram:reel:full_video` pool, 7 of which resolve reach.
    const row = baseRow({
      id: "self-row-synth-1",
      perfReachValue: 620_000,
      perfMultiplier: null,
      perfBaselineMedian: null,
      perfBaselineSampleSize: 0,
    });
    const livePool: LiveComparator[] = [
      { id: "self-row-synth-1", value: 620_000 }, // self — must be excluded.
      { id: "live-comparator-a", value: 4_100 },
      { id: "live-comparator-b", value: 118_000 },
      { id: "live-comparator-c", value: 7_100 },
      { id: "live-comparator-d", value: 7_900 },
      { id: "live-comparator-e", value: 52_000 },
      { id: "live-comparator-f", value: 6_300 },
    ];

    const result = buildComputedPerformanceBlock(row, livePool);

    // median of the 6 OTHER reels (own excluded): 4100,6300,7100,7900,52000,118000 -> (7100+7900)/2 = 7500.
    expect(result!.tier2!.median).toBe(7_500);
    expect(result!.tier2!.sampleSize).toBe(6);
    expect(result!.tier2!.state).toBe("MEASURED");
    // 620000 / 7500 = 82.666...
    expect(result!.tier2!.multiplier).toBeCloseTo(82.7, 1);
  });

  it("self-exclusion applies to the MEDIAN, not just the count — a pool where including self would change the median", () => {
    const row = baseRow({
      id: "self-id",
      perfReachValue: 300,
      perfMultiplier: null,
      perfBaselineMedian: null,
    });
    // Excluding self (id "self-id"): [10, 20, 30, 40, 50] -> median 30.
    // Including self (value 1000) would sort to [10,20,30,40,50,1000] -> median (30+40)/2 = 35.
    const livePool: LiveComparator[] = [
      { id: "self-id", value: 1_000 },
      { id: "a", value: 10 },
      { id: "b", value: 20 },
      { id: "c", value: 30 },
      { id: "d", value: 40 },
      { id: "e", value: 50 },
    ];

    const result = buildComputedPerformanceBlock(row, livePool);

    expect(result!.tier2!.sampleSize).toBe(5);
    expect(result!.tier2!.median).toBe(30);
    expect(result!.tier2!.median).not.toBe(35);
    expect(result!.tier2!.multiplier).toBe(10); // 300 / 30
  });

  it("own metric unresolved wins regardless of pool size — below threshold", () => {
    const row = baseRow({
      perfReachValue: null, // unresolved
      perfMultiplier: null,
      perfBaselineMedian: null,
      perfBaselineSampleSize: 1,
    });
    const result = buildComputedPerformanceBlock(row, comparators(1, 2)); // pool of 2, below threshold 5

    expect(result!.tier2!.state).toBe("NOT_COMPARABLE");
    // Ticket #262 — a live pool below `BASELINE_MIN_SAMPLE` means no creator baseline exists
    // for this bucket, so the reason is the below-threshold short-form variant, not the long
    // form (which would falsely claim "this creator's usual is set").
    expect(result!.tier2!.reason).toBe("POST_METRIC_UNRESOLVED_NO_BASELINE");
    expect(result!.tier2!.multiplier).toBeNull();
    expect(result!.tier2!.median).toBeNull();
    // No live count leak (DESIGN-3C §4.3): this row has no comparison at
    // all, so sampleSize is the frozen column, not the live pool's length.
    expect(result!.tier2!.sampleSize).toBe(1);
  });

  it("own metric unresolved wins regardless of pool size — at/above threshold too", () => {
    const row = baseRow({
      perfReachValue: null, // unresolved
      perfMultiplier: null,
      perfBaselineMedian: null,
      perfBaselineSampleSize: 3,
    });
    const result = buildComputedPerformanceBlock(row, comparators(1, 2, 3, 4, 5, 6)); // pool of 6, >= threshold 5

    expect(result!.tier2!.state).toBe("NOT_COMPARABLE");
    expect(result!.tier2!.reason).toBe("POST_METRIC_UNRESOLVED");
    expect(result!.tier2!.multiplier).toBeNull();
    expect(result!.tier2!.median).toBeNull();
    // Same leak-fix guarantee applies whether or not the live pool clears
    // the threshold — the live count still must not leak onto this row.
    expect(result!.tier2!.sampleSize).toBe(3);
  });

  it("pool >= threshold and live median === 0 -> NOT_COMPARABLE / MEDIAN_ZERO, never a fabricated 0x or a division", () => {
    const row = baseRow({
      perfReachValue: 500,
      perfMultiplier: null,
      perfBaselineMedian: null,
    });
    const result = buildComputedPerformanceBlock(row, comparators(0, 0, 0, 0, 0));

    expect(result!.tier2!.state).toBe("NOT_COMPARABLE");
    expect(result!.tier2!.reason).toBe("MEDIAN_ZERO");
    expect(result!.tier2!.median).toBe(0);
    expect(result!.tier2!.multiplier).toBeNull();
    expect(result!.tier2!.sampleSize).toBe(5);
  });

  it("own metric resolved but pool below threshold -> unchanged COLD_START (the only state that keeps the progress promise)", () => {
    const row = baseRow({
      perfReachValue: 500,
      perfMultiplier: null,
      perfBaselineMedian: null,
    });
    const result = buildComputedPerformanceBlock(row, comparators(1, 2, 3));

    expect(result!.tier2!.state).toBe("COLD_START");
    expect(result!.tier2!.reason).toBeNull();
    expect(result!.tier2!.median).toBeNull();
    expect(result!.tier2!.multiplier).toBeNull();
    expect(result!.tier2!.sampleSize).toBe(3);
  });

  it("owner ruling (#263 review, Finding 1): a row that was MEDIAN_ZERO at write time (stored perfBaselineMedian === 0, perfMultiplier null) reaches step 4 and gets a live multiplier once the live pool's median is non-zero — NOT frozen at the stored zero median", () => {
    const row = baseRow({
      perfReachValue: 500, // own metric resolved
      perfMultiplier: null,
      perfBaselineMedian: 0, // MEDIAN_ZERO at write time
      perfBaselineSampleSize: 5,
    });
    // Live pool clears the threshold and its median is now non-zero.
    const result = buildComputedPerformanceBlock(row, comparators(50, 80, 100, 100, 120, 150));

    expect(result!.tier2!.state).toBe("MEASURED");
    expect(result!.tier2!.reason).toBeNull();
    expect(result!.tier2!.median).toBe(100);
    expect(result!.tier2!.sampleSize).toBe(6);
    expect(result!.tier2!.multiplier).toBeCloseTo(5, 5); // 500 / 100
  });
});

/**
 * Ticket #262 (DESIGN-3C §2) — the below-threshold `NOT_COMPARABLE` reason. Own-metric-unresolved
 * (step 2) stays ABOVE the pool-size check (DESIGN-3C §3 rule 2, standing owner ruling — the
 * read path deliberately differs from `computeBaseline()`'s write-path order, never aligned to
 * it). Step 2 now ALSO consults the already-injected `livePool` (no extra query) purely to pick
 * between the two `NOT_COMPARABLE` reasons — it never promotes a live count into `sampleSize`
 * (DESIGN-3C §4.3, unaffected by this ticket).
 */
describe("buildComputedPerformanceBlock — ticket #262, the below-threshold NOT_COMPARABLE reason", () => {
  it("own metric unresolved, live pool at/above threshold -> POST_METRIC_UNRESOLVED (a creator baseline genuinely exists)", () => {
    const row = baseRow({ perfReachValue: null, perfMultiplier: null, perfBaselineMedian: null });
    const result = buildComputedPerformanceBlock(row, comparators(1, 2, 3, 4, 5)); // pool of 5 === BASELINE_MIN_SAMPLE

    expect(result!.tier2!.state).toBe("NOT_COMPARABLE");
    expect(result!.tier2!.reason).toBe("POST_METRIC_UNRESOLVED");
  });

  it("own metric unresolved, live pool one below threshold -> POST_METRIC_UNRESOLVED_NO_BASELINE (no creator baseline exists)", () => {
    const row = baseRow({ perfReachValue: null, perfMultiplier: null, perfBaselineMedian: null });
    const result = buildComputedPerformanceBlock(row, comparators(1, 2, 3, 4)); // pool of 4 < 5

    expect(result!.tier2!.state).toBe("NOT_COMPARABLE");
    expect(result!.tier2!.reason).toBe("POST_METRIC_UNRESOLVED_NO_BASELINE");
  });

  it("own metric unresolved, pool of exactly 0 (empty, genuinely fetched) -> POST_METRIC_UNRESOLVED_NO_BASELINE", () => {
    const row = baseRow({ perfReachValue: null, perfMultiplier: null, perfBaselineMedian: null });
    const result = buildComputedPerformanceBlock(row, []); // genuinely fetched, empty — distinct from `undefined`

    expect(result!.tier2!.state).toBe("NOT_COMPARABLE");
    expect(result!.tier2!.reason).toBe("POST_METRIC_UNRESOLVED_NO_BASELINE");
  });

  /**
   * Direct unit call, not a reachability claim: this pins that `buildTier2` step 2 defaults
   * to the SHORT form (`POST_METRIC_UNRESOLVED_NO_BASELINE`) whenever `livePool` is nullish
   * (`undefined`, i.e. never fetched), same as a genuinely fetched below-threshold pool.
   *
   * Whether `livePool === undefined` ever actually happens in production is a separate
   * question about the route callers and the DB, not about this function — and per the
   * PR review (#271), it currently does NOT: migration 008 deleted every `schema_version IS
   * NULL` row, and the live census found 0 rows with NULL `profile_id`/`schema_version`. This
   * branch is reachable only in principle, because migration 009 recreates both columns
   * nullable. The owner's short-form ruling holds regardless — the short form is true in
   * every pool condition — this test just documents that `buildTier2` behaves correctly if a
   * future write path leaves either column NULL again.
   */
  it("own metric unresolved, livePool nullish (never fetched) -> buildTier2 step 2 defaults to POST_METRIC_UNRESOLVED_NO_BASELINE, not the separate livePool == null COLD_START branch below it", () => {
    const row = baseRow({ perfReachValue: null, perfMultiplier: null, perfBaselineMedian: null });
    const result = buildComputedPerformanceBlock(row); // no livePool argument at all

    expect(result!.tier2!.state).toBe("NOT_COMPARABLE");
    expect(result!.tier2!.reason).toBe("POST_METRIC_UNRESOLVED_NO_BASELINE");
    expect(result!.tier2!.state).not.toBe("COLD_START");
  });

  it("check-order regression: own-metric-unresolved must win even when the pool is huge — a test that fails if step 2 is ever moved below the pool-size check", () => {
    const row = baseRow({ perfReachValue: null, perfMultiplier: null, perfBaselineMedian: null });
    const result = buildComputedPerformanceBlock(row, comparators(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));

    expect(result!.tier2!.state).toBe("NOT_COMPARABLE");
    expect(result!.tier2!.reason).toBe("POST_METRIC_UNRESOLVED");
    expect(result!.tier2!.median).toBeNull();
    expect(result!.tier2!.multiplier).toBeNull();
  });

  /**
   * PR #271 review (item 2) — step 2's `poolMeetsThreshold` check (`excludeSelf(livePool,
   * row.id).length >= BASELINE_MIN_SAMPLE`) is provably a no-op on a genuine
   * `fetchLiveEligibleComparatorIds()` pool: a step-2 row has `ownMetric == null`, and that
   * function skips exactly `metric == null` candidates using the SAME `metricFor`/
   * `denominatorForBucket` pair (`baseline.ts`), so this row's own id can never appear in a
   * pool it fetched for itself. There is no way to trigger a real difference through the real
   * caller. This test injects a synthetic `livePool` containing the observed row's own id
   * directly (the same "hand-built `LiveComparator[]`" pattern every other test in this file
   * already uses for `buildTier2`, a pure function) purely to pin the `excludeSelf` CALL
   * itself: without it, a pool of 5 that happens to include the row's own id would wrongly
   * read as "at threshold" (5 >= 5) and emit the LONG form; with it, self is correctly dropped
   * first (4 < 5) and the SHORT form is emitted. Fails if `excludeSelf(...)` is replaced with
   * `livePool` directly.
   */
  it("self-exclusion pin: a live pool that (synthetically) contains the row's own id must still drop it before the threshold check", () => {
    const row = baseRow({ perfReachValue: null, perfMultiplier: null, perfBaselineMedian: null });
    const poolIncludingSelf: LiveComparator[] = [
      { id: row.id, value: 1 }, // the observed row's own id, synthetically present
      { id: "comparator-1", value: 2 },
      { id: "comparator-2", value: 3 },
      { id: "comparator-3", value: 4 },
      { id: "comparator-4", value: 5 },
    ]; // length 5 (>= BASELINE_MIN_SAMPLE) BEFORE exclusion, 4 (< BASELINE_MIN_SAMPLE) after
    const result = buildComputedPerformanceBlock(row, poolIncludingSelf);

    expect(result!.tier2!.state).toBe("NOT_COMPARABLE");
    expect(result!.tier2!.reason).toBe("POST_METRIC_UNRESOLVED_NO_BASELINE");
  });
});
