import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveInstagramReach, resolveYoutubeReach } from "@/lib/server/analysis/performance/reach";
import type { ScrapeCreatorsMedia } from "@/lib/server/scrapecreators";
import {
  makeCarousel,
  makeImageChild,
  makeImagePost,
  makeReel,
  makeVideoChild,
} from "@/tests/fixtures/synthetic/instagramMedia";

const fixturesDir = path.join(process.cwd(), ".claude/context/fixtures/scrapecreators-instagram");

function loadMedia(fixtureName: string): ScrapeCreatorsMedia {
  const raw = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, fixtureName), "utf8"),
  ) as { data: { xdt_shortcode_media: ScrapeCreatorsMedia } };
  return raw.data.xdt_shortcode_media;
}

describe("resolveInstagramReach — real fixtures (AC-4, AC-5, AC-6/AC-18)", () => {
  it("AC-4 — a top-level reel with a misleading video_view_count: 0 resolves to the authoritative video_play_count, PLAYS, TOP_LEVEL", () => {
    const media = loadMedia("ig_reel_1_zero_view_count.json");

    const result = resolveInstagramReach(media);

    expect(result).toEqual({
      value: 116_333,
      kind: "PLAYS",
      state: "AVAILABLE",
      derivedFrom: "TOP_LEVEL",
    });
  });

  it("AC-5 — a video-bearing carousel's first slide resolves VIEWS via the play/view reversal, CAROUSEL_FIRST_SLIDE", () => {
    const media = loadMedia("ig_carousel_mixed_video_and_image_10_slides.json");

    const result = resolveInstagramReach(media);

    expect(result).toEqual({
      value: 234_050,
      kind: "VIEWS",
      state: "AVAILABLE",
      derivedFrom: "CAROUSEL_FIRST_SLIDE",
    });
  });

  it("AC-6/AC-18 — an all-image carousel yields no reach value and no kind, derivedFrom NONE", () => {
    const media = loadMedia("ig_carousel_all_images_10_slides.json");

    const result = resolveInstagramReach(media);

    expect(result).toEqual({
      value: null,
      kind: null,
      state: "UNKNOWN",
      derivedFrom: "NONE",
    });
  });

  it("a single image post also yields NONE — no reach field exists on any non-video content", () => {
    const media = loadMedia("ig_single_image_post.json");

    const result = resolveInstagramReach(media);

    expect(result.derivedFrom).toBe("NONE");
    expect(result.value).toBeNull();
    expect(result.kind).toBeNull();
  });

  it("OR-20 negative assertion — reach is never negative for any committed Instagram fixture", () => {
    for (const file of fs.readdirSync(fixturesDir)) {
      // ig_profile_business_account.json is a /v1/instagram/profile capture
      // (data.user, not data.xdt_shortcode_media) — not a post payload.
      if (!file.startsWith("ig_") || !file.endsWith(".json") || file === "ig_profile_business_account.json") {
        continue;
      }
      const media = loadMedia(file);
      const result = resolveInstagramReach(media);
      if (result.value !== null) {
        expect(result.value).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("resolveInstagramReach — synthetic branch pins", () => {
  it("a genuine top-level reel with a real positive video_view_count and no play count resolves VIEWS", () => {
    const media = makeReel({ video_play_count: undefined, video_view_count: 5_000 });

    expect(resolveInstagramReach(media)).toEqual({
      value: 5_000,
      kind: "VIEWS",
      state: "AVAILABLE",
      derivedFrom: "TOP_LEVEL",
    });
  });

  it("both play and view counts corroborated at exactly 0 is a genuine ZERO, not UNKNOWN", () => {
    const media = makeReel({ video_play_count: 0, video_view_count: 0 });

    expect(resolveInstagramReach(media)).toEqual({
      value: 0,
      kind: "PLAYS",
      state: "ZERO",
      derivedFrom: "TOP_LEVEL",
    });
  });

  it("R-4.3.3 — a bare 0 view count with no play-count field at all is UNKNOWN, never ZERO", () => {
    const media = makeReel({ video_play_count: undefined, video_view_count: 0 });

    const result = resolveInstagramReach(media);

    expect(result.state).toBe("UNKNOWN");
    expect(result.value).toBeNull();
    expect(result.kind).toBe("UNKNOWN");
    expect(result.derivedFrom).toBe("TOP_LEVEL");
  });

  it("a carousel whose first slide (index 0) is an image with a later video slide still resolves NONE — the rule is literally the FIRST slide, not the first video slide", () => {
    const media = makeCarousel([
      makeImageChild(),
      makeVideoChild({ video_view_count: 999 }),
    ]);

    expect(resolveInstagramReach(media).derivedFrom).toBe("NONE");
  });

  it("an empty carousel (no children) resolves NONE rather than throwing", () => {
    const media = makeCarousel([]);

    expect(resolveInstagramReach(media)).toEqual({
      value: null,
      kind: null,
      state: "UNKNOWN",
      derivedFrom: "NONE",
    });
  });

  it("R-12.7.1 — does not branch on __typename: a non-sidecar image post with no reach fields is NONE regardless of __typename", () => {
    const media = makeImagePost();

    expect(resolveInstagramReach(media).derivedFrom).toBe("NONE");
    // The point of R-12.7.1: this must be true because the fields are
    // absent, not because __typename === "XDTGraphImage" was consulted.
    expect("video_play_count" in media).toBe(false);
    expect("video_view_count" in media).toBe(false);
  });

  it("counts as a string are accepted the same way num() does elsewhere in the codebase", () => {
    const media = makeReel({
      video_play_count: "116333" as unknown as number,
      video_view_count: 0,
    });

    expect(resolveInstagramReach(media)).toMatchObject({ value: 116_333, kind: "PLAYS" });
  });
});

describe("resolveYoutubeReach", () => {
  it("a positive viewCountInt resolves AVAILABLE / VIEWS", () => {
    expect(resolveYoutubeReach(58_622_648)).toEqual({
      value: 58_622_648,
      kind: "VIEWS",
      state: "AVAILABLE",
      derivedFrom: "TOP_LEVEL",
    });
  });

  it("null resolves UNKNOWN, never a fabricated zero", () => {
    const result = resolveYoutubeReach(null);
    expect(result.state).toBe("UNKNOWN");
    expect(result.value).toBeNull();
  });

  it("undefined (field absent) resolves UNKNOWN", () => {
    const result = resolveYoutubeReach(undefined);
    expect(result.state).toBe("UNKNOWN");
    expect(result.value).toBeNull();
  });

  it("a negative viewCountInt resolves UNKNOWN, never clamped to 0", () => {
    const result = resolveYoutubeReach(-1);
    expect(result.state).toBe("UNKNOWN");
    expect(result.value).toBeNull();
  });

  it("an explicit 0 is ZERO, not UNKNOWN — YouTube has no view/play ambiguity to cast doubt on it", () => {
    expect(resolveYoutubeReach(0)).toEqual({
      value: 0,
      kind: "VIEWS",
      state: "ZERO",
      derivedFrom: "TOP_LEVEL",
    });
  });
});
