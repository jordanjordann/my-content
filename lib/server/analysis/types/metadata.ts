export interface MediaMetadata {
  url: string;
  shortcode: string;
  mediaType: "reel" | "post" | "carousel" | "short";
  username: string;
  caption: string | null;
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
