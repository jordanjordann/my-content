import type { MediaPart } from "@/lib/server/analysis/media/types";

export interface MediaMetadata {
  url: string;
  shortcode: string;
  mediaType: "reel" | "post" | "carousel" | "short";
  username: string;
  caption: string | null;
  // Q4=(c): `viewCount` is video_view_count for every media type — the
  // displayed/ranked metric, consistently, across reels and carousel
  // slides. See `playCount`/`displayedCountIsPlayCount` below for the raw
  // plays value and the reel zero-view fallback record.
  viewCount: number | null;
  postDate: string | null;
  durationSec: number | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;

  // New — all optional so the YouTube fetcher needs no changes.
  likeCount?: number | null;
  commentCount?: number | null;
  hasAudio?: boolean | null;
  audioTitle?: string | null;
  audioArtist?: string | null;
  audioId?: string | null;
  audioIsOriginal?: boolean | null;
  originalWidth?: number | null;
  originalHeight?: number | null;
  carouselItemCount?: number | null;
  // Stable platform-side owner id: the IG media owner id, or the YouTube
  // `UC...` channel id.
  externalId?: string | null;
  followerCount?: number | null; // filled by pipeline after profile resolve
  engagementRate?: number | null; // filled by pipeline after profile resolve

  /**
   * Ticket #71, Q4=(c). `video_play_count` — persisted alongside
   * `viewCount`, never discarded at ingestion. Sourced from the same media
   * node `viewCount`/`durationSec`/audio are (the first video part —
   * `mediaParts[0]` of kind "video" — for a carousel, or the post's own
   * top-level video for a reel/post). `null` when there is no video part.
   */
  playCount?: number | null;
  /**
   * `true` when `viewCount` is a known-bad `0` and the persisted/displayed
   * number instead came from `playCount` (Q4) — set so a reel's zero-view
   * trap is recorded rather than silently swapped.
   */
  displayedCountIsPlayCount?: boolean;

  /**
   * Every media part (slide) for this post, in document order, capped at
   * `MAX_MEDIA_PARTS`. Empty for an image-only single post (unchanged
   * behaviour — a lone image post is not sent to Gemini as media).
   */
  mediaParts?: MediaPart[];
  /** `true` iff `mediaParts` was truncated by `MAX_MEDIA_PARTS` (Q3). */
  mediaPartsTruncated?: boolean;

  /**
   * C8: post-level `like_and_view_counts_disabled`. `undefined` when the
   * source payload never carried the key — MUST NOT be read as `false`.
   * When `true`, the affected counts (`viewCount`, `likeCount`,
   * `commentCount`) are persisted as `null`, never coerced to `0`.
   */
  likeAndViewCountsDisabled?: boolean;

  /**
   * C9: `coauthor_producers` usernames, stored/carried but deliberately
   * kept OUT of the analysis path — never sent to Gemini, never referenced
   * by a prompt, never surfaced as an analysis output. Absent and empty
   * source arrays are both represented as `[]` here (never `undefined`),
   * per the "handled identically" requirement.
   */
  coauthorUsernames?: string[];
}

/**
 * Owner block extracted from a ScrapeCreators post payload, handed to the
 * profiles service so it can opportunistically hydrate a profile without a
 * second API call when the follower count is already present.
 */
export interface OwnerProfileHint {
  username: string | null;
  externalId: string | null;
  followerCount: number | null;
  followingCount: number | null;
  fullName: string | null;
  profilePicUrl: string | null;
  biography: string | null;
  isVerified: boolean | null;
  isBusinessAccount: boolean | null;
  isPrivate: boolean | null;
}
