import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MediaMetadata, OwnerProfileHint } from "@/lib/server/analysis/types";
import { getYoutubeVideo } from "@/lib/server/scrapecreators";
import type { ScrapeCreatorsYoutubeVideo } from "@/lib/server/scrapecreators";

/**
 * Two data sources in one file, deliberately (ticket #54):
 *
 *   - Metadata  -> ScrapeCreators `/v1/youtube/video` (`fetchShortMetadata`).
 *   - Video URL -> `yt-dlp` (`extractVideoUrl`), which is the only thing that
 *     works. yt-dlp deciphers YouTube signatures locally so the resulting URL
 *     binds to our IP; ScrapeCreators' media URLs are IP-locked to their own
 *     scrapers and 403 from our server, and `downloadOptions.formats` came
 *     back empty on the real payload (see .claude/context/verified-facts.md).
 */

const execFileAsync = promisify(execFile);

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/**
 * Strips the query string before handing the URL to `yt-dlp`.
 *
 * DESTRUCTIVE for any `watch?v=` style URL — it would strip the video id
 * itself. That is safe today only because the classifier accepts
 * `youtube.com/shorts/...` exclusively, where the id lives in the path. If
 * YouTube support is ever widened, this helper must be reworked first (the
 * widening was considered and rejected — see #58).
 *
 * Applies to the `yt-dlp` path ONLY. The URL passed to ScrapeCreators is the
 * caller's original URL, untouched.
 */
function cleanYouTubeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

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
 * `videoUrl` is always null here — the router fills it from
 * `extractVideoUrl`.
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
}

/**
 * Metadata only — this function no longer shells out at all. The playable
 * video URL comes from `extractVideoUrl` via the router.
 */
export async function fetchShortMetadata(url: string): Promise<FetchedYoutubeMetadata> {
  // Note: the ORIGINAL url, not cleanYouTubeUrl(url) — ScrapeCreators takes a
  // full YouTube URL and the cleaner is a yt-dlp-path concern.
  const raw = await getYoutubeVideo(url);

  return {
    metadata: adaptYoutubeVideo(raw, url),
    ownerHint: extractYoutubeOwnerHint(raw),
  };
}

export async function extractVideoUrl(url: string): Promise<string | null> {
  try {
    const cleanUrl = cleanYouTubeUrl(url);
    const { stdout } = await execFileAsync("yt-dlp", [
      "-g",
      "--skip-download",
      "--no-warnings",
      "--user-agent",
      USER_AGENT,
      "--extractor-args",
      "youtube:player_client=web",
      "--no-playlist",
      "-f",
      "best[height<=1080]",
      cleanUrl,
    ]);
    const trimmed = stdout.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (error) {
    console.error("[YouTube] extractVideoUrl failed:", error);
    return null;
  }
}
