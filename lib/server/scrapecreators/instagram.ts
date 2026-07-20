import { SC_PATHS } from "@/lib/server/scrapecreators/constants";
import { scRequest } from "@/lib/server/scrapecreators/client";
import type {
  ScrapeCreatorsPostEnvelope,
  ScrapeCreatorsProfileResponse,
} from "@/lib/server/scrapecreators/types";

/**
 * Fetch the raw Instagram post/reel/carousel envelope. No mapping happens
 * here — the fetcher (lib/server/analysis/fetcher/instagram.ts) unwraps
 * `data.xdt_shortcode_media` and the adapter
 * (lib/server/analysis/fetcher/adapter.ts) owns translating that into
 * MediaMetadata.
 */
export async function getInstagramPost(url: string): Promise<ScrapeCreatorsPostEnvelope> {
  return scRequest<ScrapeCreatorsPostEnvelope>(SC_PATHS.post, { url, trim: true });
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
