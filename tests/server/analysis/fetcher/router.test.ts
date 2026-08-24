import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Ticket #295 (#288): `extractVideoUrl`/`yt-dlp` is gone from this path.
 * `fetchYoutubeMetadata` now does exactly one thing: call `fetchShortMetadata`
 * (ScrapeCreators) and set `metadata.videoUrl` to the ORIGINAL, UNMODIFIED
 * URL — no rewrite, no download. `pipeline/index.ts` hands that URL straight
 * to Gemini as a native `fileData.fileUri` part (see
 * `tests/server/analysis/pipeline/youtubeNativeUrl.test.ts` for that side).
 *
 * Supersedes the old ticket #292 suite here, which asserted a free
 * `extractVideoUrl` pre-check ran before the credit-costing
 * `fetchShortMetadata` call and threw on a null result. That pre-check no
 * longer exists — #292's underlying "never fabricate on a genuinely
 * unavailable video" guarantee moved to the pipeline's Gemini call site
 * instead (see the pipeline test above).
 */

const fetchShortMetadataMock = vi.fn();

vi.mock("@/lib/server/analysis/fetcher/youtube", () => ({
  fetchShortMetadata: (...args: unknown[]) => fetchShortMetadataMock(...args),
}));

vi.mock("@/lib/server/analysis/fetcher/instagram", () => ({
  fetchInstagramMetadata: vi.fn(),
}));

async function importFetchMetadata() {
  const mod = await import("@/lib/server/analysis/fetcher/router");
  return mod.fetchMetadata;
}

// Deliberately a `shorts/<id>` URL WITH a query string, to prove nothing in
// this path strips it (the old `cleanYouTubeUrl` behaviour, which this
// ticket removed as a caller entirely).
const SHORT_URL = "https://www.youtube.com/shorts/abc123?feature=share";

describe("fetchMetadata (YouTube) — native URL input, no yt-dlp (ticket #295)", () => {
  afterEach(() => {
    vi.resetModules();
    fetchShortMetadataMock.mockReset();
  });

  it("calls fetchShortMetadata exactly once with the ORIGINAL url, and sets metadata.videoUrl to that same unmodified url", async () => {
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
      reachResult: {
        value: 100,
        kind: "VIEWS",
        state: "AVAILABLE",
        derivedFrom: "TOP_LEVEL",
        laterSlideReach: { usable: false },
      },
    });

    const fetchMetadata = await importFetchMetadata();

    const result = await fetchMetadata({ platform: "youtube", url: SHORT_URL, mediaType: "short" });

    expect(fetchShortMetadataMock).toHaveBeenCalledTimes(1);
    expect(fetchShortMetadataMock).toHaveBeenCalledWith(SHORT_URL);
    // The exact, byte-identical URL — no watch?v= rewrite, no stripped
    // query string.
    expect(result.metadata.videoUrl).toBe(SHORT_URL);
  });

  it("propagates a fetchShortMetadata failure (e.g. ScrapeCreators 404) without inventing a videoUrl", async () => {
    fetchShortMetadataMock.mockRejectedValue(new Error("ScrapeCreators request failed: status 404"));

    const fetchMetadata = await importFetchMetadata();

    await expect(fetchMetadata({ platform: "youtube", url: SHORT_URL, mediaType: "short" })).rejects.toThrow(
      /status 404/,
    );
  });
});
