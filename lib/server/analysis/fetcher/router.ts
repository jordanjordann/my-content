import type { MediaMetadata, OwnerProfileHint } from "@/lib/server/analysis/types";
import type { ClassifiedUrl } from "@/lib/server/analysis/classifier";
import type { ReachResult } from "@/lib/server/analysis/performance/types";
import { fetchInstagramMetadata } from "./instagram";
import { fetchShortMetadata, extractVideoUrl } from "./youtube";

export interface FetchedMetadata {
  metadata: MediaMetadata;
  /**
   * Owner block from the platform payload, when it carries one. Both
   * platforms now do: Instagram from `owner`, YouTube from the
   * `/v1/youtube/video` `channel` block.
   *
   * The YouTube hint never carries a follower count (the video payload has
   * none), so `resolveProfile`'s follower-count short-circuit will not fire
   * for YouTube and a `/v1/youtube/channel` call is always made on a cache
   * miss. That is expected — see #57.
   */
  ownerHint: OwnerProfileHint | null;
  /** Ticket #143 — resolved from the raw platform payload at fetch time, before `MediaMetadata` drops the fields reach resolution needs (R-12.7.1). */
  reachResult: ReachResult;
}

/**
 * Fetches metadata for a classified URL.
 */
export async function fetchMetadata(classified: ClassifiedUrl): Promise<FetchedMetadata> {
  if (classified.platform === "youtube") {
    return fetchYoutubeMetadata(classified.url);
  }

  return fetchInstagramMetadata(classified.url);
}

/**
 * Hybrid by design: metadata comes from ScrapeCreators, the playable video
 * URL still comes from `yt-dlp` (see fetcher/youtube.ts).
 *
 * `extractVideoUrl` needs nothing but the URL, so it runs FIRST, before
 * `fetchShortMetadata` (1 ScrapeCreators credit). A `null` result here can
 * ONLY mean extraction failed — a YouTube Short is always a video, unlike
 * Instagram, where an all-image post genuinely has no video (that "legitimate
 * metadata-only" case is real for Instagram; it does NOT generalise to
 * YouTube — see fetcher/adapter.ts). So a `null` throws immediately, before
 * `fetchShortMetadata` is ever called: a Short we cannot download costs 0
 * ScrapeCreators credits instead of 1 (#288, #292).
 */
async function fetchYoutubeMetadata(url: string): Promise<FetchedMetadata> {
  const videoUrl = await extractVideoUrl(url);
  if (videoUrl === null) {
    throw new Error(
      "Could not download the video for this Short. YouTube blocked the download from our server, so no analysis was made — nothing was charged.",
    );
  }

  const { metadata, ownerHint, reachResult } = await fetchShortMetadata(url);
  return { metadata: { ...metadata, videoUrl }, ownerHint, reachResult };
}
