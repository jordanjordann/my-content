import type { MediaMetadata, OwnerProfileHint } from "@/lib/server/analysis/types";
import type {
  ScrapeCreatorsCarouselChildNode,
  ScrapeCreatorsPostResponse,
} from "@/lib/server/scrapecreators";

/**
 * Dual-shape adapter: maps a raw ScrapeCreators `/v1/instagram/post`
 * payload to MediaMetadata. Written defensively because the documented
 * response is the GraphQL `xdt_shortcode_media` shape, not the media-info
 * shape the PRD assumed — see TDD §1.1.4 / §5.3. Field-level resolvers try
 * the media-info name first, then the GraphQL name, and fall back to null.
 * Every field is nullable; the adapter throws only when it cannot
 * determine a username at all, meaning the payload isn't a post.
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

function getCarouselChildren(
  raw: ScrapeCreatorsPostResponse,
): ScrapeCreatorsCarouselChildNode[] {
  if (Array.isArray(raw.carousel_media) && raw.carousel_media.length > 0) {
    return raw.carousel_media;
  }

  const edges = raw.edge_sidecar_to_children?.edges;
  if (Array.isArray(edges) && edges.length > 0) {
    return edges
      .map((edge) => edge.node)
      .filter((node): node is ScrapeCreatorsCarouselChildNode => !!node);
  }

  return [];
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
 * 1. carousel if carousel_media / edge_sidecar_to_children is non-empty.
 * 2. else reel if product_type === "clips" or the URL path is /reel/.
 * 3. else post.
 */
function resolveMediaType(raw: ScrapeCreatorsPostResponse, url: string): ResolvedMediaType {
  const children = getCarouselChildren(raw);
  if (children.length > 0) {
    return { mediaType: "carousel", carouselItemCount: children.length };
  }

  const isReel = raw.product_type === "clips" || /\/reel\//i.test(url);
  if (isReel) {
    return { mediaType: "reel", carouselItemCount: null };
  }

  return { mediaType: "post", carouselItemCount: null };
}

function videoUrlFromNode(
  node: ScrapeCreatorsPostResponse | ScrapeCreatorsCarouselChildNode,
): string | null {
  return str(node.video_url) ?? str(node.video_versions?.[0]?.url) ?? null;
}

/**
 * For reels: video_url or video_versions[0].url.
 * For carousels: the first child slide that is a video.
 * Returns null for image-only posts, correctly routing to metadata-only.
 */
function resolveVideoUrl(
  raw: ScrapeCreatorsPostResponse,
  resolved: ResolvedMediaType,
): string | null {
  if (resolved.mediaType === "carousel") {
    const children = getCarouselChildren(raw);
    const videoChild = children.find(
      (child) => child.is_video === true || videoUrlFromNode(child) !== null,
    );
    return videoChild ? videoUrlFromNode(videoChild) : null;
  }

  return videoUrlFromNode(raw);
}

function imageUrlFromNode(
  node: ScrapeCreatorsPostResponse | ScrapeCreatorsCarouselChildNode,
): string | null {
  return str(node.display_url) ?? str(node.image_versions2?.candidates?.[0]?.url) ?? null;
}

/** display_url -> image_versions2.candidates[0].url -> thumbnail_url -> first carousel child's display url. */
function resolveThumbnailUrl(raw: ScrapeCreatorsPostResponse): string | null {
  const direct = imageUrlFromNode(raw);
  if (direct) {
    return direct;
  }

  const thumbnailUrl = str(raw.thumbnail_url);
  if (thumbnailUrl) {
    return thumbnailUrl;
  }

  const firstChild = getCarouselChildren(raw)[0];
  return firstChild ? imageUrlFromNode(firstChild) : null;
}

interface ResolvedAudio {
  hasAudio: boolean | null;
  audioTitle: string | null;
  audioArtist: string | null;
  audioId: string | null;
  audioIsOriginal: boolean | null;
}

function resolveAudio(raw: ScrapeCreatorsPostResponse): ResolvedAudio {
  const hasAudio = bool(raw.has_audio);

  const clipsMusic = raw.clips_music_attribution_info;
  const musicAsset = raw.music_metadata?.music_info?.music_asset_info;

  const audioTitle = str(clipsMusic?.song_name) ?? str(musicAsset?.song_name) ?? null;
  const audioArtist = str(clipsMusic?.artist_name) ?? str(musicAsset?.display_artist) ?? null;
  const audioId = str(clipsMusic?.audio_id) ?? str(musicAsset?.audio_cluster_id) ?? null;

  let audioIsOriginal: boolean | null = null;
  if (raw.original_sound_info != null) {
    audioIsOriginal = true;
  } else if (typeof raw.should_mute_audio === "boolean") {
    audioIsOriginal = raw.should_mute_audio === false;
  }

  return { hasAudio, audioTitle, audioArtist, audioId, audioIsOriginal };
}

export function adaptPostResponse(raw: ScrapeCreatorsPostResponse, url: string): MediaMetadata {
  const shortcode = str(raw.shortcode) ?? extractShortcodeFromUrl(url);

  const username = str(raw.owner?.username) ?? extractUsernameFromUrl(url);
  if (!username) {
    throw new Error(
      `ScrapeCreators payload for ${url} has no resolvable username — this is not a post payload`,
    );
  }

  const resolvedMediaType = resolveMediaType(raw, url);

  const viewCount =
    num(raw.play_count) ?? num(raw.video_play_count) ?? num(raw.video_view_count) ?? null;

  const likeCount = num(raw.like_count) ?? num(raw.edge_media_preview_like?.count) ?? null;

  const commentCount =
    num(raw.comment_count) ?? num(raw.edge_media_to_parent_comment?.count) ?? null;

  const caption =
    (typeof raw.caption === "object" ? str(raw.caption?.text) : str(raw.caption)) ??
    str(raw.edge_media_to_caption?.edges?.[0]?.node?.text) ??
    null;

  const postDate = toIso(raw.taken_at ?? raw.taken_at_timestamp);

  const durationSec = num(raw.video_duration) ?? null;

  const originalWidth = num(raw.original_width) ?? num(raw.dimensions?.width) ?? null;
  const originalHeight = num(raw.original_height) ?? num(raw.dimensions?.height) ?? null;

  const audio = resolveAudio(raw);

  const externalId = str(raw.owner?.id) ?? str(raw.owner?.pk) ?? null;

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
export function extractOwnerProfile(raw: ScrapeCreatorsPostResponse): OwnerProfileHint | null {
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
    externalId: str(owner.id) ?? str(owner.pk) ?? null,
    followerCount: num(owner.edge_followed_by?.count) ?? num(owner.follower_count) ?? null,
    followingCount: num(owner.edge_follow?.count) ?? num(owner.following_count) ?? null,
    fullName: str(owner.full_name) ?? null,
    profilePicUrl: str(owner.profile_pic_url) ?? null,
    biography: str(owner.biography) ?? null,
    isVerified: bool(owner.is_verified),
    isBusinessAccount: bool(owner.is_business_account),
    isPrivate: bool(owner.is_private),
  };
}
