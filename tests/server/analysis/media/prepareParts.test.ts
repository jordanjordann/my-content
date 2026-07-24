import { afterEach, describe, expect, it, vi } from "vitest";
import type { MediaPart } from "@/lib/server/analysis/media/types";

const downloadVideo = vi.fn();
const downloadMedia = vi.fn();
const uploadToGemini = vi.fn();
const pollUntilReady = vi.fn();
const statMock = vi.fn();

vi.mock("@/lib/server/analysis/downloader", () => ({
  downloadVideo: (...args: unknown[]) => downloadVideo(...args),
  downloadMedia: (...args: unknown[]) => downloadMedia(...args),
}));

vi.mock("@/lib/server/analysis/gemini", () => ({
  uploadToGemini: (...args: unknown[]) => uploadToGemini(...args),
  pollUntilReady: (...args: unknown[]) => pollUntilReady(...args),
  getMimeType: (path: string) => (path.endsWith(".jpg") ? "image/jpeg" : "video/mp4"),
  // `getImageMimeType` is mocked away here (this file's URLs are synthetic
  // `.jpg` placeholders, not real CDN URLs) — the REAL, unmocked
  // implementation is exercised separately against a verbatim fixture
  // `display_url` in prepareParts.mimeType.test.ts (ticket #71 fix-round B1).
  getImageMimeType: (_buffer: Buffer, url: string) => (url.endsWith(".jpg") ? "image/jpeg" : "video/mp4"),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    default: {
      ...actual,
      promises: { ...actual.promises, stat: (...args: unknown[]) => statMock(...args) },
    },
    promises: { ...actual.promises, stat: (...args: unknown[]) => statMock(...args) },
  };
});

/**
 * `MAX_TOTAL_MEDIA_BYTES` (Q3) is exercised with a small override so a
 * byte-heavy, sub-cap-count carousel binds on bytes without needing 20 real
 * media files. No network I/O — downloader/gemini modules are fully mocked.
 */
describe("prepareParts — MAX_TOTAL_MEDIA_BYTES (Q3)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("enforces MAX_TOTAL_MEDIA_BYTES independently of MAX_MEDIA_PARTS on a byte-heavy sub-20-part carousel", async () => {
    vi.stubEnv("MAX_TOTAL_MEDIA_BYTES", "1000000"); // 1MB cap, well under 20 parts
    const { prepareParts } = await import("@/lib/server/analysis/media/prepareParts");

    downloadMedia.mockResolvedValue(Buffer.alloc(600_000)); // 600KB per image

    const parts: MediaPart[] = Array.from({ length: 5 }, (_, i) => ({
      index: i,
      kind: "image",
      url: `https://cdn.example/slide-${i}.jpg`,
      durationSec: null,
      width: 100,
      height: 100,
      playCount: null,
      viewCount: null,
      displayedCountIsPlayCount: false,
    }));

    const result = await prepareParts(parts);

    // 600KB + 600KB = 1.2MB > 1MB cap -> only the first image fits.
    expect(result.preparedCount).toBe(1);
    expect(result.truncatedForBytes).toBe(true);
    expect(downloadMedia).toHaveBeenCalledTimes(2);
  });

  it("does not truncate when the total stays under MAX_TOTAL_MEDIA_BYTES", async () => {
    vi.stubEnv("MAX_TOTAL_MEDIA_BYTES", "10000000"); // 10MB
    const { prepareParts } = await import("@/lib/server/analysis/media/prepareParts");

    downloadMedia.mockResolvedValue(Buffer.alloc(100_000));

    const parts: MediaPart[] = Array.from({ length: 3 }, (_, i) => ({
      index: i,
      kind: "image",
      url: `https://cdn.example/slide-${i}.jpg`,
      durationSec: null,
      width: 100,
      height: 100,
      playCount: null,
      viewCount: null,
      displayedCountIsPlayCount: false,
    }));

    const result = await prepareParts(parts);

    expect(result.preparedCount).toBe(3);
    expect(result.truncatedForBytes).toBe(false);
  });

  it("collects every video temp file path for cleanup, even the one that pushed past the byte cap", async () => {
    vi.stubEnv("MAX_TOTAL_MEDIA_BYTES", "1000000");
    const { prepareParts } = await import("@/lib/server/analysis/media/prepareParts");

    downloadVideo.mockImplementation(async (url: string) => `/tmp/${url.split("/").pop()}`);
    statMock.mockResolvedValue({ size: 700_000 });
    uploadToGemini.mockResolvedValue({ uri: "files/abc", expiresAt: "2099-01-01T00:00:00.000Z" });
    pollUntilReady.mockResolvedValue(undefined);

    const parts: MediaPart[] = [0, 1].map((i) => ({
      index: i,
      kind: "video" as const,
      url: `https://cdn.example/video-${i}.mp4`,
      durationSec: null,
      width: null,
      height: null,
      playCount: null,
      viewCount: null,
      displayedCountIsPlayCount: false,
    }));

    const result = await prepareParts(parts);

    expect(result.tempFilePaths).toHaveLength(2);
    expect(result.truncatedForBytes).toBe(true);
  });
});

describe("prepareParts — cleanup on a mid-carousel partial failure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("PreparePartsError carries every temp file written before the failure (slide 3 of 7 style)", async () => {
    const { prepareParts, PreparePartsError } = await import("@/lib/server/analysis/media/prepareParts");

    let call = 0;
    downloadVideo.mockImplementation(async () => {
      call += 1;
      if (call === 3) {
        throw new Error("network error on slide 3");
      }
      return `/tmp/video-${call}.mp4`;
    });
    statMock.mockResolvedValue({ size: 100 });
    uploadToGemini.mockResolvedValue({ uri: "files/abc", expiresAt: "2099-01-01T00:00:00.000Z" });
    pollUntilReady.mockResolvedValue(undefined);

    const parts: MediaPart[] = Array.from({ length: 7 }, (_, i) => ({
      index: i,
      kind: "video" as const,
      url: `https://cdn.example/video-${i}.mp4`,
      durationSec: null,
      width: null,
      height: null,
      playCount: null,
      viewCount: null,
      displayedCountIsPlayCount: false,
    }));

    let caught: unknown;
    try {
      await prepareParts(parts);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PreparePartsError);
    // 2 videos downloaded successfully before the 3rd call throws.
    expect((caught as InstanceType<typeof PreparePartsError>).tempFilePaths).toHaveLength(2);
  });
});
