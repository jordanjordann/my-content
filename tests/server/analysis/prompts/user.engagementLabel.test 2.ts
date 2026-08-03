import { describe, expect, it } from "vitest";
import { buildUserPrompt } from "@/lib/server/analysis/prompts";
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

  it("counts-disabled — neither a Views nor a Plays line is emitted, and the header falls back to N/A", () => {
    const metadata = baseMetadata({
      viewCount: null,
      playCount: null,
      displayedCountIsPlayCount: false,
      likeAndViewCountsDisabled: true,
    });

    const prompt = buildUserPrompt(metadata, "focus");

    // The header line still prints "- Views: N/A" (unchanged N/A fallback
    // behaviour) — what must be ABSENT is any populated count/rate line in
    // the "## Engagement & Technical Context" block.
    expect(prompt).toMatch(/- Views: N\/A/);
    expect(prompt).not.toContain("- Plays:");
    const contextBlock = prompt.split("## Engagement & Technical Context")[1] ?? "";
    expect(contextBlock).not.toContain("- Views:");
    expect(contextBlock).not.toContain("- View rate:");
    expect(contextBlock).not.toContain("- Play rate:");
  });
});
