import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { classifyLikeCount, classifyViewCount } from "@/lib/api/analyses/helpers";

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
