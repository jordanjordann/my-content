/**
 * Raw ScrapeCreators response types.
 *
 * Confirmed against live payloads (a reel and a 12-slide carousel):
 * `/v1/instagram/post` returns an envelope —
 * `{ success, credits_remaining, data: { xdt_shortcode_media: {...} }, status }`
 * — wrapping the Instagram GraphQL `xdt_shortcode_media` shape. There is no
 * "media-info" variant; that was a PRD assumption that never matched the
 * live API and has been removed. This module models only the confirmed
 * envelope + media shape. Unwrapping `data.xdt_shortcode_media` happens at
 * the fetcher call site (lib/server/analysis/fetcher/instagram.ts), not
 * here — this module only owns transport types.
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

/** Raw response from `/v1/instagram/profile`. */
export interface ScrapeCreatorsProfileResponse {
  id?: string;
  pk?: string;
  username?: string;
  full_name?: string;
  biography?: string;
  profile_pic_url?: string;
  is_verified?: boolean;
  is_private?: boolean;
  is_business_account?: boolean;
  edge_followed_by?: { count?: number };
  follower_count?: number;
  edge_follow?: { count?: number };
  following_count?: number;
  [key: string]: unknown;
}
