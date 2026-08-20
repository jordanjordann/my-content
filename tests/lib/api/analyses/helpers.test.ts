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

  /**
   * PR #210 review B4 — the same `-1` sentinel (OR-20) `classifyLikeCount` guards is
   * reachable through `viewCount` on the identical code path (`adapter.ts` -> `hooks.ts`
   * -> `classifyViewCount` -> `formatAbbrev(-1)`, which renders the literal string "-1").
   */
  it("a negative viewCount (the -1 sentinel, OR-20) resolves to unknown, never a negative count", () => {
    expect(
      classifyViewCount({ viewCount: -1, playCount: null, likeAndViewCountsDisabled: false }),
    ).toEqual({ kind: "unknown" });
  });

  it("a negative viewCount with likeAndViewCountsDisabled absent (null) is still unknown, not hidden and not a fabricated count", () => {
    expect(
      classifyViewCount({ viewCount: -1, playCount: null, likeAndViewCountsDisabled: null }),
    ).toEqual({ kind: "unknown" });
  });

  it("a non-finite viewCount (NaN) resolves to unknown, never NaN rendered downstream", () => {
    expect(
      classifyViewCount({ viewCount: NaN, playCount: null, likeAndViewCountsDisabled: false }),
    ).toEqual({ kind: "unknown" });
  });

  /**
   * PR #210 review B5 (round 4) — `{ kind: "plays", value: -1 }` ("-1 plays") was never
   * actually reachable pre-fix: State 4's own `playCount > 0` comparison already excludes
   * any negative `playCount`, `-1` included, with no help from `sanitizeCount`. Confirmed by
   * mutation: stripping `sanitizeCount` to a passthrough (removing the guard entirely) still
   * leaves both of the next two tests passing. They pin that pre-existing `playCount > 0`
   * branch behaviour, not the sanitize step, and are kept as defence-in-depth documentation
   * of the invariant, not as regression coverage for `sanitizeCount` itself — the `Infinity`
   * playCount test below is what actually exercises that guard (it fails under the same
   * mutation).
   */
  it("a negative playCount (the -1 sentinel) resolves to unknown, never a negative plays value", () => {
    expect(
      classifyViewCount({ viewCount: null, playCount: -1, likeAndViewCountsDisabled: false }),
    ).toEqual({ kind: "unknown" });
  });

  it("a negative playCount with viewCount=0 resolves to zero, not a fabricated plays value", () => {
    expect(
      classifyViewCount({ viewCount: 0, playCount: -1, likeAndViewCountsDisabled: false }),
    ).toEqual({ kind: "zero" });
  });

  it("a non-finite playCount (Infinity) never leaks through as a fabricated plays value", () => {
    expect(
      classifyViewCount({ viewCount: 0, playCount: Infinity, likeAndViewCountsDisabled: false }),
    ).toEqual({ kind: "zero" });
  });

  /**
   * PR #210 review N10 — the one input class whose resulting `kind` the B4 sanitize step
   * actually changes: a negative `viewCount` sanitizes to `null`, which (with a real,
   * positive `playCount` present) falls into State 4 and renders `plays`, not the
   * `unknown`/fabricated-`count` result a naive `-1` would otherwise produce. Every other
   * negative/non-finite case above resolves to `unknown` or `zero`; this is the only one that
   * resolves to `plays`.
   */
  it("a negative viewCount with a real playCount present sanitizes to plays, not a fabricated negative count", () => {
    expect(
      classifyViewCount({ viewCount: -1, playCount: 116_333, likeAndViewCountsDisabled: false }),
    ).toEqual({ kind: "plays", value: 116_333 });
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

  /**
   * PR #210 review — the `-1` sentinel (OR-20, `lib/server/analysis/performance/
   * availability.ts`): a genuinely counts-disabled Instagram post can carry
   * `edge_media_preview_like.count: -1`, present and populated. If `likeAndViewCountsDisabled`
   * is itself absent on that payload, this negative guard is the only thing standing between
   * that sentinel and a fabricated on-screen count.
   */
  it("a negative likeCount (the -1 sentinel, OR-20) resolves to unknown, never a negative count or a clamped zero", () => {
    expect(classifyLikeCount({ likeCount: -1, likeAndViewCountsDisabled: false })).toEqual({
      kind: "unknown",
    });
  });

  it("a negative likeCount with likeAndViewCountsDisabled absent (null) is still unknown, not hidden and not a fabricated count", () => {
    expect(classifyLikeCount({ likeCount: -1, likeAndViewCountsDisabled: null })).toEqual({
      kind: "unknown",
    });
  });

  /**
   * PR #210 review N7 — `!Number.isFinite(input.likeCount)` had no test of its own; the
   * `< 0` clause alone was sufficient to pass every existing case. Pins the non-finite
   * branch directly so it can't silently regress.
   */
  it("a non-finite likeCount (NaN) resolves to unknown, never NaN rendered downstream", () => {
    expect(classifyLikeCount({ likeCount: NaN, likeAndViewCountsDisabled: false })).toEqual({
      kind: "unknown",
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
          : {
              median: 151_000,
              sampleSize: 7,
              bucketKey: "instagram:reel:full_video",
              multiplier,
              minSample: 5,
              state: "MEASURED",
              reason: null,
            },
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
function coldStartPerformanceWith(score: number | null, sampleSize = 3, minSample = 5): AnalysisPerformance {
  const base = performanceWith(score, 3.2);
  if (base == null) {
    throw new Error("performanceWith never returns null in this fixture");
  }
  return {
    ...base,
    computed: {
      ...base.computed,
      tier2: {
        median: null,
        sampleSize,
        bucketKey: "instagram:reel:full_video",
        multiplier: null,
        minSample,
        state: "COLD_START",
        reason: null,
      },
    },
  };
}

/**
 * Ticket #251/#252 — a NOT_COMPARABLE row (`tier2` present, `state: "NOT_COMPARABLE"`,
 * `multiplier` null). Distinct from `coldStartPerformanceWith` above, which is `state:
 * "COLD_START"`. Mirrors the server's actual output (`readModel.ts`'s `buildTier2`, PR #263):
 * `POST_METRIC_UNRESOLVED` carries `median: null` (regardless of pool size — DESIGN-3C §3
 * step 2 precedes the threshold check), `MEDIAN_ZERO` carries `median: 0`. Production row
 * `391b7615-339c-4007-9d37-6e8d48b66d21` is exactly the `POST_METRIC_UNRESOLVED` shape.
 */
function notComparablePerformanceWith(
  reason: "POST_METRIC_UNRESOLVED" | "MEDIAN_ZERO",
): AnalysisPerformance {
  const base = performanceWith(4, 3.2);
  if (base == null) {
    throw new Error("performanceWith never returns null in this fixture");
  }
  return {
    ...base,
    computed: {
      ...base.computed,
      tier2: {
        median: reason === "MEDIAN_ZERO" ? 0 : null,
        sampleSize: 5,
        bucketKey: "instagram:reel:full_video",
        multiplier: null,
        minSample: 5,
        state: "NOT_COMPARABLE",
        reason,
      },
    },
  };
}

describe("deriveAnalysisTablePerformance — multiplierCell, ticket #251's three states (not two)", () => {
  it("MEASURED — tier2.multiplier present renders 'measured', never 'not-comparable' or 'cold-start'", () => {
    const derived = deriveAnalysisTablePerformance(performanceWith(4, 3.2), "reel", null);
    expect(derived?.multiplierCell).toEqual({
      kind: "measured",
      multiplier: 3.2,
      sampleSize: 7,
      bucketNoun: "reels",
    });
  });

  it("COLD_START — tier2 present, median AND multiplier both null, renders 'cold-start' (unchanged behaviour)", () => {
    const derived = deriveAnalysisTablePerformance(coldStartPerformanceWith(4), "reel", null);
    expect(derived?.multiplierCell).toEqual({ kind: "cold-start", sampleSize: 3, minSample: 5, bucketNoun: "reels" });
  });

  it("NOT_COMPARABLE / POST_METRIC_UNRESOLVED — state carries the fact, median null, multiplier null, must NOT render 'cold-start' (the #251 bug: '5 of 5 reels')", () => {
    const derived = deriveAnalysisTablePerformance(
      notComparablePerformanceWith("POST_METRIC_UNRESOLVED"),
      "reel",
      null,
    );
    expect(derived?.multiplierCell).toEqual({ kind: "not-comparable", reason: "POST_METRIC_UNRESOLVED" });
  });

  it("NOT_COMPARABLE / MEDIAN_ZERO — median exactly 0 (not absent), multiplier null, takes the not-comparable branch, not cold start", () => {
    const derived = deriveAnalysisTablePerformance(notComparablePerformanceWith("MEDIAN_ZERO"), "reel", null);
    expect(derived?.multiplierCell).toEqual({ kind: "not-comparable", reason: "MEDIAN_ZERO" });
  });

  /**
   * PR #263 review (blocker) — production row `391b7615-339c-4007-9d37-6e8d48b66d21`
   * (`perf_multiplier NULL`, `perf_reach_value NULL`, a full live pool). Before this fix,
   * `deriveMultiplierCell` inferred state from `tier2.median != null`. The #263 BE follow-up
   * (`7ac8bde`) correctly stops passing a stale write-time median through for
   * `POST_METRIC_UNRESOLVED` — it is `null` regardless of pool size, DESIGN-3C §3 step 2 — so
   * the old nullness inference could no longer tell this row apart from a genuine cold start
   * and fell through to the "5 of 5 reels" / "builds as you analyse more" progress cell,
   * reintroducing the exact #251 defect on a live production row. Routing on `tier2.state`
   * instead fixes it without depending on `median`'s nullness at all — this is that row's
   * exact shape, proven end to end through the real `deriveAnalysisTablePerformance`.
   */
  it("391b7615 shape — perf_multiplier NULL, perf_reach_value NULL, full live pool -> renders the not-comparable statement, never cold-start", () => {
    const derived = deriveAnalysisTablePerformance(
      notComparablePerformanceWith("POST_METRIC_UNRESOLVED"),
      "reel",
      null,
    );
    expect(derived?.multiplierCell).toEqual({ kind: "not-comparable", reason: "POST_METRIC_UNRESOLVED" });
    expect(derived?.multiplierCell.kind).not.toBe("cold-start");
  });
});

/**
 * Ticket #260 — the "6 of 5" bug. `tier2.sampleSize` is a LIVE, unbounded count
 * (readModel.ts's `liveColdStartSampleSize` carve-out, ticket #206); `deriveMultiplierCell`
 * must clamp it to `tier2.minSample` (the server's own `BASELINE_MIN_SAMPLE`, carried per
 * row) rather than let the numerator exceed its own stated maximum.
 */
describe("deriveAnalysisTablePerformance — multiplierCell, ticket #260's clamp", () => {
  it("a live sampleSize (6) greater than minSample (5) is clamped to 5, never rendered as 6 of 5", () => {
    const derived = deriveAnalysisTablePerformance(coldStartPerformanceWith(4, 6, 5), "reel", null);
    expect(derived?.multiplierCell).toEqual({ kind: "cold-start", sampleSize: 5, minSample: 5, bucketNoun: "reels" });
  });

  it("a live sampleSize (6) under a raised server threshold (8) is carried unclamped, rendering 6 of 8", () => {
    const derived = deriveAnalysisTablePerformance(coldStartPerformanceWith(4, 6, 8), "reel", null);
    expect(derived?.multiplierCell).toEqual({ kind: "cold-start", sampleSize: 6, minSample: 8, bucketNoun: "reels" });
  });

  it("a live sampleSize exactly equal to minSample is unaffected by the clamp", () => {
    const derived = deriveAnalysisTablePerformance(coldStartPerformanceWith(4, 5, 5), "reel", null);
    expect(derived?.multiplierCell).toEqual({ kind: "cold-start", sampleSize: 5, minSample: 5, bucketNoun: "reels" });
  });
});

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

  /**
   * PR #210 review N1/N2 — `comments.state` is never `HIDDEN` in practice
   * (`like_and_view_counts_disabled` deliberately never gates comments), but the union type
   * is exhaustive over `HIDDEN`/`UNKNOWN`/`ZERO`/`AVAILABLE`, and this was the one arm with no
   * test. `EngagementCount`'s `hidden` treatment renders the shared, likes/views-specific
   * tooltip copy, which is the wrong explanation for a hidden comment figure — so `HIDDEN`
   * degrades to `unknown` here rather than `hidden`, and this is the assertion that would fail
   * if a future change ever reintroduced that mismatch.
   */
  it("comments.state HIDDEN degrades to unknown, never 'hidden' — there is no approved hidden-comment-count copy", () => {
    const base = performanceWith(4, 3.2);
    if (base == null) throw new Error("performanceWith never returns null in this fixture");
    const withHiddenComments: AnalysisPerformance = {
      ...base,
      computed: { ...base.computed, comments: { value: null, state: "HIDDEN" } },
    };
    const derived = deriveAnalysisTablePerformance(withHiddenComments, "reel", null);
    expect(derived?.commentCountState).toEqual({ kind: "unknown" });
  });
});
