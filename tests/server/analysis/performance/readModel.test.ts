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
  it("a full-baseline, unresolved-own-metric row (median present, multiplier null) ignores the injected live pool — its sampleSize/median stay the FROZEN stored columns, not live", () => {
    // Shape of production row 391b7615-339c-4007-9d37-6e8d48b66d21 (verified
    // against Turso, 2026-08-19): perf_baseline_median 7698,
    // perf_baseline_sample_size 5, perf_multiplier NULL, perf_reach_value
    // NULL — a full baseline exists, this post's own reach never resolved.
    // Pre-#251, `isColdStart = row.perfMultiplier == null` misclassified
    // this exact shape as cold start and let the injected live value
    // clobber sampleSize.
    const row = baseRow({
      perfMultiplier: null,
      perfBaselineMedian: 7_698,
      perfBaselineSampleSize: 5,
      perfReachValue: null,
    });

    const withoutLive = buildComputedPerformanceBlock(row);
    const withLive = buildComputedPerformanceBlock(row, comparators(1, 2, 3, 4, 5, 6, 7, 8, 9));

    expect(withoutLive!.tier2).toEqual({
      state: "NOT_COMPARABLE",
      reason: "POST_METRIC_UNRESOLVED",
      median: 7_698,
      sampleSize: 5,
      bucketKey: "instagram:reel:full_video",
      multiplier: null,
      minSample: 5,
    });
    // The injected live pool must NOT reach a NOT_COMPARABLE row's
    // sampleSize — there is no progress to report, so nothing here is live.
    expect(withLive!.tier2!.sampleSize).toBe(5);
    expect(withLive).toEqual(withoutLive);
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
  it("D8 regression fixture: a stored multiplier (8.220446869316705) stays byte-identical even though live recomputation over the SAME shape of pool would give a different number (7.82x, not 8.2x)", () => {
    // Shape of production row 3b495116-fad3-4ca0-a9fe-00e233fed936 (verified
    // against Turso, 2026-08-19): perf_multiplier 8.220446869316705,
    // perf_baseline_median 7698 (frozen, computed over a SMALLER pool at
    // write time). Its live median today, over the CURRENT 6 comparators in
    // its bucket, is 8092 (verified against production) — which would give
    // 63281 / 8092 = 7.82x if the frozen multiplier were ever recomputed.
    const row = baseRow({
      id: "3b495116-fad3-4ca0-a9fe-00e233fed936",
      perfReachValue: 63_281,
      perfMultiplier: 8.220446869316705,
      perfBaselineMedian: 7_698,
      perfBaselineSampleSize: 5,
    });

    // The live pool a caller would have batched for this row today — 6
    // comparators whose median is 8092, deliberately NOT 7698, so this test
    // fails loudly if the live path ever engages on a MEASURED row.
    const livePoolToday: LiveComparator[] = [
      { id: "dea20a90-82c4-4ec1-a3a9-8269cb3b9ce1", value: 740_570 },
      { id: "66143a31-cfc3-4dc9-b398-50217a8a5d79", value: 5_492 },
      { id: "ac3b449e-b3ff-4fbb-9a5d-bb94dec105b7", value: 169_050 },
      { id: "5eddbdce-6276-4673-b939-6e743542b081", value: 7_698 },
      { id: "adb00cf0-d744-4f8b-8333-7552108fbfb5", value: 7_229 },
      { id: "7b6948fe-fbec-4be6-a229-9054fecc73ce", value: 8_486 },
    ];

    const result = buildComputedPerformanceBlock(row, livePoolToday);

    expect(result!.tier2!.state).toBe("MEASURED");
    expect(result!.tier2!.reason).toBeNull();
    expect(result!.tier2!.multiplier).toBe(8.220446869316705);
    expect(result!.tier2!.multiplier).not.toBeCloseTo(7.82, 1);
    expect(result!.tier2!.median).toBe(7_698);
    expect(result!.tier2!.median).not.toBe(8_092);
  });

  it("production shape: dea20a90 (own reach 740570) gets a live 91.5x multiplier off a median that excludes every other giorrando reel, itself included", () => {
    // Verified against production Turso, 2026-08-19 — the full 8-row
    // giorrando `instagram:reel:full_video` pool, 7 of which resolve reach.
    const row = baseRow({
      id: "dea20a90-82c4-4ec1-a3a9-8269cb3b9ce1",
      perfReachValue: 740_570,
      perfMultiplier: null,
      perfBaselineMedian: null,
      perfBaselineSampleSize: 0,
    });
    const livePool: LiveComparator[] = [
      { id: "dea20a90-82c4-4ec1-a3a9-8269cb3b9ce1", value: 740_570 }, // self — must be excluded.
      { id: "66143a31-cfc3-4dc9-b398-50217a8a5d79", value: 5_492 },
      { id: "ac3b449e-b3ff-4fbb-9a5d-bb94dec105b7", value: 169_050 },
      { id: "5eddbdce-6276-4673-b939-6e743542b081", value: 7_698 },
      { id: "adb00cf0-d744-4f8b-8333-7552108fbfb5", value: 7_229 },
      { id: "3b495116-fad3-4ca0-a9fe-00e233fed936", value: 63_281 },
      { id: "7b6948fe-fbec-4be6-a229-9054fecc73ce", value: 8_486 },
    ];

    const result = buildComputedPerformanceBlock(row, livePool);

    // median of the 6 OTHER reels (own excluded): 5492,7229,7698,8486,63281,169050 -> (7698+8486)/2 = 8092.
    expect(result!.tier2!.median).toBe(8_092);
    expect(result!.tier2!.sampleSize).toBe(6);
    expect(result!.tier2!.state).toBe("MEASURED");
    expect(result!.tier2!.multiplier).toBeCloseTo(91.5, 1);
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
    expect(result!.tier2!.reason).toBe("POST_METRIC_UNRESOLVED");
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
});
