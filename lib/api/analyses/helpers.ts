import { resolveUnavailableReasonCopy } from "@/lib/analysis/performance/render";
import type {
  AnalysisPerformance,
  AnalysisPlatform,
  AnalysisTableDerivedPerformance,
  AnalysisTableEngagementCell,
  AnalysisTableMultiplierCell,
  AnalysisTablePerformanceCell,
  Confidence,
  CountState,
  PerformanceComputed,
  Tier,
} from "@/lib/api/analyses/types";

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

/**
 * The analyses table's Counts cell (col 4, PR #198 review blocker 4) reads
 * `performance.computed.reach` — never the raw `viewCountState` — because for a carousel
 * (`derivedFrom: "CAROUSEL_FIRST_SLIDE"`) or a plays-only reel, the raw view count can be a
 * genuinely WRONG figure under a wrong kind word, not merely a missing one. This classifies
 * that already-resolved reach fact into the same `CountState` shape `EngagementCount` renders,
 * so the cell gets the correct number and the correct kind word (`views`/`plays`) together.
 */
export function classifyReachCountState(reach: PerformanceComputed["reach"]): CountState {
  if (reach.state === "HIDDEN") return { kind: "hidden" };
  if (reach.state === "UNKNOWN") return { kind: "unknown" };
  if (reach.state === "ZERO") return { kind: "zero" };
  // AVAILABLE — a value must exist by construction; if it somehow doesn't, degrade to
  // `unknown` rather than rendering a fabricated `0`.
  if (reach.value == null) return { kind: "unknown" };
  return reach.kind === "PLAYS" ? { kind: "plays", value: reach.value } : { kind: "count", value: reach.value };
}

/** TDD §9.3 / DESIGN-3B §3.1 (governing per Q4) — the tier phrase is never the raw enum. */
function tierPhrase(tierUsed: Tier, denominator: "REACH" | "FOLLOWERS" | null): string | null {
  switch (tierUsed) {
    case "CREATOR_BASELINE":
      return "vs their usual";
    case "REACH_ONLY":
      return denominator === "FOLLOWERS" ? "vs follower count" : "of who saw it";
    case "AUDIENCE_FALLBACK":
      return "rough — vs audience size";
    case "UNAVAILABLE":
      return null;
    default:
      return null;
  }
}

/** DESIGN-3C §5.1 — the confidence word, unconditional on density (PR #198 review, blocker 6). */
function confidenceWord(confidence: Confidence): string | null {
  switch (confidence) {
    case "HIGH":
      return "high confidence";
    case "MEDIUM":
      return "medium confidence";
    case "LOW":
      return "low confidence";
    case "NONE":
      return null;
    default:
      return null;
  }
}

/**
 * Mirrors `lib/server/analysis/performance/baseline.ts`'s shipped `bucketNoun` (OR-9) —
 * copied verbatim because that module lives under `lib/server` and is not importable from a
 * client component. Renders `based on {N} {noun}` using the user's own words for the format
 * bucket, never the literal word "posts" for a bucket that has one.
 */
function bucketNoun(bucketKey: string): string {
  const [, mediaType, analysisMode] = bucketKey.split(":");

  if (mediaType === "reel") return "reels";
  if (mediaType === "carousel") return "carousels";
  if (mediaType === "short") return "Shorts";
  if (mediaType === "post" && analysisMode === "full_video") return "videos";
  return "posts";
}

/** Col 6 (Performance) — score + tier phrase/confidence, or the absent-score reason. */
function derivePerformanceCell(
  computed: PerformanceComputed,
  score: number | null,
): AnalysisTablePerformanceCell {
  if (score == null) {
    return { kind: "reason", text: resolveAbsentScoreReasonText(computed) };
  }

  const phrase = tierPhrase(computed.tierUsed, computed.tier1?.denominator ?? null);
  return {
    kind: "score",
    score,
    tierPhrase: phrase,
    isTier3: computed.tierUsed === "AUDIENCE_FALLBACK",
    confidenceWord: confidenceWord(computed.confidence),
  };
}

/**
 * The `vs their usual` cell (col 7, TDD §9.1 / DESIGN-3C §5.3). R-C1: the bare threshold
 * (`5 posts`) never appears un-nouned; R-C3: the count is the bucket's own count, never a
 * creator total — both satisfied because the noun and count come from `tier2` itself.
 */
function deriveMultiplierCell(computed: PerformanceComputed): AnalysisTableMultiplierCell {
  const { tier2, unavailableReason } = computed;

  if (tier2 == null) {
    if (unavailableReason != null) {
      return { kind: "reason", text: resolveAbsentScoreReasonText(computed) };
    }
    return { kind: "dash" };
  }

  if (tier2.multiplier != null) {
    return {
      kind: "measured",
      multiplier: tier2.multiplier,
      sampleSize: tier2.sampleSize,
      bucketNoun: bucketNoun(tier2.bucketKey),
    };
  }

  // Cold start (§5.3, R-C4 — a partial absence, not an absent score; never sinks).
  return { kind: "cold-start", sampleSize: tier2.sampleSize, bucketNoun: bucketNoun(tier2.bucketKey) };
}

/**
 * Cols 8/9 — Direction A (TDD §9.2 / DESIGN-3C §4). Every row fills exactly one of the two
 * columns; the other renders a plain-language reason, never a blank.
 *
 * The two "wrong-denominator" reasons are DESIGN-3C §4's own worked example table, verbatim,
 * not invented: `no follower measure here` (Eng. / followers, reel row) and
 * `not published for image posts` (Eng. / reach, all-image-carousel row).
 */
function deriveEngagementCell(
  computed: PerformanceComputed,
  denominator: "REACH" | "FOLLOWERS",
): AnalysisTableEngagementCell {
  const { tier1, unavailableReason, reach, audience } = computed;

  if (tier1?.denominator === denominator) {
    if (tier1.denominator === "REACH") {
      return { kind: "value", ratio: tier1.ratio, denominator: "REACH", reachKind: tier1.reachKind, reachValue: reach.value };
    }
    return { kind: "value", ratio: tier1.ratio, denominator: "FOLLOWERS", followersValue: audience.value };
  }

  if (unavailableReason != null) {
    const text = resolveAbsentScoreReasonText(computed);
    if (text != null) {
      return { kind: "reason", text };
    }
  }

  if (tier1 != null) {
    // Tier 1 resolved, but against the OTHER denominator — this row genuinely has no
    // figure for this column, and no stored `unavailableReason` explains why (there is
    // nothing wrong; the other denominator simply won).
    return {
      kind: "reason",
      text: denominator === "REACH" ? "not published for image posts" : "no follower measure here",
    };
  }

  return { kind: "dash" };
}

/**
 * The single entry point for an absent performance score's reason text (DESIGN-3B §5,
 * DESIGN-3C §5.4). Delegates entirely to the isomorphic `lib/analysis/performance/render.ts` —
 * the same function `lib/server/analysis/performance/judgement.ts` uses server-side — rather
 * than a second, mirrored renderer that can drift out of sync (PR #198 review, blocker 2).
 * `null` when no copy is approved for the given state (DESIGN-3B §5.2 — there is no fallback
 * string); callers render their own honest placeholder for `null`, never a substitute sentence.
 */
export function resolveAbsentScoreReasonText(computed: PerformanceComputed): string | null {
  return resolveUnavailableReasonCopy({
    unavailableReason: computed.unavailableReason,
    followerKnown: computed.audience.value != null,
    likeState: computed.likes.state,
    commentState: computed.comments.state,
  });
}

/**
 * Ticket #145 (PR #198 review, blocker 8) — the analyses table's per-row cell decisions,
 * computed once per row in `hooks.ts`'s `select` rather than on every render inside
 * `AnalysisTableRow`. `null` iff `performance` is `null` (failed/pending rows never reach this
 * — `AnalysisTableRow` renders the whole-row failed treatment for those instead).
 */
export function deriveAnalysisTablePerformance(
  performance: AnalysisPerformance,
): AnalysisTableDerivedPerformance | null {
  if (performance == null) {
    return null;
  }

  const { computed, judgement } = performance;

  return {
    reachCountState: classifyReachCountState(computed.reach),
    performanceCell: derivePerformanceCell(computed, judgement.performanceScore),
    multiplierCell: deriveMultiplierCell(computed),
    engagementReachCell: deriveEngagementCell(computed, "REACH"),
    engagementFollowersCell: deriveEngagementCell(computed, "FOLLOWERS"),
  };
}
