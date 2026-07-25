import { describe, expect, it } from "vitest";

import { resolveMediaParts } from "@/lib/server/analysis/media";
import { MAX_MEDIA_PARTS } from "@/lib/server/analysis/media/constants";
import type { ScrapeCreatorsCarouselChildNode, ScrapeCreatorsMedia } from "@/lib/server/scrapecreators";
import { makeCarousel, makeImageChild, makeVideoChild } from "@/tests/fixtures/synthetic/instagramMedia";

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
