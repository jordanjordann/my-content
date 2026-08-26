/**
 * Raw ScrapeCreators response types.
 *
 * Confirmed against real, committed payload captures — a reel, a 10-slide
 * all-image carousel, a 10-slide mixed video/image carousel, and a single
 * image post — all fetched with `trim: false` (see
 * lib/server/scrapecreators/instagram.ts for why) and committed at
 * `.claude/context/fixtures/scrapecreators-instagram/`. See
 * `.claude/context/verified-facts.md` for the full capture notes.
 * `/v1/instagram/post` returns an envelope —
 * `{ success, credits_remaining, credits_charged, data: { xdt_shortcode_media: {...} }, status, errors?, extensions? }`
 * — wrapping the Instagram GraphQL `xdt_shortcode_media` shape. There is no
 * "media-info" variant; that was a PRD assumption that never matched the
 * live API and has been removed. This module models only the confirmed
 * envelope + media shape. Unwrapping `data.xdt_shortcode_media` happens at
 * the fetcher call site (lib/server/analysis/fetcher/instagram.ts), not
 * here — this module only owns transport types.
 *
 * `/v1/instagram/profile` was captured live (2026-07-20) and confirmed to
 * return `{ success, credits_remaining, data: { user: {...} }, status }` —
 * same envelope shape regardless of `trim`. There is no flat
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
 * A single co-author entry in a post's `coauthor_producers` array (post-level
 * only — confirmed absent on every carousel child in both captured
 * carousels). Ticket #71 / C9: the owner decided (2026-07-22, verbatim)
 * "i think just store the data for now, but keep it away from analysis" —
 * this field is modelled and persisted, but must never reach the Gemini
 * request, the prompt, or an analysis output field.
 */
export interface ScrapeCreatorsCoauthorProducer {
  id?: string;
  username?: string;
  is_verified?: boolean;
  profile_pic_url?: string;
  [key: string]: unknown;
}

/**
 * `dash_info` on a real video-carousel-child (7/7 samples in
 * ig_carousel_mixed_video_and_image_10_slides.json). DELIBERATELY UNMODELLED
 * beyond this comment, per Q1=(a)/Q2 (ticket #71): `mediaPresentationDuration`
 * inside `video_dash_manifest`'s MPD XML is the ONLY in-payload duration for a
 * carousel video slide, but Q1 resolved to (a) — drop the summed-duration
 * guard for carousels, `durationSec` stays `null`, and NO code in this
 * repository parses this manifest for a duration or any other value. Do not
 * add a `dash_info` field to `ScrapeCreatorsCarouselChildNode` without also
 * re-opening Q1 — it falls through the index signature below and is never
 * read. Shape observed: `{ is_dash_eligible: boolean, video_dash_manifest:
 * string (MPEG-DASH MPD XML, several KB), number_of_qualities: number }`.
 * Download always comes from `video_url` (progressive MP4), never this
 * manifest.
 */

/**
 * A single slide of a carousel (`edge_sidecar_to_children.edges[].node`).
 *
 * Re-verified field-by-field against the real video-bearing carousel fixture
 * (`.claude/context/fixtures/scrapecreators-instagram/ig_carousel_mixed_video_and_image_10_slides.json`,
 * 7 XDTGraphVideo + 3 XDTGraphImage children) by ticket #71 — see
 * verified-facts.md, "Video carousel child — CONFIRMED shape (7 samples)".
 * `video_duration`, `clips_music_attribution_info` and `thumbnail_src` were
 * previously modelled here by analogy with the top-level `XDTGraphVideo`
 * shape and are confirmed ABSENT on all 7 real video children — removed.
 * `video_play_count` is added: present but `null` on all 7 real video
 * children (the opposite reliability pattern from top-level reels — see the
 * view-count branch in fetcher/adapter.ts, C4). `dash_info` is deliberately
 * NOT modelled — see the comment above this interface.
 *
 * Every field here must be treated as optional with a defined fallback (C7):
 * child key counts range from 7 (all-image carousel) to 18/23 (mixed
 * carousel image/video children) across the two captured fixtures.
 * Discriminate `kind` on `__typename`/`is_video`, NEVER on `video_url`
 * presence — an all-image carousel's image children carry `video_url: null`
 * (key present, value null), not absent.
 */
export interface ScrapeCreatorsCarouselChildNode {
  __typename?: ScrapeCreatorsMediaTypename | string;
  id?: string;
  shortcode?: string;
  is_video?: boolean;
  video_url?: string | null;
  video_view_count?: number;
  video_play_count?: number | null;
  has_audio?: boolean;
  display_url?: string;
  display_resources?: ScrapeCreatorsImageResource[];
  dimensions?: { width?: number; height?: number };
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
  // video_play_count — the field that actually carries reel views (C4):
  // top-level video_view_count can be a misleading 0 while video_play_count
  // holds the real number (ig_reel_1_zero_view_count.json: 0 / 116333). NOT
  // reliable on carousel children — see ScrapeCreatorsCarouselChildNode.
  video_play_count?: number;
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

  /**
   * C8 (ticket #71): post-level only, absent on all carousel children.
   * Observed absent on 1/6 fixtures (the all-image carousel) and `false` on
   * the other 5 — no captured fixture has it `true`. Absence must NOT be
   * read as `false`: when the key is truly absent, its disabled-state is
   * unknown, not confirmed-off. When `true`, the affected counts must be
   * persisted as NULL (unknown), never coerced to 0 — the same trap class
   * as C4's reel zero-view count.
   */
  like_and_view_counts_disabled?: boolean;

  /**
   * C9 (ticket #71): present on 6/6 fixtures, non-empty on 2/6
   * (ig_reel_3.json: coauthor_test_account; ig_single_image_post.json:
   * commenter_123 — handles anonymised in #264, see verified-facts.md).
   * Absent on all carousel children — post-level only. Owner decision
   * (2026-07-22, verbatim): "i think just store the data for now, but keep
   * it away from analysis" — model/carry/persist this field, but it must
   * never be sent to Gemini, referenced by any prompt, or surfaced as an
   * analysis output. Absent and empty (`[]`) must be handled identically.
   */
  coauthor_producers?: ScrapeCreatorsCoauthorProducer[];

  owner?: ScrapeCreatorsOwner;

  [key: string]: unknown;
}

/**
 * Envelope returned by `/v1/instagram/post`. `errors` (C6) can be a
 * populated array alongside `success: true` — a GraphQL-style partial/
 * non-fatal error for one sub-field (observed:
 * `location.address_json`), not a request failure. Do not infer success
 * from `errors` being non-empty, and do not treat `success: true` as proof
 * that every requested field is present. `credits_charged` and `extensions`
 * are transport metadata, not modelled beyond presence — not useful payload
 * data, not persisted.
 */
export interface ScrapeCreatorsPostEnvelope {
  success?: boolean;
  credits_remaining?: number;
  credits_charged?: number;
  data?: { xdt_shortcode_media?: ScrapeCreatorsMedia };
  status?: string;
  errors?: { message?: string; path?: string[]; severity?: string }[];
  extensions?: unknown;
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

/**
 * Envelope returned by `/v1/instagram/profile`.
 *
 * PR #259 review, M2: this endpoint feeds `follower_count` — the tier-1
 * denominator for a genuine image post — so a silently partial response
 * here is materially similar to the #254 defect on the post endpoint. NOT
 * given the same `errors`/`warnScrapeCreatorsErrors()` treatment as
 * `ScrapeCreatorsPostEnvelope` in this PR: `.claude/context/verified-facts.md`
 * documents the partial-`errors`-array shape only for `/v1/instagram/post`
 * (~L754-767); there is no confirmed live capture of `/v1/instagram/profile`
 * returning a populated `errors` array, and per this repo's external-API
 * rule an undocumented field must not be guessed at (same key names, same
 * shape, on a different endpoint — the hard rule is explicit: if a field
 * isn't listed, stop and flag it). Flagged, not implemented — worth its own
 * ticket once a real profile-endpoint capture with `errors` exists to
 * confirm the shape against.
 */
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
 * but deliberately UNUSED — `formats` came back empty with null manifest
 * URLs, and the API's own `note` field says links expire and some videos
 * only expose signature-ciphered formats. Ticket #295: this codebase no
 * longer downloads YouTube video at all (Gemini fetches it server-side
 * from the original public URL); this field was never a substitute for
 * that and remains modeled only for completeness.
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
/** A single resolution source shared by `avatar.image.sources` and `banner` entries. */
export interface ScrapeCreatorsYoutubeImageSource {
  url?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

/**
 * `avatar` on `/v1/youtube/channel` — NOT a string. A single source (68x68)
 * was observed in every capture.
 */
export interface ScrapeCreatorsYoutubeChannelAvatar {
  image?: { sources?: ScrapeCreatorsYoutubeImageSource[] };
  avatarImageSize?: string;
  [key: string]: unknown;
}

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
  /**
   * NOT a string — an object wrapping a single 68x68 image source. See
   * `ScrapeCreatorsYoutubeChannelAvatar`.
   */
  avatar?: ScrapeCreatorsYoutubeChannelAvatar;
  /**
   * NOT a string — an array of resolution variants (6 entries observed,
   * widest last). See `ScrapeCreatorsYoutubeImageSource`.
   */
  banner?: ScrapeCreatorsYoutubeImageSource[];
  /**
   * A "not found" handle/channel-id resolves with a real HTTP 404 (not a
   * `success: true` 200), so this field is only ever populated in an
   * already-thrown-error path — kept here for completeness since it was
   * observed in the raw body ScrapeCreators returns alongside the 404.
   */
  accountDoesNotExist?: boolean;
  [key: string]: unknown;
}
