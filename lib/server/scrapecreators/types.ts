/**
 * Raw ScrapeCreators response types.
 *
 * These are intentionally permissive — the live `/v1/instagram/post` shape
 * is confirmed to be the Instagram GraphQL `xdt_shortcode_media` shape, NOT
 * the media-info shape the original PRD assumed (see TDD §1.1.4). Both are
 * modelled here as optional fields on the same loose interface so a future
 * ScrapeCreators change (or a `trim=true` variant) doesn't throw at the type
 * level. Field-level resolution/fallback logic lives in the fetcher adapter,
 * not here — this module only owns transport.
 */

export interface ScrapeCreatorsImageCandidate {
  url?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface ScrapeCreatorsVideoVersion {
  url?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface ScrapeCreatorsOwner {
  id?: string;
  pk?: string;
  username?: string;
  full_name?: string;
  profile_pic_url?: string;
  is_verified?: boolean;
  is_private?: boolean;
  is_business_account?: boolean;
  biography?: string;
  edge_followed_by?: { count?: number };
  follower_count?: number;
  edge_follow?: { count?: number };
  following_count?: number;
  [key: string]: unknown;
}

export interface ScrapeCreatorsCarouselChildNode {
  id?: string;
  is_video?: boolean;
  video_url?: string;
  display_url?: string;
  video_versions?: ScrapeCreatorsVideoVersion[];
  image_versions2?: { candidates?: ScrapeCreatorsImageCandidate[] };
  dimensions?: { width?: number; height?: number };
  [key: string]: unknown;
}

/**
 * Raw post/reel/carousel payload from `/v1/instagram/post`.
 * Tolerates both the "media-info" and "GraphQL xdt_shortcode_media" shapes.
 */
export interface ScrapeCreatorsPostResponse {
  // media-info-shape fields (PRD-assumed)
  play_count?: number;
  like_count?: number;
  comment_count?: number;
  caption?: { text?: string } | string;
  taken_at?: number;
  video_versions?: ScrapeCreatorsVideoVersion[];
  image_versions2?: { candidates?: ScrapeCreatorsImageCandidate[] };
  original_width?: number;
  original_height?: number;
  music_metadata?: {
    music_info?: {
      music_asset_info?: {
        song_name?: string;
        display_artist?: string;
        audio_cluster_id?: string;
      };
    };
  };
  carousel_media?: ScrapeCreatorsCarouselChildNode[];
  media_type?: number | string;
  has_audio?: boolean;
  should_mute_audio?: boolean;
  original_sound_info?: unknown;

  // GraphQL xdt_shortcode_media-shape fields (documented/live shape)
  video_play_count?: number;
  video_view_count?: number;
  edge_media_preview_like?: { count?: number };
  edge_media_to_parent_comment?: { count?: number };
  edge_media_to_caption?: { edges?: { node?: { text?: string } }[] };
  taken_at_timestamp?: number;
  video_url?: string;
  display_url?: string;
  display_resources?: ScrapeCreatorsImageCandidate[];
  dimensions?: { width?: number; height?: number };
  clips_music_attribution_info?: {
    song_name?: string;
    artist_name?: string;
    audio_id?: string;
  };
  edge_sidecar_to_children?: { edges?: { node?: ScrapeCreatorsCarouselChildNode }[] };
  is_video?: boolean;
  product_type?: string;
  shortcode?: string;
  thumbnail_url?: string;

  owner?: ScrapeCreatorsOwner;

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
