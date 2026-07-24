import { afterEach, describe, expect, it, vi } from "vitest";
import type { MediaPart } from "@/lib/server/analysis/media/types";

const downloadVideo = vi.fn();
const downloadMedia = vi.fn();

vi.mock("@/lib/server/analysis/downloader", () => ({
  downloadVideo: (...args: unknown[]) => downloadVideo(...args),
  downloadMedia: (...args: unknown[]) => downloadMedia(...args),
}));

// Deliberately NOT mocking "@/lib/server/analysis/gemini" here — B1 from the
// PR #95 review was missed exactly because prepareParts.test.ts mocks
// getMimeType away and feeds synthetic `.jpg` URLs. This file exercises the
// REAL getImageMimeType() against a verbatim `display_url` copied from the
// real carousel fixture, so a regression back to `getMimeType(part.url)`
// (URL-based extension parsing, which breaks on query strings) would fail
// this test with `application/octet-stream`.

/**
 * Copied VERBATIM (2026-07-24) from
 * `.claude/context/fixtures/scrapecreators-instagram/ig_carousel_mixed_video_and_image_10_slides.json`,
 * `edge_sidecar_to_children.edges[5].node.display_url` — a real,
 * non-video (image) carousel child. `filePath.split(".").pop()` on this
 * exact string yields `'com&_nc_cat=107&_nc_oc=Q6cZ2gGWxHcoe7LAo...'`
 * (from the `_nc_oc` query parameter), never `jpg` — this is the fixture
 * that proved B1.
 */
const REAL_DISPLAY_URL =
  "https://scontent-ord5-3.cdninstagram.com/v/t51.82787-15/710573029_17968221303099211_1365159253212495817_n.jpg?stp=dst-jpg_e15_fr_p1080x1080_tt6&_nc_ht=scontent-ord5-3.cdninstagram.com&_nc_cat=107&_nc_oc=Q6cZ2gGWxHcoe7LAo-9m_VWbGPCPiQinjAta0Bjvrq8rWeU1pEB9sr95H97zgc0UmZnPCUBJevdEeaITtCskbt94GBxB&_nc_ohc=TkoohID2IwQQ7kNvwGo5UCh&_nc_gid=1tXFqVieq3VScSpcOG-rAw&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQCiGRkkqfC1kH9oLp0cZN1UXMlV7tIbw1RpD9YVp8Skmw&oe=6A664B2A&_nc_sid=c6f216";

const JPEG_MAGIC_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

describe("prepareParts — real mime-type resolution against a live display_url (B1)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves a real, unmocked carousel display_url to image/jpeg, never application/octet-stream", async () => {
    const { prepareParts } = await import("@/lib/server/analysis/media/prepareParts");

    downloadMedia.mockResolvedValue(JPEG_MAGIC_BYTES);

    const parts: MediaPart[] = [
      {
        index: 5,
        kind: "image",
        url: REAL_DISPLAY_URL,
        durationSec: null,
        width: 1080,
        height: 1080,
        playCount: null,
        viewCount: null,
        displayedCountIsPlayCount: false,
      },
    ];

    const result = await prepareParts(parts);

    expect(result.preparedCount).toBe(1);
    const part = result.geminiParts[0];
    expect(part && "inlineData" in part ? part.inlineData.mimeType : null).toBe("image/jpeg");
  });

  it("falls back to image/jpeg (never application/octet-stream) for a CDN URL with no usable extension and unrecognised magic bytes", async () => {
    const { prepareParts } = await import("@/lib/server/analysis/media/prepareParts");

    // No file extension anywhere in the path, and a buffer that doesn't
    // match any known image signature — the worst case for both fallback
    // layers (magic bytes, then URL extension).
    downloadMedia.mockResolvedValue(Buffer.from([0x00, 0x01, 0x02, 0x03]));

    const parts: MediaPart[] = [
      {
        index: 0,
        kind: "image",
        url: "https://cdn.example.com/media/abcdef123456?token=opaque",
        durationSec: null,
        width: null,
        height: null,
        playCount: null,
        viewCount: null,
        displayedCountIsPlayCount: false,
      },
    ];

    const result = await prepareParts(parts);

    const part = result.geminiParts[0];
    const mimeType = part && "inlineData" in part ? part.inlineData.mimeType : null;
    expect(mimeType).not.toBe("application/octet-stream");
    expect(mimeType).toBe("image/jpeg");
  });
});
