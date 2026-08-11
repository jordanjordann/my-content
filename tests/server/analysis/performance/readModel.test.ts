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
});
