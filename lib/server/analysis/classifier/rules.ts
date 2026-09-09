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
 * Ticket #295: the matched URL is now also what's handed to Gemini
 * directly as its native `fileData.fileUri` input (no rewrite) — one more
 * reason the id must live in the path, not the query string.
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

/**
 * Canonical path segment for each media type recognised by `classifyUrl()`.
 * `carousel` has no regex above (nothing produces it yet) — deliberately
 * excluded so a future carousel regex must extend this map explicitly
 * rather than the map silently emitting a wrong prefix.
 */
const CANONICAL_PATH_SEGMENT: Partial<Record<MediaType, string>> = {
  reel: "reel",
  post: "p",
  short: "shorts",
};

/**
 * Builds the canonical dedupe key for a URL `classifyUrl()` accepts.
 *
 * NOT a replacement URL — do not hand this to the fetch/analyse path.
 * `runAnalysis()` / `lib/server/analysis/fetcher` must keep using the raw,
 * unmodified user URL (ticket #295: Gemini fetches YouTube video server-side
 * from the exact string it's given).
 *
 * Reuses `classifyUrl()`'s regexes rather than re-deriving acceptance rules,
 * so normalisation and classification can never drift apart (TR-1).
 */
export function normaliseAnalysisUrl(url: string): string | null {
  const classified = classifyUrl(url);
  if (!classified) {
    return null;
  }

  const pathSegment = CANONICAL_PATH_SEGMENT[classified.mediaType];
  if (!pathSegment) {
    return null;
  }

  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  // Path shape is guaranteed by classifyUrl(): /<prefix>/<id>(/)?(?query)?
  // Case of the id is preserved verbatim — Instagram shortcodes and
  // YouTube video ids are case-sensitive.
  const segments = parsed.pathname.split("/").filter(Boolean);
  const id = segments[1];

  return `https://${host}/${pathSegment}/${id}`;
}
