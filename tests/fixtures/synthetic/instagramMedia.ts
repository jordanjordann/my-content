import type {
  ScrapeCreatorsCarouselChildNode,
  ScrapeCreatorsMedia,
} from "@/lib/server/scrapecreators/types";

/**
 * ⚠️ SYNTHETIC — NOT API CAPTURES. ⚠️
 *
 * These are minimal hand-built inputs shaped to `ScrapeCreatorsMedia`, used to
 * exercise `adapter.ts`'s own branching (media-type resolution, the thumbnail
 * fallback chain, the video-child selection rule, nullable-boolean coercion,
 * the no-username throw). They pin **our adapter's behaviour**, not
 * ScrapeCreators' response shape.
 *
 * They are deliberately kept out of `tests/fixtures/scrapecreators/` so that
 * nothing here can ever be mistaken for a verified capture. Do not cite these
 * files as evidence for what the API returns, and do not add fields to them to
 * "document" an API shape — that belongs in `.claude/context/verified-facts.md`
 * and must come from a real capture.
 *
 * The genuine golden files for `/v1/instagram/post` (reel, all-image carousel,
 * video-bearing carousel) are still outstanding — see
 * `tests/fixtures/README.md`.
 */

export const IG_REEL_URL = "https://www.instagram.com/somecreator/reel/ABC123def/";
export const IG_POST_URL = "https://www.instagram.com/somecreator/p/XYZ789ghi/";

/** A single-video reel. */
export function makeReel(overrides: Partial<ScrapeCreatorsMedia> = {}): ScrapeCreatorsMedia {
  return {
    __typename: "XDTGraphVideo",
    id: "media-1",
    shortcode: "ABC123def",
    is_video: true,
    product_type: "clips",
    taken_at_timestamp: 1_700_000_000,
    video_url: "https://cdn.example/reel.mp4",
    video_view_count: 12_345,
    video_duration: 18.5,
    has_audio: true,
    thumbnail_src: "https://cdn.example/reel-thumb.jpg",
    display_url: "https://cdn.example/reel-display.jpg",
    dimensions: { width: 1080, height: 1920 },
    edge_media_preview_like: { count: 900 },
    edge_media_to_parent_comment: { count: 42 },
    edge_media_to_caption: { edges: [{ node: { text: "caption text" } }] },
    clips_music_attribution_info: {
      song_name: "Song Name",
      artist_name: "Artist Name",
      audio_id: "audio-1",
      uses_original_audio: false,
    },
    owner: { id: "owner-1", username: "somecreator" },
    ...overrides,
  };
}

/** A single still image post. */
export function makeImagePost(
  overrides: Partial<ScrapeCreatorsMedia> = {},
): ScrapeCreatorsMedia {
  return {
    __typename: "XDTGraphImage",
    id: "media-2",
    shortcode: "XYZ789ghi",
    is_video: false,
    taken_at_timestamp: 1_700_000_000,
    display_url: "https://cdn.example/post-display.jpg",
    dimensions: { width: 1080, height: 1350 },
    edge_media_preview_like: { count: 10 },
    edge_media_to_parent_comment: { count: 1 },
    owner: { id: "owner-1", username: "somecreator" },
    ...overrides,
  };
}

export function makeImageChild(
  overrides: Partial<ScrapeCreatorsCarouselChildNode> = {},
): ScrapeCreatorsCarouselChildNode {
  return {
    __typename: "XDTGraphImage",
    id: "child-image",
    is_video: false,
    display_url: "https://cdn.example/child-image-display.jpg",
    dimensions: { width: 1080, height: 1080 },
    ...overrides,
  };
}

/**
 * A video-typed carousel slide. Shape matches the REAL video-bearing
 * carousel capture confirmed by PR #84/#71 (`video_duration`,
 * `clips_music_attribution_info`, `thumbnail_src` all confirmed ABSENT on
 * every one of 7 real video children — see
 * `.claude/context/verified-facts.md`, "Video carousel child — CONFIRMED
 * shape"): `video_play_count` is present but always `null`, while
 * `video_view_count` is the field that's actually populated (C4 reversal).
 */
export function makeVideoChild(
  overrides: Partial<ScrapeCreatorsCarouselChildNode> = {},
): ScrapeCreatorsCarouselChildNode {
  return {
    __typename: "XDTGraphVideo",
    id: "child-video",
    is_video: true,
    video_url: "https://cdn.example/child-video.mp4",
    video_view_count: 50_000,
    video_play_count: null,
    has_audio: false,
    display_url: "https://cdn.example/child-video-display.jpg",
    dimensions: { width: 1080, height: 1080 },
    ...overrides,
  };
}

/**
 * A sidecar. Note what is deliberately absent at the top level: no
 * `video_url`, no `has_audio`, no `clips_music_attribution_info`, no
 * `thumbnail_src` — matching what the code's own comments record about the
 * real all-image carousel capture.
 */
export function makeCarousel(
  children: ScrapeCreatorsCarouselChildNode[],
  overrides: Partial<ScrapeCreatorsMedia> = {},
): ScrapeCreatorsMedia {
  return {
    __typename: "XDTGraphSidecar",
    id: "media-3",
    shortcode: "XYZ789ghi",
    taken_at_timestamp: 1_700_000_000,
    display_url: undefined,
    dimensions: { width: 1080, height: 1080 },
    edge_media_preview_like: { count: 5 },
    edge_media_to_parent_comment: { count: 0 },
    edge_sidecar_to_children: { edges: children.map((node) => ({ node })) },
    owner: { id: "owner-1", username: "somecreator" },
    ...overrides,
  };
}
