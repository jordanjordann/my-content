import type { AnalysisPlatform, CountState } from "@/lib/api/analyses/types";

/** Lowercase, trim, and collapse whitespace runs to a single space. */
export function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Routes Instagram thumbnail URLs through the same-origin image proxy
 * (`/api/image-proxy`) to work around the Instagram/FB CDN's
 * Cross-Origin-Resource-Policy block on direct embedding. The proxy route
 * only allowlists IG/FB CDN hosts, so non-Instagram platforms (e.g.
 * YouTube) must be passed through unchanged — wrapping them would 400.
 */
export function toProxiedThumbnail(
  url: string | null,
  platform: AnalysisPlatform,
): string | null {
  if (!url) {
    return null;
  }

  if (platform !== "instagram") {
    return url;
  }

  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Classifies a view count into a `CountState` (TDD §4.2). Ordering is load-bearing —
 * do not reorder:
 *
 * 1. `likeAndViewCountsDisabled === true` always wins first (creator setting overrides
 *    everything else, including a present `viewCount`).
 * 2. State 4 (`(viewCount === 0 || viewCount == null) && playCount > 0`) is checked before
 *    `zero`/`unknown` so a false-zero or missing view count with a real play count renders
 *    as `plays`, never `0` or `—` (TDD §4.2, decision D1 in §8). This branch is structurally
 *    unreachable for carousel children, whose `playCount` is `null` (not `0`) — do not
 *    special-case `mediaType`.
 * 3. `viewCount === 0` (with no usable play count) is a genuine measured zero.
 * 4. `viewCount == null` (with no usable play count) is unknown / never fetched.
 * 5. Otherwise it is a normal non-zero count.
 */
export function classifyViewCount(input: {
  viewCount: number | null;
  playCount: number | null;
  likeAndViewCountsDisabled: boolean | null;
}): CountState {
  if (input.likeAndViewCountsDisabled === true) return { kind: "hidden" };
  if (
    (input.viewCount === 0 || input.viewCount == null) &&
    input.playCount != null &&
    input.playCount > 0
  ) {
    return { kind: "plays", value: input.playCount };
  }
  if (input.viewCount === 0) return { kind: "zero" };
  if (input.viewCount == null) return { kind: "unknown" };
  return { kind: "count", value: input.viewCount };
}

/**
 * Classifies a like count into a `CountState` (TDD §4.2). Likes have no `plays`
 * equivalent — that `kind` is unreachable here by construction, which is correct
 * (design §2: likes only ever render Hidden / 0 / — / count).
 */
export function classifyLikeCount(input: {
  likeCount: number | null;
  likeAndViewCountsDisabled: boolean | null;
}): CountState {
  if (input.likeAndViewCountsDisabled === true) return { kind: "hidden" };
  if (input.likeCount == null) return { kind: "unknown" };
  if (input.likeCount === 0) return { kind: "zero" };
  return { kind: "count", value: input.likeCount };
}
