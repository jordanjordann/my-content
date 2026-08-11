import type { MediaMetadata, OwnerProfileHint } from "@/lib/server/analysis/types";
import { getInstagramPost } from "@/lib/server/scrapecreators";
import { adaptPostResponse, extractOwnerProfile } from "@/lib/server/analysis/fetcher/adapter";
import { resolveInstagramReach } from "@/lib/server/analysis/performance/reach";
import type { ReachResult } from "@/lib/server/analysis/performance/types";

export interface FetchedInstagramMetadata {
  metadata: MediaMetadata;
  /**
   * Owner block extracted from the post payload, for the profiles service
   * to opportunistically hydrate from without a second API call.
   */
  ownerHint: OwnerProfileHint | null;
  /**
   * Ticket #143 (TDD §2 architecture: `adapter -> computeBlock -> prompt-
   * build`). Reach resolution (`resolveInstagramReach`) needs the raw
   * `ScrapeCreatorsMedia` payload — R-12.7.1's field-presence branching only
   * works against the real payload shape, never against `MediaMetadata`,
   * which has already lost the `edge_sidecar_to_children` / `video_play_
   * count` / `video_view_count` keys by the time it's built. Computed here,
   * where `raw` is in scope, rather than threading the raw payload itself
   * through the pipeline.
   */
  reachResult: ReachResult;
}

/**
 * Fetches Instagram post/reel/carousel metadata via ScrapeCreators and maps
 * it to MediaMetadata.
 *
 * A single request serves both the metadata and the owner hint so the
 * profiles service (ticket #33) never has to spend a second credit just to
 * learn the follower count when the post payload already carried it.
 */
export async function fetchInstagramMetadata(url: string): Promise<FetchedInstagramMetadata> {
  const envelope = await getInstagramPost(url);
  const raw = envelope.data?.xdt_shortcode_media;

  if (!raw) {
    throw new Error(`ScrapeCreators returned no xdt_shortcode_media for ${url}`);
  }

  return {
    metadata: adaptPostResponse(raw, url),
    ownerHint: extractOwnerProfile(raw),
    reachResult: resolveInstagramReach(raw),
  };
}
