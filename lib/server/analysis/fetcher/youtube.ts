import type { MediaMetadata, OwnerProfileHint } from "@/lib/server/analysis/types";
import { getYoutubeVideo } from "@/lib/server/scrapecreators";
import type { ScrapeCreatorsYoutubeVideo } from "@/lib/server/scrapecreators";
import { resolveYoutubeReach } from "@/lib/server/analysis/performance/reach";
import type { ReachResult } from "@/lib/server/analysis/performance/types";

/**
 * Ticket #295: down to ONE data source now — metadata from ScrapeCreators
 * `/v1/youtube/video` (`fetchShortMetadata`). The video itself is no longer
 * downloaded by this codebase at all: `fetcher/router.ts` hands the
 * ORIGINAL public YouTube URL straight through as `metadata.videoUrl`, and
 * `pipeline/index.ts` passes that URL to Gemini as a native
 * `fileData.fileUri` part — Google fetches the video server-side (verified,
 * `.claude/context/verified-facts.md` "Gemini — YouTube URL as direct video
 * input"). This removed `extractVideoUrl` (`yt-dlp`) and `cleanYouTubeUrl`
 * (the query-string-stripping helper `yt-dlp` needed) — neither has a
 * caller left in this codebase, and `yt-dlp` is no longer installed in the
 * deployment image (Dockerfile).
 */

/**
 * Local null-safe guards, mirroring the discipline in
 * `fetcher/adapter.ts`. Deliberately duplicated rather than shared: that file
 * is documented as the single-shape Instagram `xdt_shortcode_media` adapter
 * and must not grow YouTube branches.
 */
function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  return null;
}

/**
 * `publishDate` is ISO-8601 WITH an offset (e.g. "2011-01-19T09:40:47-08:00"),
 * NOT unix seconds — that's the Instagram convention, not this one. Normalise
 * to UTC ISO.
 */
function toIsoFromOffsetDate(value: unknown): string | null {
  const raw = str(value);
  if (raw === null) {
    return null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Maps the flat `/v1/youtube/video` payload (no `data` envelope) to
 * MediaMetadata.
 *
 * `videoUrl` is always null here — the router fills it in with the
 * ORIGINAL public YouTube URL (ticket #295, no rewrite, no download).
 *
 * Throws when `channel.handle` is missing entirely, meaning this isn't a
 * video payload — same posture as `adaptPostResponse` throwing on a missing
 * username. `username` is the `profiles` cache key `(platform, username)`, so
 * it must be the stable handle, never a display name.
 *
 * Deliberately NOT mapped (available on the payload, out of scope): keywords,
 * genre, captionTracks, isPaidPromotion, chapters. Not available at all:
 * `hasAudio`, `originalWidth`/`originalHeight` and every audio-attribution
 * field — the payload carries no dimensions and no audio flag, so those stay
 * absent rather than being inferred.
 */
export function adaptYoutubeVideo(raw: ScrapeCreatorsYoutubeVideo, url: string): MediaMetadata {
  const handle = str(raw.channel?.handle);
  if (!handle) {
    throw new Error(
      `ScrapeCreators YouTube payload for ${url} has no channel.handle — this is not a video payload`,
    );
  }

  const durationMs = num(raw.durationMs);

  return {
    url,
    shortcode: str(raw.id) ?? "",
    mediaType: "short",
    username: handle,
    caption: str(raw.description) ?? str(raw.title),
    // Always the `...Int` fields; the `...Text` siblings are human-formatted
    // ("58,622,648", "67K") and are not parseable as numbers.
    viewCount: num(raw.viewCountInt),
    postDate: toIsoFromOffsetDate(raw.publishDate),
    // Payload is MILLISECONDS.
    durationSec: durationMs === null ? null : durationMs / 1000,
    thumbnailUrl: str(raw.thumbnail),
    videoUrl: null,
    likeCount: num(raw.likeCountInt),
    commentCount: num(raw.commentCountInt),
    externalId: str(raw.channel?.id),
  };
}

/**
 * Builds an owner hint from the video payload's `channel` block, or null when
 * there is no channel.
 *
 * The hint never carries a follower count — the video payload has none — so
 * `resolveProfile`'s `ownerHintHasFollowerCount()` short-circuit will not fire
 * for YouTube and a `/v1/youtube/channel` call is always made on a cache miss.
 * That is expected; subscriber count arrives in #57.
 */
export function extractYoutubeOwnerHint(raw: ScrapeCreatorsYoutubeVideo): OwnerProfileHint | null {
  const channel = raw.channel;
  if (!channel) {
    return null;
  }

  return {
    username: str(channel.handle),
    externalId: str(channel.id),
    followerCount: null,
    followingCount: null,
    // The channel display name (e.g. "Mylo the Cat"), preserved here now that
    // `username` carries the handle.
    fullName: str(channel.title),
    profilePicUrl: null,
    biography: null,
    isVerified: null,
    isBusinessAccount: null,
    isPrivate: null,
  };
}

export interface FetchedYoutubeMetadata {
  metadata: MediaMetadata;
  ownerHint: OwnerProfileHint | null;
  /** Ticket #143 — see `FetchedInstagramMetadata.reachResult`'s doc comment for why this is computed here, not from `MediaMetadata`. */
  reachResult: ReachResult;
}

/**
 * Metadata only — this function has never shelled out to anything; the
 * playable video is now handed straight to Gemini by URL (`fetcher/
 * router.ts`, `pipeline/index.ts`), not downloaded by this codebase at all.
 */
export async function fetchShortMetadata(url: string): Promise<FetchedYoutubeMetadata> {
  // Note: the ORIGINAL url, unmodified. Nothing in this codebase rewrites
  // it any more (ticket #295 removed the last consumer of a cleaned URL).
  const raw = await getYoutubeVideo(url);

  return {
    metadata: adaptYoutubeVideo(raw, url),
    ownerHint: extractYoutubeOwnerHint(raw),
    reachResult: resolveYoutubeReach(raw.viewCountInt),
  };
}
