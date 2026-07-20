import type { MediaMetadata, OwnerProfileHint } from "@/lib/server/analysis/types";
import { getInstagramPost } from "@/lib/server/scrapecreators";
import { adaptPostResponse, extractOwnerProfile } from "@/lib/server/analysis/fetcher/adapter";

export interface FetchedInstagramMetadata {
  metadata: MediaMetadata;
  /**
   * Owner block extracted from the post payload, for the profiles service
   * to opportunistically hydrate from without a second API call.
   */
  ownerHint: OwnerProfileHint | null;
}

/**
 * Fetches Instagram post/reel/carousel metadata via ScrapeCreators and maps
 * it to MediaMetadata. Playwright-based scraping (browser lifecycle, IG
 * login, cookie persistence, DOM/script scraping) has been fully removed —
 * see TDD §1.1.1-2 for why plain HTTP via a paid API replaces it.
 *
 * A single request serves both the metadata and the owner hint so the
 * profiles service (ticket #33) never has to spend a second credit just to
 * learn the follower count when the post payload already carried it.
 */
export async function fetchInstagramMetadata(url: string): Promise<FetchedInstagramMetadata> {
  const raw = await getInstagramPost(url);
  return {
    metadata: adaptPostResponse(raw, url),
    ownerHint: extractOwnerProfile(raw),
  };
}
