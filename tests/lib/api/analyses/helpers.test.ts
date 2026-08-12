import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { classifyLikeCount, classifyViewCount, deriveAnalysisTablePerformance } from "@/lib/api/analyses/helpers";
import type { AnalysisPerformance } from "@/lib/api/analyses/types";

/**
 * Ticket #101 — table-driven tests for the two pure `CountState` classifiers
 * (TDD §4.2, §6). These call the REAL `classifyViewCount`/`classifyLikeCount`
 * exported from `lib/api/analyses/helpers.ts` directly — nothing under test is
 * mocked. Covers every branch, in the load-bearing order documented on the
 * classifiers, plus the real fixture that motivated State 4 in the first
 * place (view=0, play=116333 on a genuine captured reel).
 */
describe("classifyViewCount", () => {
  it("hidden wins first, even when a real, non-zero viewCount is also present", () => {
    expect(
      classifyViewCount({ viewCount: 500, playCount: null, likeAndViewCountsDisabled: true }),
    ).toEqual({ kind: "hidden" });
  });

  it("hidden wins first, even when viewCount is 0 and a real playCount is present (would otherwise be State 4)", () => {
    expect(
      classifyViewCount({
        viewCount: 0,
        playCount: 116_333,
        likeAndViewCountsDisabled: true,
      }),
    ).toEqual({ kind: "hidden" });
  });

  it("State 4 — viewCount=0 and playCount>0 renders as plays, not zero", () => {
    expect(
      classifyViewCount({
        viewCount: 0,
        playCount: 116_333,
        likeAndViewCountsDisabled: false,
      }),
    ).toEqual({ kind: "plays", value: 116_333 });
  });

  it("State 4 does not fire when playCount is null (carousel children: play_count is structurally null, never 0)", () => {
    expect(
      classifyViewCount({ viewCount: 0, playCount: null, likeAndViewCountsDisabled: false }),
    ).toEqual({ kind: "zero" });
  });

  it("State 4 does not fire when playCount is also 0 — falls through to genuine zero", () => {
    expect(
      classifyViewCount({ viewCount: 0, playCount: 0, likeAndViewCountsDisabled: false }),
    ).toEqual({ kind: "zero" });
  });

  it("viewCount=0 with an absent likeAndViewCountsDisabled (null, unknown) is still a genuine zero, not hidden", () => {
    expect(
      classifyViewCount({ viewCount: 0, playCount: null, likeAndViewCountsDisabled: null }),
    ).toEqual({ kind: "zero" });
  });

  it("viewCount=null is unknown, never coerced to zero", () => {
    expect(
      classifyViewCount({ viewCount: null, playCount: null, likeAndViewCountsDisabled: false }),
    ).toEqual({ kind: "unknown" });
  });

  it("viewCount=null with likeAndViewCountsDisabled=null is still unknown (not hidden, not zero)", () => {
    expect(
      classifyViewCount({ viewCount: null, playCount: null, likeAndViewCountsDisabled: null }),
    ).toEqual({ kind: "unknown" });
  });

  it("a normal non-zero viewCount renders as count", () => {
    expect(
      classifyViewCount({ viewCount: 305_044, playCount: 721_558, likeAndViewCountsDisabled: false }),
    ).toEqual({ kind: "count", value: 305_044 });
  });

  it("likeAndViewCountsDisabled=false (explicitly known-off) behaves identically to a normal count — only `true` triggers hidden", () => {
    expect(
      classifyViewCount({ viewCount: 42, playCount: null, likeAndViewCountsDisabled: false }),
    ).toEqual({ kind: "count", value: 42 });
  });

  it("State 4 fires even when likeAndViewCountsDisabled is null (unknown flag must not suppress plays)", () => {
    expect(
      classifyViewCount({ viewCount: 0, playCount: 116_333, likeAndViewCountsDisabled: null }),
    ).toEqual({ kind: "plays", value: 116_333 });
  });

  it("viewCount=null with a real playCount>0 now classifies as plays, not unknown (TDD §4.2 D1, #109)", () => {
    expect(
      classifyViewCount({ viewCount: null, playCount: 116_333, likeAndViewCountsDisabled: false }),
    ).toEqual({ kind: "plays", value: 116_333 });
  });

  it("hidden still wins over the widened State 4 when viewCount=null and a real playCount is present (#109)", () => {
    expect(
      classifyViewCount({ viewCount: null, playCount: 116_333, likeAndViewCountsDisabled: true }),
    ).toEqual({ kind: "hidden" });
  });

  it("viewCount=null with playCount=0 stays unknown — the playCount>0 guard still holds (#109)", () => {
    expect(
      classifyViewCount({ viewCount: null, playCount: 0, likeAndViewCountsDisabled: false }),
    ).toEqual({ kind: "unknown" });
  });

  it("viewCount=null with playCount=null stays unknown (#109, confirms unchanged)", () => {
    expect(
      classifyViewCount({ viewCount: null, playCount: null, likeAndViewCountsDisabled: false }),
    ).toEqual({ kind: "unknown" });
  });
});

describe("classifyLikeCount", () => {
  it("hidden wins first, even when a real likeCount is present", () => {
    expect(classifyLikeCount({ likeCount: 4_800, likeAndViewCountsDisabled: true })).toEqual({
      kind: "hidden",
    });
  });

  it("likeCount=null is unknown, never coerced to zero or false", () => {
    expect(classifyLikeCount({ likeCount: null, likeAndViewCountsDisabled: false })).toEqual({
      kind: "unknown",
    });
  });

  it("likeCount=null with likeAndViewCountsDisabled=null is still unknown, not hidden", () => {
    expect(classifyLikeCount({ likeCount: null, likeAndViewCountsDisabled: null })).toEqual({
      kind: "unknown",
    });
  });

  it("likeCount=0 (not disabled) is a genuine zero", () => {
    expect(classifyLikeCount({ likeCount: 0, likeAndViewCountsDisabled: false })).toEqual({
      kind: "zero",
    });
  });

  it("likeCount=0 with likeAndViewCountsDisabled=null is still a genuine zero, not unknown", () => {
    expect(classifyLikeCount({ likeCount: 0, likeAndViewCountsDisabled: null })).toEqual({
      kind: "zero",
    });
  });

  it("a normal non-zero likeCount renders as count — `plays` is structurally unreachable for likes", () => {
    expect(classifyLikeCount({ likeCount: 31_400, likeAndViewCountsDisabled: false })).toEqual({
      kind: "count",
      value: 31_400,
    });
  });
});

/**
 * The exact trap case called out for this ticket: a REAL committed
 * ScrapeCreators capture of a reel with `video_view_count: 0` and a genuine
 * `video_play_count: 116333`. Read straight from the fixture (no live fetch —
 * `tests/setup/blockLiveFetch.ts` stubs `fetch` to throw) to prove the
 * classifier is exercised against realistic data, not a hand-typed stand-in.
 */
describe("classifyViewCount — real fixture trap case (ig_reel_1_zero_view_count.json)", () => {
  const fixturePath = path.join(
    process.cwd(),
    ".claude/context/fixtures/scrapecreators-instagram/ig_reel_1_zero_view_count.json",
  );

  it("view=0, play=116333 on a real captured reel classifies as plays, never a false zero", () => {
    const raw = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as {
      data: { xdt_shortcode_media: { video_view_count: number; video_play_count: number } };
    };
    const media = raw.data.xdt_shortcode_media;

    expect(media.video_view_count).toBe(0);
    expect(media.video_play_count).toBe(116_333);

    const state = classifyViewCount({
      viewCount: media.video_view_count,
      playCount: media.video_play_count,
      likeAndViewCountsDisabled: false,
    });

    expect(state).toEqual({ kind: "plays", value: 116_333 });
  });
});

/**
 * Ticket #147 / TDD §9.4 point 4, DESIGN-3B §3.1 — the score-explain popover's deterministic
 * "these disagree" line, the one remaining derivation this ticket owns in the `select` layer
 * (`deriveAnalysisTablePerformance`, called from `hooks.ts`'s `select`). Exercises the REAL
 * function end to end, not a re-implementation.
 */
function performanceWith(score: number | null, multiplier: number | null): AnalysisPerformance {
  return {
    computed: {
      reach: { value: 482_100, kind: "VIEWS", derivedFrom: "TOP_LEVEL", state: "AVAILABLE" },
      likes: { value: 31_412, state: "AVAILABLE" },
      comments: { value: 1_204, state: "AVAILABLE" },
      audience: { value: 10_000, capturedAt: "2026-07-01T00:00:00.000Z", sourceFetchedAt: null },
      postAgeHours: 240,
      tier1: { denominator: "REACH", ratio: 0.068, reachKind: "VIEWS" },
      tier2:
        multiplier == null
          ? null
          : { median: 151_000, sampleSize: 7, bucketKey: "instagram:reel:full_video", multiplier },
      tier3: null,
      tierUsed: "CREATOR_BASELINE",
      confidence: "HIGH",
      confidenceReason: null,
      provisional: false,
      unavailableReason: null,
    },
    judgement: { performanceScore: score, verdict: "n/a", drivers: [] },
  };
}

describe("deriveAnalysisTablePerformance — disagreementLine (ticket #147)", () => {
  it("fires on a score-2 / multiplier-3.2× row (low score, high multiplier)", () => {
    const derived = deriveAnalysisTablePerformance(performanceWith(2, 3.2), "reel");
    expect(derived?.disagreementLine).toBe(
      "It travelled, but the people who saw it didn't engage much.",
    );
  });

  it("fires the opposite variant on a high score / low multiplier row", () => {
    const derived = deriveAnalysisTablePerformance(performanceWith(4, 0.6), "reel");
    expect(derived?.disagreementLine).toBe(
      "The people who saw it engaged, but it didn't travel far. Worth re-cutting the hook and re-posting.",
    );
  });

  it("does NOT fire when score and multiplier agree (both high)", () => {
    const derived = deriveAnalysisTablePerformance(performanceWith(4, 3.2), "reel");
    expect(derived?.disagreementLine).toBeNull();
  });

  it("does NOT fire when score and multiplier agree (both low)", () => {
    const derived = deriveAnalysisTablePerformance(performanceWith(2, 0.6), "reel");
    expect(derived?.disagreementLine).toBeNull();
  });

  it("is null when there is no score", () => {
    const derived = deriveAnalysisTablePerformance(performanceWith(null, 3.2), "reel");
    expect(derived?.disagreementLine).toBeNull();
  });

  it("is null at Tier 2 cold start (multiplier not yet measured)", () => {
    const derived = deriveAnalysisTablePerformance(performanceWith(4, null), "reel");
    expect(derived?.disagreementLine).toBeNull();
  });
});
