import { describe, expect, it } from "vitest";

import {
  computeConfidence,
  computeJudgement,
  computeProvisional,
  determineTierUsed,
  renderUnavailableReasonShortForm,
  resolveHiddenCountsUnavailableReason,
  resolveUnavailableReason,
} from "@/lib/server/analysis/performance/judgement";
import { BASELINE_MIN_SAMPLE, MATURITY_FLOOR_HOURS } from "@/lib/server/analysis/performance/constants";
import type { BaselineResult, ReachResult, Tier1Ratio } from "@/lib/server/analysis/performance/types";

function reach(overrides: Partial<ReachResult> = {}): ReachResult {
  return {
    value: 100_000,
    kind: "VIEWS",
    state: "AVAILABLE",
    derivedFrom: "TOP_LEVEL",
    laterSlideReach: { usable: false },
    hasVideo: true,
    ...overrides,
  };
}

/**
 * Ticket #169 (PRD R-13.5.3/R-13.5.3a/R-13.5.3b, AC-30; TDD §5.3; DESIGN-3B
 * §5 rows 1 and 3). Scoped to exactly the two facts R-13.5.3a says must not
 * share one enum value:
 *
 *   - Row 1: the hidden-counts flag is CONFIRMED `true` -> `REACH_HIDDEN`.
 *   - Row 3: no usable performance input exists AND the flag is ABSENT
 *     (not `true`, not `false`) from the payload -> `CAUSE_NOT_DETERMINABLE`.
 *
 * The remaining five `unavailableReason` values (`REACH_UNKNOWN`,
 * `CONTENT_KIND_UNSUPPORTED`, `REACH_NOT_ON_FIRST_SLIDE`, `NO_AUDIENCE_DATA`,
 * `INSUFFICIENT_HISTORY`) are #143's full judgement module — out of scope
 * here (this function returns `null` for every case that isn't row 1 or
 * row 3, leaving those to #143).
 */
describe("resolveHiddenCountsUnavailableReason — R-13.5.3a's two-fact split", () => {
  it("flag CONFIRMED true resolves REACH_HIDDEN, never CAUSE_NOT_DETERMINABLE — even with no usable inputs at all", () => {
    const result = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: true,
      reachState: "UNKNOWN",
      likeState: "HIDDEN",
      commentState: "UNKNOWN",
    });

    expect(result).toBe("REACH_HIDDEN");
    expect(result).not.toBe("CAUSE_NOT_DETERMINABLE");
  });

  it("flag CONFIRMED true resolves REACH_HIDDEN even when other inputs (e.g. comments, unaffected by the flag) ARE usable", () => {
    const result = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: true,
      reachState: "UNKNOWN",
      likeState: "HIDDEN",
      commentState: "AVAILABLE",
    });

    expect(result).toBe("REACH_HIDDEN");
  });

  it("flag ABSENT (undefined) with no usable inputs resolves CAUSE_NOT_DETERMINABLE, never REACH_HIDDEN", () => {
    const result = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: undefined,
      reachState: "UNKNOWN",
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
    });

    expect(result).toBe("CAUSE_NOT_DETERMINABLE");
    expect(result).not.toBe("REACH_HIDDEN");
  });

  it("flag ABSENT (null) with no usable inputs also resolves CAUSE_NOT_DETERMINABLE — null and undefined are the same 'absent' fact", () => {
    const result = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: null,
      reachState: "UNKNOWN",
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
    });

    expect(result).toBe("CAUSE_NOT_DETERMINABLE");
  });

  it("flag ABSENT but a usable input exists (e.g. reach AVAILABLE) resolves neither — a score is computable, so this is not an absence case", () => {
    const result = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: undefined,
      reachState: "AVAILABLE",
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
    });

    expect(result).toBeNull();
  });

  it("a corroborated ZERO counts as a usable input (R-4.3.1) — flag absent + ZERO reach resolves neither reason", () => {
    const result = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: undefined,
      reachState: "ZERO",
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
    });

    expect(result).toBeNull();
  });

  it("flag EXPLICITLY false with no usable inputs resolves neither reason — we KNOW it isn't hidden, so R-13.5.3's 'cannot tell' does not apply; #143's other resolvers own this case", () => {
    const result = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: false,
      reachState: "UNKNOWN",
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
    });

    expect(result).toBeNull();
  });
});

/**
 * AC-30's negative assertion (PRD S9 example (c)): the `CAUSE_NOT_DETERMINABLE`
 * row must render string 3, and it must NOT assert that the creator hid
 * their counts. A test that only checked `result !== null` would pass on a
 * mapping that silently collapsed both reasons to the same string — this
 * asserts the actual rendered strings, and their inequality, which is what
 * a wrong mapping breaks.
 */
describe("renderUnavailableReasonShortForm — AC-30, DESIGN-3B §5 rows 1 and 3", () => {
  it("REACH_HIDDEN renders DESIGN-3B row 1's exact L1 string", () => {
    expect(renderUnavailableReasonShortForm("REACH_HIDDEN")).toBe("Creator hid the counts");
  });

  it("CAUSE_NOT_DETERMINABLE renders DESIGN-3B row 3's exact L1 string — string 3, not string 1", () => {
    expect(renderUnavailableReasonShortForm("CAUSE_NOT_DETERMINABLE")).toBe(
      "No performance data published",
    );
  });

  it("negative assertion (AC-30) — the CAUSE_NOT_DETERMINABLE string never asserts the creator hid their counts", () => {
    const rendered = renderUnavailableReasonShortForm("CAUSE_NOT_DETERMINABLE");

    expect(rendered).not.toBe(renderUnavailableReasonShortForm("REACH_HIDDEN"));
    expect(rendered).not.toMatch(/hid/i);
    expect(rendered).not.toMatch(/creator/i);
  });

  it("the two reasons produce two DIFFERENT strings end to end (resolve -> render)", () => {
    const hidden = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: true,
      reachState: "UNKNOWN",
      likeState: "HIDDEN",
      commentState: "UNKNOWN",
    });
    const notDeterminable = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: undefined,
      reachState: "UNKNOWN",
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
    });

    expect(hidden).not.toBeNull();
    expect(notDeterminable).not.toBeNull();
    expect(renderUnavailableReasonShortForm(hidden!)).not.toBe(
      renderUnavailableReasonShortForm(notDeterminable!),
    );
  });
});

/**
 * Ticket #144 — the widened renderer's remaining five members (the two
 * above, REACH_HIDDEN/CAUSE_NOT_DETERMINABLE, were #169's; these five are
 * new here). DESIGN-3B §5 rows 2/4 and TDD §3.1's table for the other two.
 * `INSUFFICIENT_HISTORY` is asserted `null` (no approved copy exists —
 * declared-but-unproduced, TDD §5.3) rather than any fabricated sentence.
 */
describe("renderUnavailableReasonShortForm — the full seven-member union", () => {
  it("REACH_UNKNOWN renders DESIGN-3B row 2's exact L1 string", () => {
    expect(renderUnavailableReasonShortForm("REACH_UNKNOWN")).toBe("No view count published");
  });

  it("NO_AUDIENCE_DATA renders DESIGN-3B row 4's exact L1 string", () => {
    expect(renderUnavailableReasonShortForm("NO_AUDIENCE_DATA")).toBe("No follower count available");
  });

  it("CONTENT_KIND_UNSUPPORTED renders TDD §3.1's exact sentence", () => {
    expect(renderUnavailableReasonShortForm("CONTENT_KIND_UNSUPPORTED")).toBe(
      "This post type doesn't report view counts.",
    );
  });

  it("REACH_NOT_ON_FIRST_SLIDE renders TDD §3.1's exact sentence", () => {
    expect(renderUnavailableReasonShortForm("REACH_NOT_ON_FIRST_SLIDE")).toBe(
      "Views are reported on later slides of this carousel, but the score reads the first slide only.",
    );
  });

  it("INSUFFICIENT_HISTORY renders null — no approved copy exists for a declared-but-unproduced reason", () => {
    expect(renderUnavailableReasonShortForm("INSUFFICIENT_HISTORY")).toBeNull();
  });

  it("all six non-null strings are pairwise distinct — no two reasons collapse to one sentence", () => {
    const reasons = [
      "REACH_HIDDEN",
      "REACH_UNKNOWN",
      "CAUSE_NOT_DETERMINABLE",
      "NO_AUDIENCE_DATA",
      "CONTENT_KIND_UNSUPPORTED",
      "REACH_NOT_ON_FIRST_SLIDE",
    ] as const;
    const rendered = reasons.map((reason) => renderUnavailableReasonShortForm(reason));

    expect(new Set(rendered).size).toBe(rendered.length);
  });
});

/**
 * Ticket #143 — TDD §4 confidence ladder. Every rung and all three
 * demotion reasons, asserted individually (ticket's own verification list).
 */
describe("computeConfidence — TDD §4 ladder", () => {
  const reachRatio: Tier1Ratio = { denominator: "REACH", ratio: 0.041, reachKind: "VIEWS" };
  const followerRatio: Tier1Ratio = { denominator: "FOLLOWERS", ratio: 0.02 };

  it("HIGH — Tier 2 measured, top-level reach, reach-denominated Tier 1, nothing to demote", () => {
    const result = computeConfidence({
      tierUsed: "CREATOR_BASELINE",
      reachDerivedFrom: "TOP_LEVEL",
      tier1Ratio: reachRatio,
      baselineSampleSize: BASELINE_MIN_SAMPLE,
    });
    expect(result).toEqual({ confidence: "HIGH", confidenceReason: null });
  });

  it("-1 (MEDIUM) when reach is derived from a carousel's first slide, reason CAROUSEL_FIRST_SLIDE", () => {
    const result = computeConfidence({
      tierUsed: "REACH_ONLY",
      reachDerivedFrom: "CAROUSEL_FIRST_SLIDE",
      tier1Ratio: reachRatio,
      baselineSampleSize: 0,
    });
    expect(result).toEqual({ confidence: "MEDIUM", confidenceReason: "CAROUSEL_FIRST_SLIDE" });
  });

  it("cap MEDIUM when Tier 1 is FOLLOWERS-denominated, reason CACHED_FOLLOWER_DENOMINATOR — cannot be beaten by a strong Tier 2 (never HIGH)", () => {
    const result = computeConfidence({
      tierUsed: "CREATOR_BASELINE",
      reachDerivedFrom: "NONE",
      tier1Ratio: followerRatio,
      baselineSampleSize: 50,
    });
    expect(result.confidence).toBe("MEDIUM");
    expect(result.confidence).not.toBe("HIGH");
    expect(result.confidenceReason).toBe("CACHED_FOLLOWER_DENOMINATOR");
  });

  it("cap MEDIUM when tierUsed is AUDIENCE_FALLBACK (Tier 3, always follower-denominated), reason CACHED_FOLLOWER_DENOMINATOR", () => {
    const result = computeConfidence({
      tierUsed: "AUDIENCE_FALLBACK",
      reachDerivedFrom: "TOP_LEVEL",
      tier1Ratio: null,
      baselineSampleSize: 0,
    });
    expect(result).toEqual({ confidence: "MEDIUM", confidenceReason: "CACHED_FOLLOWER_DENOMINATOR" });
  });

  it("LOW when a CREATOR_BASELINE figure's own sample is below BASELINE_MIN_SAMPLE (defence-in-depth), reason THIN_SAMPLE", () => {
    const result = computeConfidence({
      tierUsed: "CREATOR_BASELINE",
      reachDerivedFrom: "TOP_LEVEL",
      tier1Ratio: reachRatio,
      baselineSampleSize: BASELINE_MIN_SAMPLE - 1,
    });
    expect(result).toEqual({ confidence: "LOW", confidenceReason: "THIN_SAMPLE" });
  });

  it("NONE when tierUsed is UNAVAILABLE — overrides every other input, confidenceReason is null", () => {
    const result = computeConfidence({
      tierUsed: "UNAVAILABLE",
      reachDerivedFrom: "CAROUSEL_FIRST_SLIDE",
      tier1Ratio: followerRatio,
      baselineSampleSize: 0,
    });
    expect(result).toEqual({ confidence: "NONE", confidenceReason: null });
  });

  it("PR #191 review C1 — double demotion (CAROUSEL_FIRST_SLIDE AND CACHED_FOLLOWER_DENOMINATOR both fire): confidence stays MEDIUM either way, but the LAST rule to fire (rule 3, CACHED_FOLLOWER_DENOMINATOR) wins the single-valued confidenceReason — pins the documented, ruled-on ordering rather than leaving it to fall out of source order unrecorded", () => {
    const result = computeConfidence({
      tierUsed: "AUDIENCE_FALLBACK",
      reachDerivedFrom: "CAROUSEL_FIRST_SLIDE",
      tier1Ratio: null,
      baselineSampleSize: 0,
    });
    expect(result).toEqual({ confidence: "MEDIUM", confidenceReason: "CACHED_FOLLOWER_DENOMINATOR" });
    expect(result.confidenceReason).not.toBe("CAROUSEL_FIRST_SLIDE");
  });
});

describe("computeProvisional — flips exactly at MATURITY_FLOOR_HOURS", () => {
  it("younger than the floor is provisional", () => {
    expect(computeProvisional(MATURITY_FLOOR_HOURS - 1)).toBe(true);
  });

  it("exactly at the floor is NOT provisional (strict <, per PRD §4.5)", () => {
    expect(computeProvisional(MATURITY_FLOOR_HOURS)).toBe(false);
  });

  it("older than the floor is not provisional", () => {
    expect(computeProvisional(MATURITY_FLOOR_HOURS + 1)).toBe(false);
  });

  it("unresolvable post age (null) is NOT asserted as provisional — no evidence of youth", () => {
    expect(computeProvisional(null)).toBe(false);
  });
});

describe("determineTierUsed — OR-13 priority order", () => {
  const measured: BaselineResult = {
    state: "MEASURED",
    bucketKey: "instagram:reel:full_video",
    sampleSize: BASELINE_MIN_SAMPLE,
    median: 100,
    multiplier: 1.5,
  };
  const coldStart: BaselineResult = {
    state: "COLD_START",
    bucketKey: "instagram:reel:full_video",
    sampleSize: 0,
  };

  it("CREATOR_BASELINE wins whenever the baseline is MEASURED, even with a Tier 1/3 figure also present", () => {
    const reachRatio: Tier1Ratio = { denominator: "REACH", ratio: 0.04, reachKind: "VIEWS" };
    expect(
      determineTierUsed({ baseline: measured, tier1Ratio: reachRatio, tier3Ratio: { reachPerFollower: 0.1 } }),
    ).toBe("CREATOR_BASELINE");
  });

  it("REACH_ONLY when Tier 1 exists but the baseline is not MEASURED", () => {
    const reachRatio: Tier1Ratio = { denominator: "REACH", ratio: 0.04, reachKind: "VIEWS" };
    expect(determineTierUsed({ baseline: coldStart, tier1Ratio: reachRatio, tier3Ratio: null })).toBe(
      "REACH_ONLY",
    );
  });

  it("AUDIENCE_FALLBACK when only Tier 3 exists", () => {
    expect(
      determineTierUsed({ baseline: coldStart, tier1Ratio: null, tier3Ratio: { reachPerFollower: 0.2 } }),
    ).toBe("AUDIENCE_FALLBACK");
  });

  it("UNAVAILABLE when nothing is computable", () => {
    expect(determineTierUsed({ baseline: coldStart, tier1Ratio: null, tier3Ratio: null })).toBe("UNAVAILABLE");
  });
});

/**
 * Ticket #143 — TDD §5.3's seven `unavailableReason` values. Every branch
 * reachable and distinct; `CAUSE_NOT_DETERMINABLE` never produced where
 * `REACH_HIDDEN` is evidenced, and vice versa (ticket's verification list).
 */
describe("resolveUnavailableReason — every branch reachable and distinct", () => {
  it("REACH_HIDDEN wins unconditionally when the flag is confirmed true", () => {
    const result = resolveUnavailableReason({
      platform: "instagram",
      reach: reach({ state: "UNKNOWN", value: null, derivedFrom: "TOP_LEVEL" }),
      likeAndViewCountsDisabled: true,
      likeState: "HIDDEN",
      commentState: "AVAILABLE",
      followerCount: 10_000,
    });
    expect(result).toBe("REACH_HIDDEN");
  });

  it("CAUSE_NOT_DETERMINABLE when the flag is absent and nothing is usable", () => {
    const result = resolveUnavailableReason({
      platform: "instagram",
      reach: reach({ state: "UNKNOWN", value: null, kind: null, derivedFrom: "NONE" }),
      likeAndViewCountsDisabled: undefined,
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
      followerCount: null,
    });
    expect(result).toBe("CAUSE_NOT_DETERMINABLE");
    expect(result).not.toBe("REACH_HIDDEN");
  });

  it("REACH_NOT_ON_FIRST_SLIDE — Path B, mapped from laterSlideReach.usable, never re-derived", () => {
    const result = resolveUnavailableReason({
      platform: "instagram",
      reach: reach({
        state: "UNKNOWN",
        value: null,
        kind: null,
        derivedFrom: "NONE",
        laterSlideReach: { usable: true, value: 234_050, kind: "VIEWS", slideIndex: 6, slideCount: 10 },
      }),
      likeAndViewCountsDisabled: false,
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
      followerCount: null,
    });
    expect(result).toBe("REACH_NOT_ON_FIRST_SLIDE");
  });

  it("CONTENT_KIND_UNSUPPORTED — Instagram, no reach field, no later usable slide, no engagement numerator (PRD §12.6 collapse)", () => {
    const result = resolveUnavailableReason({
      platform: "instagram",
      reach: reach({ state: "UNKNOWN", value: null, kind: null, derivedFrom: "NONE" }),
      likeAndViewCountsDisabled: false,
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
      followerCount: 10_000,
    });
    expect(result).toBe("CONTENT_KIND_UNSUPPORTED");
  });

  it("NO_AUDIENCE_DATA — Instagram, no reach field, an engagement numerator exists, but no follower count (R-12.2.4)", () => {
    const result = resolveUnavailableReason({
      platform: "instagram",
      reach: reach({ state: "UNKNOWN", value: null, kind: null, derivedFrom: "NONE" }),
      likeAndViewCountsDisabled: false,
      likeState: "AVAILABLE",
      commentState: "UNKNOWN",
      followerCount: null,
    });
    expect(result).toBe("NO_AUDIENCE_DATA");
  });

  it("PR #191 review N1 — CAUSE_NOT_DETERMINABLE, never NO_AUDIENCE_DATA, when an all-image carousel has ONE usable numerator component AND a REAL follower count", () => {
    // Case 4 (owner ruling on PR #191's re-review): an all-image carousel
    // (`derivedFrom: "NONE"` — no reach field at all) where `likeState` is
    // usable but `commentState` is not (e.g. comments simply weren't
    // returned). `computeBlock.ts`'s `resolveTier1Ratio` correctly rejects
    // this PARTIAL numerator via the shared `hasComputableEngagementNumerator`
    // `&&` gate (B2) and produces no Tier 1 ratio, so `tierUsed` reaches
    // `UNAVAILABLE`. Before this fix, `resolveUnavailableReason` gated the
    // SAME question with `||` — which reads a lone usable `likeState` as
    // "an engagement numerator exists" and fell through to `NO_AUDIENCE_DATA`
    // even though `followerCount` is real (10,000) — a confident-wrong
    // "No follower count available" for a creator who HAS one.
    const result = resolveUnavailableReason({
      platform: "instagram",
      reach: reach({ state: "UNKNOWN", value: null, kind: null, derivedFrom: "NONE" }),
      likeAndViewCountsDisabled: false,
      likeState: "AVAILABLE",
      commentState: "UNKNOWN",
      followerCount: 10_000,
    });

    expect(result).toBe("CAUSE_NOT_DETERMINABLE");
    expect(result).not.toBe("NO_AUDIENCE_DATA");

    // NOTE: no assertion that the rendered copy EQUALS DESIGN-3B row 3's L1/L2
    // strings. DESIGN-3B §4.3 currently has NO row covering this case
    // (follower count known, engagement partially known via a lone usable
    // likeState, numerator not computable) — row 3's copy ("No performance
    // data published" / "...no view, like or comment data...") is FALSE for
    // this fixture, which has a real follower count (10,000) and usable
    // like data. The correct string doesn't exist yet; that's a designer's
    // call, and a design ticket to add the missing DESIGN-3B row is being
    // filed. Do not restore a `toBe("No performance data published")`
    // assertion here. The negative check below (guarding N1 — this must
    // never render row 4's "no follower count" copy) is still true and
    // stays.
    const rendered = renderUnavailableReasonShortForm(result);
    expect(rendered).not.toBe("No follower count available");
  });

  it("REACH_UNKNOWN — Instagram video content whose reach field exists but is unusable, flag confirmed false", () => {
    const result = resolveUnavailableReason({
      platform: "instagram",
      reach: reach({ state: "UNKNOWN", value: null, kind: "UNKNOWN", derivedFrom: "TOP_LEVEL" }),
      likeAndViewCountsDisabled: false,
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
      followerCount: null,
    });
    expect(result).toBe("REACH_UNKNOWN");
  });

  it("REACH_UNKNOWN — YouTube, reach unusable — never CONTENT_KIND_UNSUPPORTED or REACH_NOT_ON_FIRST_SLIDE (binding TDD §5.3 rule)", () => {
    const result = resolveUnavailableReason({
      platform: "youtube",
      reach: reach({ state: "UNKNOWN", value: null, kind: "UNKNOWN", derivedFrom: "NONE" }),
      likeAndViewCountsDisabled: undefined,
      likeState: "AVAILABLE",
      commentState: "UNKNOWN",
      followerCount: 10_000,
    });
    expect(result).toBe("REACH_UNKNOWN");
    expect(result).not.toBe("CONTENT_KIND_UNSUPPORTED");
    expect(result).not.toBe("REACH_NOT_ON_FIRST_SLIDE");
  });

  it("PR #191 review C2 — YouTube, reach unusable AND no usable engagement inputs at all — REACH_UNKNOWN, never CAUSE_NOT_DETERMINABLE. The flag being structurally absent on YouTube is not the same epistemic gap #169's resolver exists for", () => {
    // Before C2: `resolveHiddenCountsUnavailableReason` ran FIRST, saw the
    // flag absent (always true on YouTube, which has no such flag) and no
    // usable input among reach/likeState/commentState, and returned
    // CAUSE_NOT_DETERMINABLE — a fact about "can we tell if the creator hid
    // their counts", which does not even apply to this platform. The
    // truthful reason is that the reach figure itself never came back.
    const result = resolveUnavailableReason({
      platform: "youtube",
      reach: reach({ state: "UNKNOWN", value: null, kind: "UNKNOWN", derivedFrom: "NONE" }),
      likeAndViewCountsDisabled: undefined,
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
      followerCount: null,
    });
    expect(result).toBe("REACH_UNKNOWN");
    expect(result).not.toBe("CAUSE_NOT_DETERMINABLE");
  });

  it("NO_AUDIENCE_DATA — YouTube, reach usable, no follower count", () => {
    const result = resolveUnavailableReason({
      platform: "youtube",
      reach: reach({ state: "AVAILABLE", value: 50_000, kind: "VIEWS", derivedFrom: "TOP_LEVEL" }),
      likeAndViewCountsDisabled: undefined,
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
      followerCount: null,
    });
    expect(result).toBe("NO_AUDIENCE_DATA");
  });
});

/**
 * AC-30 hole (PR #179/#184 fold-in): "a CONFIRMED-FALSE hidden-counts flag
 * currently resolves to null -> no stored reason -> the UI renders blank."
 * These tests fail without the fix — before `resolveUnavailableReason`
 * existed, the only available resolver (`resolveHiddenCountsUnavailableReason`)
 * returns `null` for exactly this state, which is the blank AC-30 forbids.
 */
describe("AC-30 hole — confirmed-false hidden-counts flag with no usable inputs must never resolve to a blank/null reason", () => {
  it("proves the gap `resolveHiddenCountsUnavailableReason` alone leaves open: confirmed false + no usable input -> null", () => {
    const fromHiddenCountsResolverAlone = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: false,
      reachState: "UNKNOWN",
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
    });
    // This IS the hole: #169's resolver alone cannot see a confirmed-false
    // flag as REACH_HIDDEN (correctly — it isn't) or CAUSE_NOT_DETERMINABLE
    // (correctly — the flag isn't absent), so it returns null, and a caller
    // that stopped here would persist NULL -> a blank cell in production.
    expect(fromHiddenCountsResolverAlone).toBeNull();
  });

  it("closes the gap on all-image content (Instagram, no reach field, no engagement counts) — CONTENT_KIND_UNSUPPORTED, never null", () => {
    const result = resolveUnavailableReason({
      platform: "instagram",
      reach: reach({ state: "UNKNOWN", value: null, kind: null, derivedFrom: "NONE" }),
      likeAndViewCountsDisabled: false,
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
      followerCount: 10_000,
    });
    expect(result).not.toBeNull();
    expect(result).toBe("CONTENT_KIND_UNSUPPORTED");
  });

  it("closes the gap on video content (Instagram reel, reach field present but unusable) — REACH_UNKNOWN, never null", () => {
    const result = resolveUnavailableReason({
      platform: "instagram",
      reach: reach({ state: "UNKNOWN", value: null, kind: "UNKNOWN", derivedFrom: "TOP_LEVEL" }),
      likeAndViewCountsDisabled: false,
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
      followerCount: null,
    });
    expect(result).not.toBeNull();
    expect(result).toBe("REACH_UNKNOWN");
  });

  it("end to end via computeJudgement: confirmed-false flag, no usable inputs, no baseline -> tierUsed UNAVAILABLE with a non-null reason", () => {
    const result = computeJudgement({
      platform: "instagram",
      reach: reach({ state: "UNKNOWN", value: null, kind: null, derivedFrom: "NONE" }),
      likeAndViewCountsDisabled: false,
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
      followerCount: 10_000,
      tier1Ratio: null,
      tier3Ratio: null,
      baseline: { state: "COLD_START", bucketKey: "instagram:carousel:images_only", sampleSize: 0 },
      postAgeHours: 200,
    });
    expect(result.tierUsed).toBe("UNAVAILABLE");
    expect(result.unavailableReason).not.toBeNull();
    expect(result.unavailableReason).toBe("CONTENT_KIND_UNSUPPORTED");
  });
});

describe("computeJudgement — orchestrator", () => {
  it("basedOnVideos is always baseline.sampleSize, never null", () => {
    const result = computeJudgement({
      platform: "instagram",
      reach: reach(),
      likeAndViewCountsDisabled: false,
      likeState: "AVAILABLE",
      commentState: "AVAILABLE",
      followerCount: 10_000,
      tier1Ratio: { denominator: "REACH", ratio: 0.05, reachKind: "VIEWS" },
      tier3Ratio: null,
      baseline: { state: "COLD_START", bucketKey: "instagram:reel:full_video", sampleSize: 3 },
      postAgeHours: 200,
    });
    expect(result.basedOnVideos).toBe(3);
    expect(result.tierUsed).toBe("REACH_ONLY");
    expect(result.unavailableReason).toBeNull();
  });

  it("provisional post younger than the floor still gets a score when inputs allow it", () => {
    const result = computeJudgement({
      platform: "instagram",
      reach: reach(),
      likeAndViewCountsDisabled: false,
      likeState: "AVAILABLE",
      commentState: "AVAILABLE",
      followerCount: 10_000,
      tier1Ratio: { denominator: "REACH", ratio: 0.05, reachKind: "VIEWS" },
      tier3Ratio: null,
      baseline: { state: "COLD_START", bucketKey: "instagram:reel:full_video", sampleSize: 0 },
      postAgeHours: MATURITY_FLOOR_HOURS - 1,
    });
    expect(result.provisional).toBe(true);
    expect(result.tierUsed).toBe("REACH_ONLY");
  });
});
