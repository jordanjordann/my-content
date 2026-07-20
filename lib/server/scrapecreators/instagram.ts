import { SC_PATHS } from "@/lib/server/scrapecreators/constants";
import { scRequest } from "@/lib/server/scrapecreators/client";
import type {
  ScrapeCreatorsPostResponse,
  ScrapeCreatorsProfileResponse,
} from "@/lib/server/scrapecreators/types";

/**
 * Fetch a raw Instagram post/reel/carousel payload. No mapping happens here
 * — the fetcher adapter (lib/server/analysis/fetcher/adapter.ts) owns
 * translating this into MediaMetadata.
 */
export async function getInstagramPost(url: string): Promise<ScrapeCreatorsPostResponse> {
  return scRequest<ScrapeCreatorsPostResponse>(SC_PATHS.post, { url, trim: true });
}

/**
 * Fetch a raw Instagram profile payload by handle. Only called by the
 * profiles service when the cache is missing/stale and the post payload
 * did not already supply a follower count.
 */
export async function getInstagramProfile(
  handle: string,
): Promise<ScrapeCreatorsProfileResponse> {
  return scRequest<ScrapeCreatorsProfileResponse>(SC_PATHS.profile, {
    handle,
    trim: true,
  });
}
