import { SC_PATHS } from "@/lib/server/scrapecreators/constants";
import { scRequest } from "@/lib/server/scrapecreators/client";
import type {
  ScrapeCreatorsPostEnvelope,
  ScrapeCreatorsProfileEnvelope,
} from "@/lib/server/scrapecreators/types";

/**
 * `trim: false` is deliberate — do not flip this back without re-confirming
 * the shape. Live testing (2026-07-20) against a real reel found:
 *   - `trim: true` on `/v1/instagram/post` strips the `data` envelope
 *     entirely (top-level keys become `[success, credits_remaining,
 *     xdt_shortcode_media]`), which broke every analysis: the fetcher
 *     unwraps `envelope.data?.xdt_shortcode_media`, so with `trim: true`
 *     that was always undefined.
 *   - `trim: true` also drops `dimensions` and `display_resources` from the
 *     media object — fields the adapter reads for
 *     `originalWidth`/`originalHeight` (lib/server/analysis/fetcher/adapter.ts).
 *   - `trim: false` costs the same 1 credit per call and only ~9KB more
 *     payload for a single post — negligible.
 *   - The `/v1/instagram/profile` endpoint keeps its `data.user` envelope
 *     either way, but is set to `trim: false` too for the same reasons
 *     (keep full field set, no meaningful cost difference).
 * See PR #42 description for the full trim=true vs trim=false diff.
 */
const SC_TRIM = false;

/**
 * Fetch the raw Instagram post/reel/carousel envelope. No mapping happens
 * here — the fetcher (lib/server/analysis/fetcher/instagram.ts) unwraps
 * `data.xdt_shortcode_media` and the adapter
 * (lib/server/analysis/fetcher/adapter.ts) owns translating that into
 * MediaMetadata.
 */
export async function getInstagramPost(url: string): Promise<ScrapeCreatorsPostEnvelope> {
  return scRequest<ScrapeCreatorsPostEnvelope>(SC_PATHS.post, { url, trim: SC_TRIM });
}

/**
 * Fetch a raw Instagram profile payload by handle. Only called by the
 * profiles service when the cache is missing/stale and the post payload
 * did not already supply a follower count. No mapping happens here — the
 * profiles service (lib/server/profiles/service.ts) unwraps `data.user`.
 */
export async function getInstagramProfile(
  handle: string,
): Promise<ScrapeCreatorsProfileEnvelope> {
  return scRequest<ScrapeCreatorsProfileEnvelope>(SC_PATHS.profile, {
    handle,
    trim: SC_TRIM,
  });
}
