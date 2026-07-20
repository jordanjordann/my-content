import type { MediaMetadata, OwnerProfileHint } from "@/lib/server/analysis/types";
import type {
  ScrapeCreatorsCarouselChildNode,
  ScrapeCreatorsMedia,
} from "@/lib/server/scrapecreators";

/**
 * Maps an unwrapped ScrapeCreators `xdt_shortcode_media` object (the caller
 * is responsible for unwrapping `data.xdt_shortcode_media` from the
 * `/v1/instagram/post` envelope — see fetcher/instagram.ts) to
 * MediaMetadata. Single-shape: this is the live GraphQL shape, confirmed
 * against real reel and carousel payloads. There is no media-info
 * fallback — that shape never matched the live API.
 *
 * Every field is nullable; the adapter throws only when it cannot determine
 * a username at all, meaning the payload isn't a post.
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

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Unix seconds (or seconds-as-string) -> ISO 8601 UTC. */
function toIso(value: unknown): string | null {
  const seconds = num(value);
  if (seconds === null) {
    return null;
  }
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getCarouselChildren(raw: ScrapeCreatorsMedia): ScrapeCreatorsCarouselChildNode[] {
  const edges = raw.edge_sidecar_to_children?.edges;
  if (!Array.isArray(edges)) {
    return [];
  }
  return edges
    .map((edge) => edge.node)
    .filter((node): node is ScrapeCreatorsCarouselChildNode => !!node);
}

function extractShortcodeFromUrl(url: string): string {
  const match = url.match(/\/(reel|p)\/([\w-]+)/);
  return match?.[2] ?? "";
}

function extractUsernameFromUrl(url: string): string | null {
  const match = url.match(/instagram\.com\/([\w.-]+)\/(?:reel|p)\//);
  return match?.[1] ?? null;
}

interface ResolvedMediaType {
  mediaType: "reel" | "post" | "carousel";
  carouselItemCount: number | null;
}

/**
 * 1. carousel if `__typename === "XDTGraphSidecar"`.
 * 2. else reel if `product_type === "clips"` or the URL path is `/reel/`.
 * 3. else post.
 */
function resolveMediaType(raw: ScrapeCreatorsMedia, url: string): ResolvedMediaType {
  if (raw.__typename === "XDTGraphSidecar") {
    const children = getCarouselChildren(raw);
    return { mediaType: "carousel", carouselItemCount: children.length };
  }

  const isReel = raw.product_type === "clips" || /\/reel\//i.test(url);
  if (isReel) {
    return { mediaType: "reel", carouselItemCount: null };
  }

  return { mediaType: "post", carouselItemCount: null };
}

/**
 * For reels/posts: top-level `video_url`.
 * For carousels: the first child slide whose `__typename` is
 * `"XDTGraphVideo"` (carousels have no top-level `video_url`).
 * Returns null for image-only posts, correctly routing to metadata-only.
 */
function resolveVideoUrl(raw: ScrapeCreatorsMedia, resolved: ResolvedMediaType): string | null {
  if (resolved.mediaType === "carousel") {
    const videoChild = getCarouselChildren(raw).find(
      (child) => child.__typename === "XDTGraphVideo" || child.is_video === true,
    );
    return videoChild ? (str(videoChild.video_url) ?? null) : null;
  }

  return str(raw.video_url);
}

/** thumbnail_src -> display_url -> first carousel child's thumbnail_src/display_url. */
function resolveThumbnailUrl(raw: ScrapeCreatorsMedia): string | null {
  const direct = str(raw.thumbnail_src) ?? str(raw.display_url);
  if (direct) {
    return direct;
  }

  const firstChild = getCarouselChildren(raw)[0];
  if (!firstChild) {
    return null;
  }
  return str(firstChild.thumbnail_src) ?? str(firstChild.display_url);
}

interface ResolvedAudio {
  hasAudio: boolean | null;
  audioTitle: string | null;
  audioArtist: string | null;
  audioId: string | null;
  audioIsOriginal: boolean | null;
}

function resolveAudio(raw: ScrapeCreatorsMedia): ResolvedAudio {
  const music = raw.clips_music_attribution_info;

  return {
    hasAudio: bool(raw.has_audio),
    audioTitle: str(music?.song_name),
    audioArtist: str(music?.artist_name),
    audioId: str(music?.audio_id),
    audioIsOriginal: bool(music?.uses_original_audio),
  };
}

export function adaptPostResponse(raw: ScrapeCreatorsMedia, url: string): MediaMetadata {
  const shortcode = str(raw.shortcode) ?? extractShortcodeFromUrl(url);

  const username = str(raw.owner?.username) ?? extractUsernameFromUrl(url);
  if (!username) {
    throw new Error(
      `ScrapeCreators payload for ${url} has no resolvable username — this is not a post payload`,
    );
  }

  const resolvedMediaType = resolveMediaType(raw, url);

  const viewCount = num(raw.video_view_count);
  const likeCount = num(raw.edge_media_preview_like?.count);
  const commentCount = num(raw.edge_media_to_parent_comment?.count);
  const caption = str(raw.edge_media_to_caption?.edges?.[0]?.node?.text);
  const postDate = toIso(raw.taken_at_timestamp);
  const durationSec = num(raw.video_duration);
  const originalWidth = num(raw.dimensions?.width);
  const originalHeight = num(raw.dimensions?.height);

  const audio = resolveAudio(raw);

  const externalId = str(raw.owner?.id);

  return {
    url,
    shortcode,
    mediaType: resolvedMediaType.mediaType,
    username,
    caption,
    viewCount,
    postDate,
    durationSec,
    thumbnailUrl: resolveThumbnailUrl(raw),
    videoUrl: resolveVideoUrl(raw, resolvedMediaType),
    likeCount,
    commentCount,
    hasAudio: audio.hasAudio,
    audioTitle: audio.audioTitle,
    audioArtist: audio.audioArtist,
    audioId: audio.audioId,
    audioIsOriginal: audio.audioIsOriginal,
    originalWidth,
    originalHeight,
    carouselItemCount: resolvedMediaType.carouselItemCount,
    externalId,
  };
}

/**
 * Extracts the owner block from a post payload for the profiles service to
 * opportunistically hydrate from (TDD §1.1.5) — the adapter does not
 * persist anything itself.
 */
export function extractOwnerProfile(raw: ScrapeCreatorsMedia): OwnerProfileHint | null {
  const owner = raw.owner;
  if (!owner) {
    return null;
  }

  const username = str(owner.username);
  if (!username) {
    return null;
  }

  return {
    username,
    externalId: str(owner.id),
    followerCount: num(owner.edge_followed_by?.count),
    followingCount: num(owner.edge_follow?.count),
    fullName: str(owner.full_name),
    profilePicUrl: str(owner.profile_pic_url),
    biography: str(owner.biography),
    isVerified: bool(owner.is_verified),
    isBusinessAccount: bool(owner.is_business_account),
    isPrivate: bool(owner.is_private),
  };
}
