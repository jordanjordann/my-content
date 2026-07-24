import type { MediaMetadata, OwnerProfileHint } from "@/lib/server/analysis/types";
import { resolveMediaParts } from "@/lib/server/analysis/media";
import type {
  ScrapeCreatorsCarouselChildNode,
  ScrapeCreatorsMedia,
} from "@/lib/server/scrapecreators";

/**
 * Maps an unwrapped ScrapeCreators `xdt_shortcode_media` object (the caller
 * is responsible for unwrapping `data.xdt_shortcode_media` from the
 * `/v1/instagram/post` envelope — see fetcher/instagram.ts) to
 * MediaMetadata. Single-shape: this is the live GraphQL shape, confirmed
 * against real reel, carousel and image-post payloads (see
 * `.claude/context/verified-facts.md`). There is no media-info fallback —
 * that shape never matched the live API.
 *
 * C6 (ticket #71): a populated `errors` array can coexist with
 * `success: true` on the envelope — this module and its caller
 * (fetcher/instagram.ts) determine success from the presence of
 * `xdt_shortcode_media`, never from `success`/`errors`, so a partial
 * GraphQL sub-field error does not fail the fetch.
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
 * The raw video-typed carousel child node that `resolveAudio()` sources
 * from — audio metadata lives on the node itself (`has_audio`,
 * `clips_music_attribution_info`), not on `MediaPart`, so this is kept
 * separate from `resolveMediaParts()`'s part-array enumeration. Same
 * "first video slide, document order" semantics as the part array's first
 * video entry.
 */
function resolveFirstVideoChild(
  raw: ScrapeCreatorsMedia,
  resolved: ResolvedMediaType,
): ScrapeCreatorsCarouselChildNode | null {
  if (resolved.mediaType !== "carousel") {
    return null;
  }
  return (
    getCarouselChildren(raw).find(
      (child) => child.__typename === "XDTGraphVideo" || child.is_video === true,
    ) ?? null
  );
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

/**
 * Sources audio fields from the top-level media object for reels/posts, or
 * from the resolved video carousel child for carousels — a sidecar's top
 * level never carries `has_audio`/`clips_music_attribution_info`, those
 * only exist on video-typed children. Confirmed against the real
 * video-bearing carousel fixture (ticket #71): `has_audio` is `false` on
 * 7/7 real video children and `clips_music_attribution_info` is absent —
 * so a carousel's `audioTitle`/`audioArtist` coming back null is CORRECT
 * output, not a failure. The log below is downgraded from `console.warn`
 * to `console.debug` for exactly that reason (C5) — it no longer fires a
 * false alarm on every normal carousel run; it still records the fact for
 * anyone debugging audio resolution.
 */
function resolveAudio(
  raw: ScrapeCreatorsMedia,
  videoChild: ScrapeCreatorsCarouselChildNode | null,
): ResolvedAudio {
  const source = videoChild ?? raw;
  // clips_music_attribution_info is no longer an explicit field on
  // ScrapeCreatorsCarouselChildNode (C1 — confirmed absent on all 7 real
  // video children); it falls through the index signature as `unknown`
  // there, so read it defensively via an explicit shape rather than
  // relying on TS to unify it with ScrapeCreatorsMedia's typed field.
  const music = source.clips_music_attribution_info as
    | { song_name?: string; artist_name?: string; audio_id?: string; uses_original_audio?: boolean }
    | undefined;
  const hasAudio = bool(source.has_audio);

  if (videoChild && hasAudio === null && !music) {
    console.debug(
      "[ADAPTER] Carousel video child resolved but has no has_audio/clips_music_attribution_info — " +
        "confirmed carousel behaviour (C5), not an error",
      { shortcode: raw.shortcode, childId: videoChild.id },
    );
  }

  return {
    hasAudio,
    audioTitle: str(music?.song_name),
    audioArtist: str(music?.artist_name),
    audioId: str(music?.audio_id),
    audioIsOriginal: bool(music?.uses_original_audio),
  };
}

/**
 * C9: `coauthor_producers` usernames — stored/carried but deliberately kept
 * OUT of the analysis path. Absent and an empty array both normalize to
 * `[]`, never `undefined` — "handled identically" per the ticket.
 */
function resolveCoauthorUsernames(raw: ScrapeCreatorsMedia): string[] {
  const producers = raw.coauthor_producers;
  if (!Array.isArray(producers)) {
    return [];
  }
  return producers.map((p) => str(p.username)).filter((u): u is string => !!u);
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
  const videoChild = resolveFirstVideoChild(raw, resolvedMediaType);

  const { parts: mediaParts, truncated: mediaPartsTruncated } = resolveMediaParts(raw);
  const firstVideoPart = mediaParts.find((p) => p.kind === "video") ?? null;

  // C8: `like_and_view_counts_disabled` is post-level only, and absence
  // must NOT be read as `false` — only a confirmed `true` suppresses the
  // affected counts (view/like) to NULL rather than a possibly-hidden `0`.
  const countsDisabled = raw.like_and_view_counts_disabled === true;

  const likeCount = countsDisabled ? null : num(raw.edge_media_preview_like?.count);
  const commentCount = num(raw.edge_media_to_parent_comment?.count);
  const caption = str(raw.edge_media_to_caption?.edges?.[0]?.node?.text);
  const postDate = toIso(raw.taken_at_timestamp);
  const durationSec = firstVideoPart?.durationSec ?? null;
  const originalWidth = num(raw.dimensions?.width);
  const originalHeight = num(raw.dimensions?.height);

  const audio = resolveAudio(raw, videoChild);

  const externalId = str(raw.owner?.id);

  const videoUrl = firstVideoPart?.url ?? null;
  const viewCount = countsDisabled ? null : (firstVideoPart?.viewCount ?? null);
  const playCount = firstVideoPart?.playCount ?? null;
  const displayedCountIsPlayCount = countsDisabled
    ? false
    : (firstVideoPart?.displayedCountIsPlayCount ?? false);

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
    videoUrl,
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
    playCount,
    displayedCountIsPlayCount,
    mediaParts,
    mediaPartsTruncated,
    likeAndViewCountsDisabled: bool(raw.like_and_view_counts_disabled) ?? undefined,
    coauthorUsernames: resolveCoauthorUsernames(raw),
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
