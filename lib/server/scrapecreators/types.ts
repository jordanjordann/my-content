/**
 * Raw ScrapeCreators response types.
 *
 * Confirmed against live payloads (a reel and a 12-slide carousel), fetched
 * with `trim: false` (see lib/server/scrapecreators/instagram.ts for why):
 * `/v1/instagram/post` returns an envelope —
 * `{ success, credits_remaining, data: { xdt_shortcode_media: {...} }, status }`
 * — wrapping the Instagram GraphQL `xdt_shortcode_media` shape. There is no
 * "media-info" variant; that was a PRD assumption that never matched the
 * live API and has been removed. This module models only the confirmed
 * envelope + media shape. Unwrapping `data.xdt_shortcode_media` happens at
 * the fetcher call site (lib/server/analysis/fetcher/instagram.ts), not
 * here — this module only owns transport types.
 *
 * `/v1/instagram/profile` was captured live (2026-07-20, see
 * /tmp/sc-profile-response.json) and confirmed to return
 * `{ success, credits_remaining, data: { user: {...} }, status }` — same
 * envelope shape regardless of `trim`. There is no flat
 * `follower_count`/`following_count`/`pk` variant; that was an unverified
 * fallback that never matched a real payload and has been removed.
 * Unwrapping `data.user` happens at the call site
 * (lib/server/profiles/service.ts), not here.
 */

export interface ScrapeCreatorsImageResource {
  src?: string;
  config_width?: number;
  config_height?: number;
  [key: string]: unknown;
}

export interface ScrapeCreatorsOwner {
  id?: string;
  username?: string;
  full_name?: string;
  profile_pic_url?: string;
  is_verified?: boolean;
  is_private?: boolean;
  is_business_account?: boolean;
  biography?: string;
  edge_followed_by?: { count?: number };
  edge_follow?: { count?: number };
  [key: string]: unknown;
}

/** `__typename` discriminator shared by top-level media and carousel children. */
export type ScrapeCreatorsMediaTypename = "XDTGraphVideo" | "XDTGraphImage" | "XDTGraphSidecar";

/**
 * A single slide of a carousel (`edge_sidecar_to_children.edges[].node`).
 * Only video-typed slides (`__typename: "XDTGraphVideo"`) carry
 * `video_url`/`video_view_count`/`has_audio` — image slides do not.
 */
export interface ScrapeCreatorsCarouselChildNode {
  __typename?: ScrapeCreatorsMediaTypename | string;
  id?: string;
  shortcode?: string;
  is_video?: boolean;
  video_url?: string;
  video_view_count?: number;
  video_duration?: number;
  has_audio?: boolean;
  display_url?: string;
  thumbnail_src?: string;
  display_resources?: ScrapeCreatorsImageResource[];
  dimensions?: { width?: number; height?: number };
  /**
   * Not confirmed against a real video-carousel-slide payload — the only
   * captured carousel sample (/tmp/sc-carousel-response.json) is all-image.
   * Modeled after the top-level `XDTGraphVideo` shape since carousel video
   * children share the same GraphQL `__typename`/field conventions as the
   * top-level media object. Flagged in the #42 review; get a real sample
   * with a video slide to confirm before relying on this further in
   * production — adapter.ts logs loudly when a resolved video child is
   * missing these fields.
   */
  clips_music_attribution_info?: {
    song_name?: string;
    artist_name?: string;
    audio_id?: string;
    uses_original_audio?: boolean;
    should_mute_audio?: boolean;
  };
  [key: string]: unknown;
}

/**
 * `data.xdt_shortcode_media` — the actual post/reel/carousel payload.
 * Carousels (`__typename: "XDTGraphSidecar"`) have no top-level
 * `video_view_count`/`has_audio`/`video_url` — those only exist on
 * video-typed children in `edge_sidecar_to_children`.
 */
export interface ScrapeCreatorsMedia {
  __typename?: ScrapeCreatorsMediaTypename | string;
  id?: string;
  shortcode?: string;
  is_video?: boolean;
  product_type?: string;

  taken_at_timestamp?: number;

  video_url?: string;
  video_view_count?: number;
  video_duration?: number;
  has_audio?: boolean;

  thumbnail_src?: string;
  display_url?: string;
  display_resources?: ScrapeCreatorsImageResource[];
  dimensions?: { width?: number; height?: number };

  edge_media_preview_like?: { count?: number };
  edge_media_to_parent_comment?: { count?: number };
  edge_media_to_caption?: { edges?: { node?: { text?: string } }[] };

  clips_music_attribution_info?: {
    song_name?: string;
    artist_name?: string;
    audio_id?: string;
    uses_original_audio?: boolean;
    should_mute_audio?: boolean;
  };

  edge_sidecar_to_children?: { edges?: { node?: ScrapeCreatorsCarouselChildNode }[] };

  owner?: ScrapeCreatorsOwner;

  [key: string]: unknown;
}

/** Envelope returned by `/v1/instagram/post`. */
export interface ScrapeCreatorsPostEnvelope {
  success?: boolean;
  credits_remaining?: number;
  data?: { xdt_shortcode_media?: ScrapeCreatorsMedia };
  status?: string;
  [key: string]: unknown;
}

/**
 * `data.user` — the actual profile payload from `/v1/instagram/profile`.
 * Confirmed against a real payload (/tmp/sc-profile-response.json); there
 * is no flat `follower_count`/`following_count`/`pk` fallback shape, only
 * the nested `edge_followed_by`/`edge_follow` count objects — the same
 * convention the post owner block uses.
 */
export interface ScrapeCreatorsProfileUser {
  id?: string;
  username?: string;
  full_name?: string;
  biography?: string;
  profile_pic_url?: string;
  is_verified?: boolean;
  is_private?: boolean;
  is_business_account?: boolean;
  edge_followed_by?: { count?: number };
  edge_follow?: { count?: number };
  [key: string]: unknown;
}

/** Envelope returned by `/v1/instagram/profile`. */
export interface ScrapeCreatorsProfileEnvelope {
  success?: boolean;
  credits_remaining?: number;
  data?: { user?: ScrapeCreatorsProfileUser };
  status?: string;
  [key: string]: unknown;
}

/**
 * === YouTube ===
 *
 * Confirmed live (2026-07-21) against `/v1/youtube/video` (a real Short,
 * see /tmp/yt_video_fresh.json) and `/v1/youtube/channel` (see
 * /tmp/yt_channel_handle.json). Full findings, including the `trim` and
 * error-behaviour investigation, are recorded in
 * .claude/context/verified-facts.md — read that before changing these
 * types.
 *
 * Both YouTube endpoints are **flat, with no `data` envelope**, unlike the
 * Instagram endpoints above. Do not "fix" that into a wrapped shape by
 * analogy — it was verified live, twice, including with `trim=true`.
 */

/** Inline `channel` block on `/v1/youtube/video` responses. */
export interface ScrapeCreatorsYoutubeChannelRef {
  id?: string; // "UC..." channel id
  url?: string; // channel URL, has a leading "@" in the handle segment
  handle?: string; // bare handle, NO leading "@" — use this for /v1/youtube/channel?handle=
  title?: string;
  [key: string]: unknown;
}

/** A single caption track entry in `/v1/youtube/video`'s `captionTracks`. */
export interface ScrapeCreatorsYoutubeCaptionTrack {
  baseUrl?: string;
  name?: { simpleText?: string };
  vssId?: string;
  languageCode?: string;
  kind?: string;
  isTranslatable?: boolean;
  trackName?: string;
  [key: string]: unknown;
}

/**
 * `downloadOptions` on `/v1/youtube/video`. Modeled from the live capture,
 * but deliberately UNUSED for download purposes — `formats` came back empty
 * with null manifest URLs, and the API's own `note` field says links expire
 * and some videos only expose signature-ciphered formats. `extractVideoUrl`
 * (yt-dlp, lib/server/analysis/fetcher/youtube.ts) owns video download URL
 * extraction; this field is not a substitute.
 */
export interface ScrapeCreatorsYoutubeDownloadOptions {
  expiresInSeconds?: string;
  hlsManifestUrl?: string | null;
  dashManifestUrl?: string | null;
  formats?: unknown[];
  note?: string;
  [key: string]: unknown;
}

/**
 * Flat response from `/v1/youtube/video`. No `data` envelope — see the
 * module-level comment above. Unwrapping/mapping into MediaMetadata is the
 * fetcher's job (ticket #54, lib/server/analysis/fetcher/youtube.ts), not
 * this module's.
 *
 * Field-level notes (verified live, see verified-facts.md):
 *   - `durationMs` is MILLISECONDS, not seconds.
 *   - `publishDate` is ISO-8601 WITH OFFSET (e.g.
 *     "2011-01-19T09:40:47-08:00"), NOT a unix-seconds timestamp like
 *     Instagram's `taken_at_timestamp`.
 *   - `viewCountInt`/`likeCountInt`/`commentCountInt` are the numeric
 *     fields to read; the `*Text` siblings are human-formatted strings
 *     (e.g. "58,622,648", "67K") and not parseable as numbers directly.
 *   - `watchNextVideos` is unrelated recommended-video data, not this
 *     video's own metadata — typed loosely and not meant to be persisted.
 */
export interface ScrapeCreatorsYoutubeVideo {
  success?: boolean;
  credits_remaining?: number;
  type?: string; // "video"
  id?: string;
  title?: string;
  description?: string;
  descriptionLinks?: string[];
  commentCountText?: string;
  commentCountInt?: number;
  likeCountText?: string;
  likeCountInt?: number;
  viewCountText?: string;
  viewCountInt?: number;
  publishDateText?: string;
  publishDate?: string; // ISO-8601 with offset — see field-level notes above
  collaborators?: unknown[];
  channel?: ScrapeCreatorsYoutubeChannelRef;
  chapters?: unknown[];
  watchNextVideos?: unknown[]; // unrelated recommendation data — do not persist
  thumbnail?: string;
  keywords?: string[];
  genre?: string;
  durationMs?: number; // MILLISECONDS — see field-level notes above
  durationFormatted?: string;
  captionTracks?: ScrapeCreatorsYoutubeCaptionTrack[];
  downloadOptions?: ScrapeCreatorsYoutubeDownloadOptions;
  isPaidPromotion?: boolean;
  [key: string]: unknown;
}

/**
 * Flat response from `/v1/youtube/channel`. No `data` envelope. Written
 * from a live capture (/tmp/yt_channel_handle.json), not from docs — see
 * verified-facts.md.
 *
 * `subscriberCount` (number) is the confirmed field ticket #57 (engagement
 * rate) depends on. `subscriberCountText` is the human-formatted sibling
 * (e.g. "268K subscribers") and is not reliably parseable as a number.
 *
 * The social-link fields (`instagram`, `facebook`, `twitter`, `discord`,
 * `reddit`, arbitrary custom-link keys, etc.) vary per channel and are not
 * enumerated individually — they fall through the index signature.
 */
export interface ScrapeCreatorsYoutubeChannel {
  success?: boolean;
  credits_remaining?: number;
  channelId?: string; // "UC..." channel id
  channel?: string; // channel URL
  handle?: string; // echoes the requested handle, "@"-prefixed
  isVerified?: boolean;
  name?: string;
  description?: string;
  subscriberCount?: number;
  subscriberCountText?: string;
  videoCountText?: string;
  videoCount?: number;
  viewCountText?: string;
  viewCount?: number;
  joinedDateText?: string;
  tags?: string; // comma-separated string, not an array
  links?: string[];
  keywords?: string[];
  isFamilySafe?: boolean;
  facebookProfileId?: string | null;
  avatar?: string;
  banner?: string;
  /**
   * A "not found" handle/channel-id resolves with a real HTTP 404 (not a
   * `success: true` 200), so this field is only ever populated in an
   * already-thrown-error path — kept here for completeness since it was
   * observed in the raw body ScrapeCreators returns alongside the 404.
   */
  accountDoesNotExist?: boolean;
  [key: string]: unknown;
}
