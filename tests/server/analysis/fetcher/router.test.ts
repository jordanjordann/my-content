import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Ticket #292 (#288): `extractVideoUrl` (free) must run BEFORE
 * `fetchShortMetadata` (1 ScrapeCreators credit), and a `null` `extractVideoUrl`
 * result must throw immediately, before `fetchShortMetadata` is ever called —
 * that call-count assertion IS the credit-saving guarantee this ticket exists
 * for, not merely "it throws".
 */

const fetchShortMetadataMock = vi.fn();
const extractVideoUrlMock = vi.fn();

vi.mock("@/lib/server/analysis/fetcher/youtube", () => ({
  fetchShortMetadata: (...args: unknown[]) => fetchShortMetadataMock(...args),
  extractVideoUrl: (...args: unknown[]) => extractVideoUrlMock(...args),
}));

vi.mock("@/lib/server/analysis/fetcher/instagram", () => ({
  fetchInstagramMetadata: vi.fn(),
}));

async function importFetchMetadata() {
  const mod = await import("@/lib/server/analysis/fetcher/router");
  return mod.fetchMetadata;
}

const SHORT_URL = "https://www.youtube.com/shorts/abc123";

describe("fetchMetadata (YouTube) — refuse before spending a credit (ticket #292)", () => {
  afterEach(() => {
    vi.resetModules();
    fetchShortMetadataMock.mockReset();
    extractVideoUrlMock.mockReset();
  });

  it("throws a user-facing error and NEVER calls fetchShortMetadata when extractVideoUrl resolves null", async () => {
    extractVideoUrlMock.mockResolvedValue(null);
    const fetchMetadata = await importFetchMetadata();

    await expect(
      fetchMetadata({ platform: "youtube", url: SHORT_URL, mediaType: "short" }),
    ).rejects.toThrow(/could not download the video/i);

    expect(extractVideoUrlMock).toHaveBeenCalledTimes(1);
    expect(extractVideoUrlMock).toHaveBeenCalledWith(SHORT_URL);
    // The entire point of this ticket: a blocked Short must cost 0
    // ScrapeCreators credits, so fetchShortMetadata must never run.
    expect(fetchShortMetadataMock).not.toHaveBeenCalled();
  });

  it("thrown message says nothing was charged and does not claim the analysis completed", async () => {
    extractVideoUrlMock.mockResolvedValue(null);
    const fetchMetadata = await importFetchMetadata();

    await expect(
      fetchMetadata({ platform: "youtube", url: SHORT_URL, mediaType: "short" }),
    ).rejects.toThrow(/nothing was charged/i);
  });

  it("happy path: extractVideoUrl succeeds, fetchShortMetadata is called exactly once, videoUrl is populated", async () => {
    extractVideoUrlMock.mockResolvedValue("https://cdn.example/video.mp4");
    fetchShortMetadataMock.mockResolvedValue({
      metadata: {
        url: SHORT_URL,
        shortcode: "abc123",
        mediaType: "short",
        username: "creator",
        caption: "caption",
        viewCount: 100,
        postDate: null,
        durationSec: 12,
        thumbnailUrl: null,
        videoUrl: null,
      },
      ownerHint: null,
      reachResult: { value: 100, kind: "VIEWS", state: "AVAILABLE", derivedFrom: "TOP_LEVEL", laterSlideReach: { usable: false } },
    });
    const fetchMetadata = await importFetchMetadata();

    const result = await fetchMetadata({
      platform: "youtube",
      url: SHORT_URL,
      mediaType: "short",
    });

    expect(extractVideoUrlMock).toHaveBeenCalledTimes(1);
    expect(fetchShortMetadataMock).toHaveBeenCalledTimes(1);
    expect(fetchShortMetadataMock).toHaveBeenCalledWith(SHORT_URL);
    expect(result.metadata.videoUrl).toBe("https://cdn.example/video.mp4");
  });
});
