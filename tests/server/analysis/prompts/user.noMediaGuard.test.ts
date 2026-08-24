import { describe, expect, it } from "vitest";
import { buildUserPrompt } from "@/lib/server/analysis/prompts";
import { SCORECARD_KEYS, type MediaMetadata } from "@/lib/server/analysis/types";
import { buildTestComputedPerformanceBlock } from "./testHelpers";

/**
 * Ticket #293 (#288, defence-in-depth companion to #292): when zero media
 * parts would reach Gemini, the prompt must contain an explicit prohibition
 * against visual claims. Must NOT leak into any analysis that has real
 * media — including YouTube, whose metadata never populates `mediaParts`
 * (only `videoUrl`), which is the exact regression this suite's
 * `videoUrl`-only case guards against.
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

describe("buildUserPrompt — no-media prohibition (ticket #293)", () => {
  it("emits the no-media prohibition when there are no media parts and no videoUrl", () => {
    const metadata = baseMetadata({ mediaType: "post", videoUrl: null, mediaParts: [] });

    const prompt = buildUserPrompt(metadata, "focus", buildTestComputedPerformanceBlock(metadata));

    expect(prompt).toContain("## No Media Provided");
    expect(prompt).toMatch(/MUST NOT describe or refer to anything visual/);
  });

  it("names the actual schema scorecard field (visualPolish), not the non-existent 'visualQuality'", () => {
    // Regression for review comment B1 on PR #298: the guard text once
    // referenced "visualQuality", a field that has never existed in
    // scorecardSchema/SCORECARD_KEYS/the UI. Assert against the real
    // schema's field name so this can't silently drift again — do not
    // hardcode the literal string here.
    expect(SCORECARD_KEYS).toContain("visualPolish");

    const metadata = baseMetadata({ mediaType: "post", videoUrl: null, mediaParts: [] });

    const prompt = buildUserPrompt(metadata, "focus", buildTestComputedPerformanceBlock(metadata));

    expect(prompt).toContain("visualPolish");
    expect(prompt).not.toMatch(/visualQuality/);
  });

  it("does not emit the prohibition when mediaParts carries at least one image part (Instagram images_only)", () => {
    const metadata = baseMetadata({
      mediaType: "carousel",
      videoUrl: null,
      mediaParts: [
        {
          index: 0,
          kind: "image",
          url: "https://cdn.example/1.jpg",
          durationSec: null,
          width: null,
          height: null,
          playCount: null,
          viewCount: null,
          displayedCountIsPlayCount: false,
        },
      ],
    });

    const prompt = buildUserPrompt(metadata, "focus", buildTestComputedPerformanceBlock(metadata));

    expect(prompt).not.toContain("## No Media Provided");
  });

  it("does not emit the prohibition for a normal reel/short with a videoUrl but empty mediaParts — the YouTube shape", () => {
    // fetcher/youtube.ts never populates metadata.mediaParts, only
    // metadata.videoUrl. A guard that checked mediaParts alone would falsely
    // flag every ordinary, successful YouTube analysis.
    const metadata = baseMetadata({
      mediaType: "short",
      videoUrl: "https://cdn.example/video.mp4",
      mediaParts: undefined,
    });

    const prompt = buildUserPrompt(metadata, "focus", buildTestComputedPerformanceBlock(metadata));

    expect(prompt).not.toContain("## No Media Provided");
  });

  it("does not emit the prohibition for a normal Instagram reel with a populated mediaParts video entry", () => {
    const metadata = baseMetadata({
      mediaType: "reel",
      videoUrl: "https://cdn.example/video.mp4",
      mediaParts: [
        {
          index: 0,
          kind: "video",
          url: "https://cdn.example/video.mp4",
          durationSec: 10,
          width: null,
          height: null,
          playCount: null,
          viewCount: null,
          displayedCountIsPlayCount: false,
        },
      ],
    });

    const prompt = buildUserPrompt(metadata, "focus", buildTestComputedPerformanceBlock(metadata));

    expect(prompt).not.toContain("## No Media Provided");
  });

  it("treats an empty-string videoUrl as no media (matches pipeline/index.ts's truthiness check)", () => {
    // Regression for review comment M1 on PR #298: pipeline/index.ts derives
    // mediaParts with `metadata.videoUrl ? [...] : []` — plain truthiness,
    // so an empty string is "no video". The guard must use the same check
    // (not `!= null`), or an empty-string videoUrl would suppress the guard
    // in the exact state it exists to cover.
    const metadata = baseMetadata({ mediaType: "post", videoUrl: "", mediaParts: [] });

    const prompt = buildUserPrompt(metadata, "focus", buildTestComputedPerformanceBlock(metadata));

    expect(prompt).toContain("## No Media Provided");
  });
});
