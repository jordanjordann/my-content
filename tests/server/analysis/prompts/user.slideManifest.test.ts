import { describe, expect, it } from "vitest";
import { buildUserPrompt } from "@/lib/server/analysis/prompts";
import type { MediaMetadata } from "@/lib/server/analysis/types";

function baseMetadata(overrides: Partial<MediaMetadata>): MediaMetadata {
  return {
    url: "https://www.instagram.com/p/xyz/",
    shortcode: "xyz",
    mediaType: "carousel",
    username: "creator",
    caption: "caption",
    viewCount: null,
    postDate: null,
    durationSec: null,
    thumbnailUrl: null,
    videoUrl: null,
    ...overrides,
  };
}

describe("buildUserPrompt — slide manifest count label (PR #95 review item 7)", () => {
  it("reports 'N total' when nothing was truncated", () => {
    const metadata = baseMetadata({
      mediaParts: [
        { index: 0, kind: "image", url: "a", durationSec: null, width: null, height: null, playCount: null, viewCount: null, displayedCountIsPlayCount: false },
        { index: 1, kind: "image", url: "b", durationSec: null, width: null, height: null, playCount: null, viewCount: null, displayedCountIsPlayCount: false },
      ],
      mediaPartsTruncated: false,
      mediaPartsTotalBeforeCap: 2,
    });

    const prompt = buildUserPrompt(metadata, "focus");
    expect(prompt).toContain("## Slides (2 total, in order)");
  });

  it("reports 'N of M' when the manifest was truncated below the pre-cap total", () => {
    const mediaParts = Array.from({ length: 20 }, (_, i) => ({
      index: i,
      kind: "image" as const,
      url: `slide-${i}`,
      durationSec: null,
      width: null,
      height: null,
      playCount: null,
      viewCount: null,
      displayedCountIsPlayCount: false,
    }));

    const metadata = baseMetadata({
      mediaParts,
      mediaPartsTruncated: true,
      mediaPartsTotalBeforeCap: 34,
    });

    const prompt = buildUserPrompt(metadata, "focus");
    expect(prompt).toContain("## Slides (20 of 34, in order)");
  });
});
