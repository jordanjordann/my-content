import type { MediaMetadata, OwnerProfileHint } from "@/lib/server/analysis/types";
import type { ClassifiedUrl } from "@/lib/server/analysis/classifier";
import type { ReachResult } from "@/lib/server/analysis/performance/types";
import { fetchInstagramMetadata } from "./instagram";
import { fetchShortMetadata } from "./youtube";

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
 * Ticket #295: `yt-dlp` is gone from this path entirely. `metadata.videoUrl`
 * is simply the ORIGINAL public YouTube URL, unmodified — no rewrite to
 * `watch?v=`, no query-string stripping (`youtube.com/shorts/<id>` is
 * accepted as-is by Gemini's native URL input; a rewrite would only risk
 * breaking it). `pipeline/index.ts` hands this URL straight to Gemini as a
 * `fileData.fileUri` part — Google fetches the video server-side, so our
 * own egress IP being blocked no longer matters (verified,
 * `.claude/context/verified-facts.md` "Gemini — YouTube URL as direct
 * video input").
 *
 * #292's "refuse before spending a credit" ordering does NOT survive this
 * change as written: it depended on a free, local `yt-dlp` probe running
 * before the credit-costing `fetchShortMetadata` call, and that probe no
 * longer exists — there is nothing left to check for free. What DOES
 * survive is #292's underlying guarantee (never silently degrade to a
 * caption-only analysis when the video is genuinely unavailable): if
 * Gemini cannot obtain the video (private, removed, region-blocked — this
 * is a public-videos-only preview feature), `analyzeContent()` in
 * `pipeline/index.ts` throws, and the pipeline's existing delete/
 * mark-failed error handling refuses the analysis exactly as before. See
 * the YouTube branch there for the detail. The #293 prompt guard remains
 * the backstop if this preview feature is ever withdrawn.
 */
async function fetchYoutubeMetadata(url: string): Promise<FetchedMetadata> {
  const { metadata, ownerHint, reachResult } = await fetchShortMetadata(url);
  return { metadata: { ...metadata, videoUrl: url }, ownerHint, reachResult };
}
