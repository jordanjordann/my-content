export type MediaType = "reel" | "post" | "carousel" | "short";
export type Platform = "instagram" | "youtube";

export interface ClassifiedUrl {
  url: string;
  platform: Platform;
  mediaType: MediaType;
}

const IG_REEL_RE = /^https?:\/\/(www\.)?instagram\.com\/reel\/[\w-]+\/?(\?.*)?$/i;
const IG_POST_RE = /^https?:\/\/(www\.)?instagram\.com\/p\/[\w-]+\/?(\?.*)?$/i;
const YT_SHORT_RE = /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+\/?(\?.*)?$/i;

export function classifyUrl(url: string): ClassifiedUrl | null {
  if (IG_REEL_RE.test(url)) {
    return { url, platform: "instagram", mediaType: "reel" };
  }
  if (IG_POST_RE.test(url)) {
    return { url, platform: "instagram", mediaType: "post" };
  }
  if (YT_SHORT_RE.test(url)) {
    return { url, platform: "youtube", mediaType: "short" };
  }
  return null;
}
