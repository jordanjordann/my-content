import { describe, expect, it } from "vitest";
import { buildUserPrompt, computePerformanceAssessmentBlock } from "@/lib/server/analysis/prompts";
import { assertNumeralsAreReal, assertPerformanceProseIsSafe } from "@/lib/server/analysis/prose";
import type { MediaMetadata } from "@/lib/server/analysis/types";

/**
 * D1 (ticket #110): the prompt must label a displayed play count as "Plays",
 * never silently as "Views" (epic #96 decision), and the widened D1 fallback
 * (absent video_view_count + a real video_play_count) must still surface a
 * reach metric in the prompt rather than being silently omitted.
 */
function baseMetadata(overrides: Partial<MediaMetadata>): MediaMetadata {
  return {
    url: "https://www.instagram.com/reel/abc/",
    shortcode: "abc",
    mediaType: "reel",
    username: "creator",
    caption: "caption",
    viewCount: null,
    postDate: null,
    durationSec: null,
    thumbnailUrl: null,
    videoUrl: null,
    followerCount: 10_000,
    ...overrides,
  };
}

describe("buildUserPrompt — engagement count label (D1, ticket #110)", () => {
  it("labels a displayed play count as 'Plays', never 'Views', when displayedCountIsPlayCount is true", () => {
    const metadata = baseMetadata({
      viewCount: 0,
      playCount: 116_333,
      displayedCountIsPlayCount: true,
    });

    const prompt = buildUserPrompt(metadata, "focus");

    expect(prompt).toContain("- Plays: 116,333");
    expect(prompt).not.toContain("Views: 116,333");
    expect(prompt).not.toMatch(/- Views:\s*116,333/);
    expect(prompt).toContain("- Play rate:");
    expect(prompt).not.toContain("- View rate:");
  });

  it("labels a real, non-fallback count as 'Views' when displayedCountIsPlayCount is false", () => {
    const metadata = baseMetadata({
      viewCount: 150_780,
      playCount: 279_641,
      displayedCountIsPlayCount: false,
    });

    const prompt = buildUserPrompt(metadata, "focus");

    expect(prompt).toContain("- Views: 150,780");
    expect(prompt).toContain("- View rate:");
    expect(prompt).not.toContain("- Play rate:");
    expect(prompt).not.toContain("Plays:");
  });

  it("D1 widened case — an ABSENT viewCount with a real playCount still emits the count and rate lines, post-fix regression on the silent-omission bug", () => {
    const metadata = baseMetadata({
      viewCount: null,
      playCount: 116_333,
      displayedCountIsPlayCount: true,
    });

    const prompt = buildUserPrompt(metadata, "focus");

    expect(prompt).toContain("- Plays: 116,333");
    expect(prompt).toContain("- Play rate:");
    expect(prompt).toContain("## Engagement & Technical Context");
    expect(prompt).not.toContain("- Views: N/A");
  });

  it("counts-disabled — neither a Views nor a Plays line is emitted, and the header falls back to N/A, EVEN when a play count is present (N3: hidden wins over the plays fallback)", () => {
    // PR #111 review N3: the fixture below deliberately carries a real,
    // non-null playCount alongside displayedCountIsPlayCount: true — i.e.
    // exactly the shape that would otherwise trigger the plays fallback.
    // Before N3, resolveDisplayedViewCount() never read
    // likeAndViewCountsDisabled at all, so this test only passed because
    // viewCount/playCount both happened to be null (a tautology — it proved
    // nothing about the flag). Now the hidden check short-circuits FIRST,
    // mirroring the client's classifyViewCount ordering (#101), so this is a
    // genuine assertion on the flag itself.
    const metadata = baseMetadata({
      viewCount: 0,
      playCount: 116_333,
      displayedCountIsPlayCount: true,
      likeAndViewCountsDisabled: true,
    });

    const prompt = buildUserPrompt(metadata, "focus");

    // The header line still prints "- Views: N/A" (unchanged N/A fallback
    // behaviour) — what must be ABSENT is any populated count/rate line in
    // the "## Engagement & Technical Context" block.
    expect(prompt).toMatch(/- Views: N\/A/);
    expect(prompt).not.toContain("- Plays:");
    expect(prompt).not.toContain("116,333");
    const contextBlock = prompt.split("## Engagement & Technical Context")[1] ?? "";
    expect(contextBlock).not.toContain("- Views:");
    expect(contextBlock).not.toContain("- Plays:");
    expect(contextBlock).not.toContain("- View rate:");
    expect(contextBlock).not.toContain("- Play rate:");
  });

  it("N6 — displayedCountIsPlayCount: true with playCount: null falls through to metadata.viewCount and is still labelled 'Views' (the branch N4's duplication would break first)", () => {
    const metadata = baseMetadata({
      viewCount: 42_000,
      playCount: null,
      displayedCountIsPlayCount: true,
    });

    const prompt = buildUserPrompt(metadata, "focus");

    expect(prompt).toContain("- Views: 42,000");
    expect(prompt).not.toContain("- Plays:");
    expect(prompt).toContain("- View rate:");
    expect(prompt).not.toContain("- Play rate:");
  });
});

/**
 * TDD §8.1 Half A (ticket #142/3B-4, R-13.6.4): the "Performance Assessment
 * Data" block replaces the old bare `Engagement rate: <percent>` line
 * (already removed by #139) with a single pre-formatted, denominator- and
 * kind-qualified Indonesian string the model is instructed to quote
 * verbatim, never re-derive.
 */
describe("buildUserPrompt — performance assessment block (TDD §8.1, ticket #142)", () => {
  it("labels a reach-denominated figure with the VIEWS denominator in Indonesian, and instructs verbatim quoting", () => {
    const metadata = baseMetadata({
      viewCount: 482_100,
      playCount: null,
      displayedCountIsPlayCount: false,
      likeCount: 15_000,
      commentCount: 5_000,
    });

    const prompt = buildUserPrompt(metadata, "focus");

    expect(prompt).toContain("## Performance Assessment Data");
    expect(prompt).toContain('ANGKA_ENGAGEMENT = "4,1% dari 482,1RB penayangan"');
    expect(prompt).toContain("quote ANGKA_ENGAGEMENT VERBATIM");
    expect(prompt).not.toContain("yang menonton");
  });

  it("labels a plays-denominated figure with the PLAYS wording ('yang menonton'), never 'penayangan' (R-4.3.1)", () => {
    const metadata = baseMetadata({
      viewCount: 0,
      playCount: 200_000,
      displayedCountIsPlayCount: true,
      likeCount: 10_000,
      commentCount: 0,
    });

    const prompt = buildUserPrompt(metadata, "focus");
    const performanceBlock = prompt.split("## Performance Assessment Data")[1] ?? "";

    expect(performanceBlock).toContain("yang menonton");
    expect(performanceBlock).not.toContain("penayangan");
  });

  it("falls back to a FOLLOWERS-denominated figure when no reach/play count exists", () => {
    const metadata = baseMetadata({
      mediaType: "post",
      viewCount: null,
      playCount: null,
      likeCount: 500,
      commentCount: 20,
      followerCount: 10_000,
    });

    const prompt = buildUserPrompt(metadata, "focus");
    const performanceBlock = prompt.split("## Performance Assessment Data")[1] ?? "";

    expect(performanceBlock).toContain("dari jumlah pengikut");
    expect(performanceBlock).not.toMatch(/penayangan|yang menonton/);
  });

  it("AC-22 — image-only content states no reach data exists, with no reach/views/plays token near the engagement figure", () => {
    const metadata = baseMetadata({
      mediaType: "post",
      viewCount: null,
      playCount: null,
      likeCount: 500,
      commentCount: 20,
      followerCount: 10_000,
    });
    // followerCount present -> follower-denominated figure is available;
    // this pins that no reach/views/plays token appears in the quoted
    // figure itself — the sentence the model is told to echo verbatim.
    const prompt = buildUserPrompt(metadata, "focus");
    const angkaLine = prompt.split("\n").find((line) => line.startsWith("ANGKA_ENGAGEMENT")) ?? "";

    expect(angkaLine).not.toMatch(/\breach\b/i);
    expect(angkaLine).not.toMatch(/\bviews\b/i);
    expect(angkaLine).not.toMatch(/\bplays\b/i);
    expect(angkaLine).not.toContain("penayangan");
    expect(angkaLine).not.toContain("yang menonton");
  });

  it("AC-22 — image-only content with NO engagement counts at all states plainly that no reach data exists", () => {
    const metadata = baseMetadata({
      mediaType: "post",
      viewCount: null,
      playCount: null,
      likeCount: null,
      commentCount: null,
      followerCount: null,
    });

    const prompt = buildUserPrompt(metadata, "focus");
    const performanceBlock = prompt.split("## Performance Assessment Data")[1] ?? "";

    expect(performanceBlock).toContain("TIDAK ADA data reach/views/plays");
    expect(performanceBlock).not.toContain("ANGKA_ENGAGEMENT =");
  });

  it("states which inputs are unavailable and forbids estimating them", () => {
    const metadata = baseMetadata({
      viewCount: null,
      playCount: null,
      likeCount: null,
      commentCount: null,
      followerCount: null,
    });

    const prompt = buildUserPrompt(metadata, "focus");

    expect(prompt).toContain("UNAVAILABLE");
    expect(prompt).toContain("Do NOT estimate, guess, or invent");
  });

  it("forbids comparison against the model's own priors or another post's differently-denominated ratio (R-12.5.3)", () => {
    const metadata = baseMetadata({
      viewCount: 482_100,
      likeCount: 15_000,
      commentCount: 5_000,
    });

    const prompt = buildUserPrompt(metadata, "focus");

    expect(prompt).toContain("Never compare this post's figure");
  });

  it("forbids computing or restating any number it was not given (S2)", () => {
    const metadata = baseMetadata({
      viewCount: 482_100,
      likeCount: 15_000,
      commentCount: 5_000,
    });

    const prompt = buildUserPrompt(metadata, "focus");

    expect(prompt).toContain("Never compute, derive, or restate any number you were not explicitly given above.");
  });
});

/**
 * PR #184 review, blocker 1: `resolvePerformanceAssessment()` must derive the
 * Tier 1 ratio through `performance/ratios.ts`'s canonical primitives (which
 * apply the OR-20 negative-sentinel guard), never a hand-rolled
 * `(likeCount ?? 0) + (commentCount ?? 0)` with no such guard.
 */
describe("buildUserPrompt — performance assessment block never renders a negative/sentinel count as a percentage (PR #184 review, blocker 1)", () => {
  it("a -1 likeCount availability sentinel does not reach ANGKA_ENGAGEMENT as a negative percentage — reach-denominated branch", () => {
    const metadata = baseMetadata({
      viewCount: 482_100,
      likeCount: -1,
      commentCount: 5_000,
    });

    const prompt = buildUserPrompt(metadata, "focus");
    const performanceBlock = prompt.split("## Performance Assessment Data")[1] ?? "";

    expect(performanceBlock).not.toMatch(/-\d/);
    expect(performanceBlock).not.toContain("ANGKA_ENGAGEMENT =");
    expect(performanceBlock).toContain("UNAVAILABLE");
  });

  it("a -1 commentCount availability sentinel does not reach ANGKA_ENGAGEMENT as a negative percentage — follower-denominated branch", () => {
    const metadata = baseMetadata({
      mediaType: "post",
      viewCount: null,
      playCount: null,
      likeCount: 500,
      commentCount: -1,
      followerCount: 10_000,
    });

    const prompt = buildUserPrompt(metadata, "focus");
    const performanceBlock = prompt.split("## Performance Assessment Data")[1] ?? "";

    expect(performanceBlock).not.toMatch(/-\d/);
    expect(performanceBlock).not.toContain("ANGKA_ENGAGEMENT =");
  });

  it("computePerformanceAssessmentBlock's realNumerals never carries a negative sentinel either", () => {
    const metadata = baseMetadata({
      viewCount: 482_100,
      likeCount: -1,
      commentCount: 5_000,
    });

    const block = computePerformanceAssessmentBlock(metadata);

    expect(block.realNumerals.some((n) => n < 0)).toBe(false);
  });
});

/**
 * PR #184 review, blocker 2 (AC-22 scope): `isImageOnly` must consult
 * `mediaType`, not infer "no video" purely from a null displayed view/play
 * count — both a hidden-counts reel and a video-bearing carousel produce a
 * null displayed view/play count while genuinely being video content.
 */
describe("buildUserPrompt — isImageOnly consults mediaType, not just a null view/play count (PR #184 review, blocker 2)", () => {
  it("a reel with hidden counts (likeAndViewCountsDisabled) is NOT told the image-only copy, even when playCount is also unresolved", () => {
    // `like_and_view_counts_disabled` nulls `viewCount` at the adapter
    // (fetcher/adapter.ts) but does NOT gate `playCount` — so in general a
    // hidden-counts reel can still carry a populated `playCount`. This case
    // pins the narrower, genuinely ambiguous shape: BOTH are unresolved
    // (e.g. `video_play_count` also absent on that capture), which is
    // exactly the shape the old `displayedViewCount == null &&
    // metadata.playCount == null` predicate (with no `mediaType` check)
    // misclassified as image-only.
    const metadata = baseMetadata({
      mediaType: "reel",
      viewCount: 0,
      playCount: null,
      displayedCountIsPlayCount: false,
      likeAndViewCountsDisabled: true,
      likeCount: null,
      commentCount: null,
      followerCount: 10_000,
    });

    const prompt = buildUserPrompt(metadata, "focus");
    const performanceBlock = prompt.split("## Performance Assessment Data")[1] ?? "";

    expect(performanceBlock).not.toContain("Konten ini berupa gambar");
    expect(performanceBlock).not.toContain("image-only content");
  });

  it("a video-bearing carousel (divergence 12 — video children carry video_play_count: null) is NOT told the image-only copy", () => {
    const metadata = baseMetadata({
      mediaType: "carousel",
      viewCount: null,
      playCount: null,
      likeCount: 500,
      commentCount: 20,
      followerCount: 10_000,
      carouselItemCount: 3,
      mediaParts: [
        {
          index: 0,
          kind: "video",
          url: "slide-0",
          durationSec: null,
          width: null,
          height: null,
          playCount: null,
          viewCount: 234_050,
          displayedCountIsPlayCount: false,
        },
        {
          index: 1,
          kind: "image",
          url: "slide-1",
          durationSec: null,
          width: null,
          height: null,
          playCount: null,
          viewCount: null,
          displayedCountIsPlayCount: false,
        },
        {
          index: 2,
          kind: "image",
          url: "slide-2",
          durationSec: null,
          width: null,
          height: null,
          playCount: null,
          viewCount: null,
          displayedCountIsPlayCount: false,
        },
      ],
    });

    const prompt = buildUserPrompt(metadata, "focus");
    const performanceBlock = prompt.split("## Performance Assessment Data")[1] ?? "";

    expect(performanceBlock).not.toContain("Konten ini berupa gambar");
    expect(performanceBlock).not.toContain("image-only content");
  });

  it("an all-image carousel still gets the image-only copy (AC-22, unchanged)", () => {
    const metadata = baseMetadata({
      mediaType: "carousel",
      viewCount: null,
      playCount: null,
      likeCount: null,
      commentCount: null,
      followerCount: null,
      carouselItemCount: 2,
      mediaParts: [
        {
          index: 0,
          kind: "image",
          url: "slide-0",
          durationSec: null,
          width: null,
          height: null,
          playCount: null,
          viewCount: null,
          displayedCountIsPlayCount: false,
        },
        {
          index: 1,
          kind: "image",
          url: "slide-1",
          durationSec: null,
          width: null,
          height: null,
          playCount: null,
          viewCount: null,
          displayedCountIsPlayCount: false,
        },
      ],
    });

    const prompt = buildUserPrompt(metadata, "focus");
    const performanceBlock = prompt.split("## Performance Assessment Data")[1] ?? "";

    expect(performanceBlock).toContain("Konten ini berupa gambar");
  });
});

/**
 * PR #184 review, blocker 3: Half A's "never restate any number you were not
 * explicitly given above" already permits a driver to quote the context
 * block's raw figures (likes, comments, followers, views/plays) — Half B's
 * `realNumerals` allow-list must include them too, or compliant prose throws
 * `NumeralFabricationError` after the (already-billed) Gemini call.
 */
describe("Half A / Half B reconciliation — compliant prose quoting context-block figures does not throw (PR #184 review, blocker 3)", () => {
  it("quoting the raw likes/comments count given in context does not throw, even though it is absent from ANGKA_ENGAGEMENT", () => {
    const metadata = baseMetadata({
      viewCount: 482_100,
      likeCount: 15_000,
      commentCount: 5_000,
    });
    const block = computePerformanceAssessmentBlock(metadata);

    expect(() =>
      assertPerformanceProseIsSafe(
        {
          verdict: "Konten ini mendapat 15.000 suka dan 5.000 komentar, dengan engagement 4,1% dari 482,1RB penayangan.",
          drivers: ["Jumlah suka 15.000 menunjukkan performa solid."],
        },
        block,
      ),
    ).not.toThrow();
  });

  it("quoting the raw view count (482.100), not just the abbreviated 482,1RB form, does not throw", () => {
    const metadata = baseMetadata({
      viewCount: 482_100,
      likeCount: 15_000,
      commentCount: 5_000,
    });
    const block = computePerformanceAssessmentBlock(metadata);

    expect(() =>
      assertNumeralsAreReal("Video ini ditonton 482.100 kali, cukup tinggi.", block),
    ).not.toThrow();
  });

  it("a genuinely fabricated numeral absent from both ANGKA_ENGAGEMENT and the context block still throws — non-vacuity proof", () => {
    const metadata = baseMetadata({
      viewCount: 482_100,
      likeCount: 15_000,
      commentCount: 5_000,
    });
    const block = computePerformanceAssessmentBlock(metadata);

    expect(() => assertNumeralsAreReal("Performanya naik 9.999.999 dibanding biasanya.", block)).toThrow(
      "Fabricated numeral",
    );
  });
});
