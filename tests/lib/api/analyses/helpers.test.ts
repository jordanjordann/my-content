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
 * Ticket #147 / DESIGN-3B §3.1.1 (amendment B5) — the score-explain popover's deterministic
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

/**
 * A genuine Tier 2 cold start (§5.3) — `tier2` is present but `multiplier`/`median` are
 * `null` because the bucket hasn't reached `BASELINE_MIN_SAMPLE` yet. This is distinct from
 * `tier2 === null` (no Tier 2 at all): only this shape reaches `deriveMultiplierCell`'s
 * `kind: "cold-start"` branch. Reviewer N5 — the prior fixture (`performanceWith(score,
 * null)`) set `tier2` to `null` outright, which never exercised a cold start.
 */
function coldStartPerformanceWith(score: number | null): AnalysisPerformance {
  const base = performanceWith(score, 3.2);
  if (base == null) {
    throw new Error("performanceWith never returns null in this fixture");
  }
  return {
    ...base,
    computed: {
      ...base.computed,
      tier2: { median: null, sampleSize: 3, bucketKey: "instagram:reel:full_video", multiplier: null },
    },
  };
}

describe("deriveAnalysisTablePerformance — disagreementLine (ticket #147, DESIGN-3B §3.1.1 amendment B5)", () => {
  const D1 =
    "The 1–5 reads this more favourably than the measured comparison does — it came in under this creator's usual for this kind of post. The measured figures above are the ones to quote.";
  const D2 =
    "The 1–5 reads this less favourably than the measured comparison does — it came in over this creator's usual for this kind of post. The measured figures above are the ones to quote.";

  it("fires D2 on the canonical OR-6 row — score 2 / multiplier 3.2× (low score, high multiplier)", () => {
    const derived = deriveAnalysisTablePerformance(performanceWith(2, 3.2), "reel", null);
    expect(derived?.disagreementLine).toBe(D2);
  });

  it("fires D1 on a high score / low multiplier row", () => {
    const derived = deriveAnalysisTablePerformance(performanceWith(4, 0.6), "reel", null);
    expect(derived?.disagreementLine).toBe(D1);
  });

  it("does NOT fire when score and multiplier agree (both high)", () => {
    const derived = deriveAnalysisTablePerformance(performanceWith(4, 3.2), "reel", null);
    expect(derived?.disagreementLine).toBeNull();
  });

  it("does NOT fire when score and multiplier agree (both low)", () => {
    const derived = deriveAnalysisTablePerformance(performanceWith(2, 0.6), "reel", null);
    expect(derived?.disagreementLine).toBeNull();
  });

  it("is null when there is no score", () => {
    const derived = deriveAnalysisTablePerformance(performanceWith(null, 3.2), "reel", null);
    expect(derived?.disagreementLine).toBeNull();
  });

  it("is null at a genuine Tier 2 cold start (tier2 present, multiplier not yet measured)", () => {
    const derived = deriveAnalysisTablePerformance(coldStartPerformanceWith(4), "reel", null);
    expect(derived?.disagreementLine).toBeNull();
  });

  it("is null when there is no Tier 2 at all", () => {
    const derived = deriveAnalysisTablePerformance(performanceWith(4, null), "reel", null);
    expect(derived?.disagreementLine).toBeNull();
  });

  describe("B5 deadband boundaries — the worked case that prompted the amendment (score 3 / multiplier 0.98) and its exact edges", () => {
    it("score === 3 (the score side's own deadband) never fires, at any multiplier", () => {
      expect(deriveAnalysisTablePerformance(performanceWith(3, 0.5), "reel", null)?.disagreementLine).toBeNull();
      expect(deriveAnalysisTablePerformance(performanceWith(3, 5), "reel", null)?.disagreementLine).toBeNull();
      expect(deriveAnalysisTablePerformance(performanceWith(3, 0.98), "reel", null)?.disagreementLine).toBeNull();
    });

    it("multiplier === 0.85 is INSIDE the deadband (B5's `<=` on the low side) — no line, even with a low score", () => {
      const derived = deriveAnalysisTablePerformance(performanceWith(2, 0.85), "reel", null);
      expect(derived?.disagreementLine).toBeNull();
    });

    it("multiplier just under 0.85 is low — D1 fires with a high score", () => {
      const derived = deriveAnalysisTablePerformance(performanceWith(4, 0.849), "reel", null);
      expect(derived?.disagreementLine).toBe(D1);
    });

    it("multiplier === 1.15 is OUTSIDE the deadband (B5's `<` on the high side, i.e. `>= 1.15` is high) — D2 fires with a low score", () => {
      const derived = deriveAnalysisTablePerformance(performanceWith(2, 1.15), "reel", null);
      expect(derived?.disagreementLine).toBe(D2);
    });

    it("multiplier just under 1.15 is INSIDE the deadband — no line, even with a low score", () => {
      const derived = deriveAnalysisTablePerformance(performanceWith(2, 1.149), "reel", null);
      expect(derived?.disagreementLine).toBeNull();
    });

    it("the worked case that prompted amendment B5 — score 3 / multiplier 0.98 — renders nothing", () => {
      const derived = deriveAnalysisTablePerformance(performanceWith(3, 0.98), "reel", null);
      expect(derived?.disagreementLine).toBeNull();
    });

    it("the mirror case — score 2 / multiplier 1.02 — renders nothing (multiplier in the deadband)", () => {
      const derived = deriveAnalysisTablePerformance(performanceWith(2, 1.02), "reel", null);
      expect(derived?.disagreementLine).toBeNull();
    });
  });
});

/**
 * Ticket #205 — `commentCountState` was never derived at all (`deriveAnalysisTablePerformance`'s
 * return had no such field), which is how the Counts cell ended up rendering a hardcoded,
 * unbound `—` for comments on every row. Sourced from `performance.computed.comments`, mirroring
 * `reachCountState`'s classification from `performance.computed.reach` exactly.
 */
describe("deriveAnalysisTablePerformance — commentCountState (ticket #205)", () => {
  it("a present, non-zero comment count classifies as 'count' with the real value", () => {
    const derived = deriveAnalysisTablePerformance(performanceWith(4, 3.2), "reel", null);
    expect(derived?.commentCountState).toEqual({ kind: "count", value: 1_204 });
  });

  it("comments.state ZERO classifies as a genuine zero, not unknown", () => {
    const base = performanceWith(4, 3.2);
    if (base == null) throw new Error("performanceWith never returns null in this fixture");
    const withZeroComments: AnalysisPerformance = {
      ...base,
      computed: { ...base.computed, comments: { value: 0, state: "ZERO" } },
    };
    const derived = deriveAnalysisTablePerformance(withZeroComments, "reel", null);
    expect(derived?.commentCountState).toEqual({ kind: "zero" });
  });

  it("comments.state UNKNOWN classifies as unknown, never a fabricated 0 or a silent dash", () => {
    const base = performanceWith(4, 3.2);
    if (base == null) throw new Error("performanceWith never returns null in this fixture");
    const withUnknownComments: AnalysisPerformance = {
      ...base,
      computed: { ...base.computed, comments: { value: null, state: "UNKNOWN" } },
    };
    const derived = deriveAnalysisTablePerformance(withUnknownComments, "reel", null);
    expect(derived?.commentCountState).toEqual({ kind: "unknown" });
  });
});
