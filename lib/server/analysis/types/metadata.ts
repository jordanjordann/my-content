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
}
