export type MediaType = "reel" | "post" | "carousel" | "short";
export type Platform = "instagram" | "youtube";

export interface ClassifiedUrl {
  url: string;
  platform: Platform;
  mediaType: MediaType;
}

const IG_REEL_RE = /^https?:\/\/(www\.)?instagram\.com\/reel\/[\w-]+\/?(\?.*)?$/i;
const IG_POST_RE = /^https?:\/\/(www\.)?instagram\.com\/p\/[\w-]+\/?(\?.*)?$/i;
/**
 * Shorts-only, deliberately. Do NOT widen this to `/watch?v=`, `youtu.be`,
 * `/live/`, `/embed/` or any long-form YouTube URL.
 *
 * Settled owner decision (2026-07-21), on two grounds:
 *   1. Product focus — the analysis prompt/scorecard is built for short-form
 *      patterns (hooks, retention, first-seconds pacing). Long-form is a
 *      different problem.
 *   2. Cost — video is sent to Gemini as input tokens. At the existing
 *      MAX_VIDEO_SECONDS = 900 ceiling (lib/server/analysis/constants.ts) a
 *      15-minute video is ~100x the input tokens of a 30s Short, making
 *      per-analysis cost unpredictable.
 *
 * See #54 and #58 (decision ticket, closed as rejected). The pattern is also
 * end-anchored on purpose so traversal-style URLs such as
 * `youtube.com/shorts/x/../../watch?v=y` are rejected before the pipeline.
 * `cleanYouTubeUrl` in fetcher/youtube.ts additionally depends on the id
 * living in the path rather than the query string.
 */
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
