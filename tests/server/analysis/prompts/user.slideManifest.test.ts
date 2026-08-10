import { describe, expect, it } from "vitest";
import { buildUserPrompt } from "@/lib/server/analysis/prompts";
import type { MediaMetadata } from "@/lib/server/analysis/types";
import { buildTestComputedPerformanceBlock } from "./testHelpers";

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

function makeParts(indices: number[]) {
  return indices.map((index) => ({
    index,
    kind: "image" as const,
    url: `slide-${index}`,
    durationSec: null,
    width: null,
    height: null,
    playCount: null,
    viewCount: null,
    displayedCountIsPlayCount: false,
  }));
}

describe("buildUserPrompt — slide manifest header (TR-4, #182)", () => {
  it("ordinary 2-slide carousel: header carries no count, note absent", () => {
    const metadata = baseMetadata({
      mediaParts: makeParts([0, 1]),
      mediaPartsTruncated: false,
      carouselItemCount: 2,
    });

    const prompt = buildUserPrompt(metadata, "focus", buildTestComputedPerformanceBlock(metadata));

    expect(prompt).toContain("## Slides (in order)");
    expect(prompt).not.toMatch(/## Slides \(\d/);
    expect(prompt).not.toMatch(/\d+ of \d+/);
    expect(prompt).not.toContain("NOTE: not every slide");
  });

  it("null-node carousel: no header total, list's last line is '10. …', Type line carries the true total, note IS present even though mediaPartsTruncated is false", () => {
    // SYNTHETIC MUTANT: a null-node carousel — 10 pre-filter slides, one
    // null node (index 5), so only 9 real MediaParts reach the manifest.
    // mediaPartsTruncated is false (MAX_MEDIA_PARTS never engaged); the
    // gap is caught only by the widened carouselItemCount comparison.
    const indices = [0, 1, 2, 3, 4, 6, 7, 8, 9]; // index 5 is the null node — skipped
    const metadata = baseMetadata({
      mediaParts: makeParts(indices),
      mediaPartsTruncated: false,
      carouselItemCount: 10,
    });

    const prompt = buildUserPrompt(metadata, "focus", buildTestComputedPerformanceBlock(metadata));

    expect(prompt).toContain("## Slides (in order)");
    expect(prompt).not.toMatch(/## Slides \([^)]*\d[^)]*\)/);
    expect(prompt).toContain("carousel (10 slides)");
    expect(prompt).toContain("10. image");
    expect(prompt).toContain("NOTE: not every slide of this carousel is listed above");
  });

  it("over-cap carousel: note present, header carries no count, Type line carries the true total", () => {
    const indices = Array.from({ length: 20 }, (_, i) => i);
    const metadata = baseMetadata({
      mediaParts: makeParts(indices),
      mediaPartsTruncated: true,
      carouselItemCount: 34,
    });

    const prompt = buildUserPrompt(metadata, "focus", buildTestComputedPerformanceBlock(metadata));

    expect(prompt).toContain("## Slides (in order)");
    expect(prompt).not.toMatch(/## Slides \([^)]*\d[^)]*\)/);
    expect(prompt).toContain("carousel (34 slides)");
    expect(prompt).toContain("NOTE: not every slide of this carousel is listed above");
  });

  it("structural regression detector for TR-4: the rendered prompt contains exactly one /\\d+ slides?/ token — the Type: line", () => {
    const indices = [0, 1, 2, 3, 4, 6, 7, 8, 9];
    const metadata = baseMetadata({
      mediaParts: makeParts(indices),
      mediaPartsTruncated: false,
      carouselItemCount: 10,
    });

    const prompt = buildUserPrompt(metadata, "focus", buildTestComputedPerformanceBlock(metadata));
    const matches = prompt.match(/\d+ slides?/g) ?? [];

    expect(matches).toHaveLength(1);
    expect(matches[0]).toBe("10 slides");
  });
});
