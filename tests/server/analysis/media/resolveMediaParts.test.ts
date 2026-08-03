import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveMediaParts } from "@/lib/server/analysis/media";
import { MAX_MEDIA_PARTS } from "@/lib/server/analysis/media/constants";
import type { ScrapeCreatorsCarouselChildNode, ScrapeCreatorsMedia } from "@/lib/server/scrapecreators";
import { makeCarousel, makeImageChild, makeReel, makeVideoChild } from "@/tests/fixtures/synthetic/instagramMedia";

describe("resolveMediaParts — enumeration", () => {
  it("produces a single-element array for a non-carousel video (reel/post convergence, Step 2)", () => {
    const media: ScrapeCreatorsMedia = {
      __typename: "XDTGraphVideo",
      is_video: true,
      video_url: "https://cdn.example/reel.mp4",
      video_view_count: 100,
      video_duration: 30,
      dimensions: { width: 1080, height: 1920 },
    };

    const { parts, truncated, totalPartsBeforeCap } = resolveMediaParts(media);

    expect(parts).toHaveLength(1);
    expect(totalPartsBeforeCap).toBe(1);
    expect(truncated).toBe(false);
    expect(parts[0]).toMatchObject({ index: 0, kind: "video", url: "https://cdn.example/reel.mp4", durationSec: 30 });
  });

  it("produces an empty array for a non-carousel image post", () => {
    const media: ScrapeCreatorsMedia = {
      __typename: "XDTGraphImage",
      is_video: false,
      display_url: "https://cdn.example/post.jpg",
    };

    expect(resolveMediaParts(media).parts).toHaveLength(0);
  });

  it("carousel video parts always have a null durationSec — no duration exists on a carousel payload (C3/Q1=(a))", () => {
    const media = makeCarousel([makeVideoChild({ id: "v1" }), makeVideoChild({ id: "v2" })]);

    const { parts } = resolveMediaParts(media);
    expect(parts.every((p) => p.durationSec === null)).toBe(true);
  });

  it("C7 — discriminates kind by __typename/is_video, never by video_url presence (image children carry video_url: null)", () => {
    const imageWithNullVideoUrl = makeImageChild({ video_url: null });
    const media = makeCarousel([imageWithNullVideoUrl]);

    const { parts } = resolveMediaParts(media);
    expect(parts).toHaveLength(1);
    expect(parts[0].kind).toBe("image");
  });

  it("Q3 — SYNTHETIC: parts beyond MAX_MEDIA_PARTS (20) are dropped in document order", () => {
    const children: ScrapeCreatorsCarouselChildNode[] = Array.from({ length: 25 }, (_, i) =>
      makeImageChild({ id: `slide-${i}`, display_url: `https://cdn.example/slide-${i}.jpg` }),
    );
    const media = makeCarousel(children);

    const { parts, truncated, totalPartsBeforeCap } = resolveMediaParts(media);

    expect(totalPartsBeforeCap).toBe(25);
    expect(truncated).toBe(true);
    expect(parts).toHaveLength(MAX_MEDIA_PARTS);
    expect(parts[0].url).toBe("https://cdn.example/slide-0.jpg");
    expect(parts[MAX_MEDIA_PARTS - 1].url).toBe(`https://cdn.example/slide-${MAX_MEDIA_PARTS - 1}.jpg`);
  });

  it("does not truncate a 10-slide carousel — MAX_MEDIA_PARTS=20 does not bind on realistic payloads (Q3)", () => {
    const children = Array.from({ length: 10 }, (_, i) => makeImageChild({ id: `slide-${i}` }));
    const media = makeCarousel(children);

    const { parts, truncated } = resolveMediaParts(media);
    expect(parts).toHaveLength(10);
    expect(truncated).toBe(false);
  });
});

/**
 * D1 (ticket #110): table-driven coverage of `resolveCounts()`'s
 * `displayedCountIsPlayCount` fallback, widened to admit an ABSENT
 * `video_view_count` (not just a known-bad `0`) alongside a populated
 * `video_play_count`. Every row below drives `resolveMediaParts()` through
 * the same non-carousel `toPart()` path a reel/post takes.
 */
describe("resolveMediaParts — resolveCounts / displayedCountIsPlayCount (D1, ticket #110)", () => {
  const fixturesDir = path.join(process.cwd(), ".claude/context/fixtures/scrapecreators-instagram");

  function loadMedia(fixtureName: string): ScrapeCreatorsMedia {
    const raw = JSON.parse(fs.readFileSync(path.join(fixturesDir, fixtureName), "utf8")) as {
      data: { xdt_shortcode_media: ScrapeCreatorsMedia };
    };
    return raw.data.xdt_shortcode_media;
  }

  // N5 (PR #111 review): honestly typed as `number | null | undefined` — the
  // real payload shape ScrapeCreators can send (a key present with an
  // explicit `null`, or a key present with `undefined`) is wider than
  // `ScrapeCreatorsMedia`'s declared `number | undefined` field types, so a
  // single cast to `Partial<ScrapeCreatorsMedia>` at the object-literal
  // boundary is used instead of the previous double `as unknown as number`
  // roundtrip, which erased the type information entirely.
  const rows: { view: number | null | undefined; play: number | null | undefined; expected: boolean; label: string }[] = [
    { view: 0, play: 116_333, expected: true, label: "view=0, play=116333 (known-bad-0 regression)" },
    { view: null, play: 116_333, expected: true, label: "view=null (explicit null), play=116333 — the new D1 case" },
    { view: undefined, play: 116_333, expected: true, label: "view=undefined, play=116333" },
    { view: 0, play: null, expected: false, label: "view=0, play=null" },
    { view: 0, play: 0, expected: false, label: "view=0, play=0" },
    { view: null, play: null, expected: false, label: "view=null, play=null" },
    { view: 150_780, play: 279_641, expected: false, label: "view=150780, play=279641 — real view wins" },
  ];

  it.each(rows)("$label -> displayedCountIsPlayCount === $expected", ({ view, play, expected }) => {
    const overrides = {
      video_view_count: view,
      video_play_count: play,
    } as Partial<ScrapeCreatorsMedia>;
    const media = makeReel(overrides);

    const { parts } = resolveMediaParts(media);

    expect(parts).toHaveLength(1);
    expect(parts[0].viewCount).toBe(view ?? null);
    expect(parts[0].playCount).toBe(play ?? null);
    expect(parts[0].displayedCountIsPlayCount).toBe(expected);
  });

  it("N5 — video_view_count key GENUINELY ABSENT (not merely undefined-valued) still resolves the D1 fallback", () => {
    // Ticket #110 asked for a node where the key itself is missing from the
    // object, not just a key present with an `undefined` value — spreading
    // `{ video_view_count: undefined, ...overrides }` in `makeReel()` still
    // leaves the key present (with value `undefined`) on the resulting
    // object, which is not the same shape a real payload produces when the
    // field is truly never sent. This constructs that case explicitly.
    const media = makeReel({ video_play_count: 116_333 });
    expect("video_view_count" in media).toBe(true); // sanity: makeReel's own default is present
    delete (media as { video_view_count?: number }).video_view_count;
    expect("video_view_count" in media).toBe(false);

    const { parts } = resolveMediaParts(media);

    expect(parts[0].viewCount).toBeNull();
    expect(parts[0].playCount).toBe(116_333);
    expect(parts[0].displayedCountIsPlayCount).toBe(true);
  });

  it("pins the real trap fixture — ig_reel_1_zero_view_count.json (view=0, play=116333) -> true", () => {
    const media = loadMedia("ig_reel_1_zero_view_count.json");

    const { parts } = resolveMediaParts(media);

    expect(parts[0].viewCount).toBe(0);
    expect(parts[0].playCount).toBe(116_333);
    expect(parts[0].displayedCountIsPlayCount).toBe(true);
  });

  it("pins a real fixture with a genuine view count — ig_reel_3.json (view=150780, play=279641) -> false", () => {
    const media = loadMedia("ig_reel_3.json");

    const { parts } = resolveMediaParts(media);

    expect(parts[0].viewCount).toBe(150_780);
    expect(parts[0].playCount).toBe(279_641);
    expect(parts[0].displayedCountIsPlayCount).toBe(false);
  });

  it("the fallback structurally cannot fire for carousel video children — every video child in the real mixed carousel fixture resolves to false, playCount always null (C4)", () => {
    const media = loadMedia("ig_carousel_mixed_video_and_image_10_slides.json");

    const { parts } = resolveMediaParts(media);
    const videoParts = parts.filter((p) => p.kind === "video");

    expect(videoParts).toHaveLength(7);
    expect(videoParts.every((p) => p.playCount === null)).toBe(true);
    expect(videoParts.every((p) => p.displayedCountIsPlayCount === false)).toBe(true);
  });
});
