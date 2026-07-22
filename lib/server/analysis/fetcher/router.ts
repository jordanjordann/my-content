import type { MediaMetadata, OwnerProfileHint } from "@/lib/server/analysis/types";
import type { ClassifiedUrl } from "@/lib/server/analysis/classifier";
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
 * URL still comes from `yt-dlp` (see fetcher/youtube.ts). A failed
 * `extractVideoUrl` yields `videoUrl: null`, which the pipeline treats as a
 * legitimate metadata-only analysis.
 */
async function fetchYoutubeMetadata(url: string): Promise<FetchedMetadata> {
  const { metadata, ownerHint } = await fetchShortMetadata(url);
  const videoUrl = await extractVideoUrl(url);
  return { metadata: { ...metadata, videoUrl }, ownerHint };
}
