import { resolveUnavailableReasonCopy } from "@/lib/analysis/performance/render";
import type {
  AbsentCountReason,
  AnalysisListItem,
  AnalysisMode,
  AnalysisPerformance,
  AnalysisPlatform,
  AnalysisTableDerivedPerformance,
  AnalysisTableEngagementCell,
  AnalysisTableMultiplierCell,
  AnalysisTablePerformanceCell,
  Confidence,
  CountState,
  PerformanceComputed,
  PerformanceTier2,
  Tier,
  UnavailableReason,
} from "@/lib/api/analyses/types";

/**
 * Video-bearing media types, per `AnalysisListItem["mediaType"]` — the only content-kind
 * signal the client actually has (`lib/api/analyses/types.ts`; the server's finer-grained
 * `ReachResult.hasVideo`, `lib/server/analysis/performance/reach.ts`, is not part of the
 * #144 API response). `carousel` is deliberately excluded: a carousel can be all-image, and
 * `deriveEngagementCell` only reaches its media-type branch when `computed.reach.derivedFrom
 * === "NONE"` — which the server only ever produces for a carousel when NO slide, first or
 * later, carries a reach field (a genuinely image-only carousel) — so treating `carousel` as
 * "video" here would be the wrong direction of error.
 */
const VIDEO_MEDIA_TYPES: ReadonlySet<AnalysisListItem["mediaType"]> = new Set(["reel", "short"]);

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
 * OR-11 (TDD §9.5) — the three-case absent-count reason. Derived, never stored, verified
 * viable in TDD §1.6 (`like_and_view_counts_disabled` reaches the client as a genuine
 * tri-state `true`/`false`/`null`). Ordering is load-bearing and there is **no fallback to
 * case 1**:
 *
 * 1. `likeAndViewCountsDisabled === true` — a verified creator setting, not an inference.
 * 2. `unavailableReason === "CONTENT_KIND_UNSUPPORTED"` — an all-image carousel/single-image
 *    post, a structural fact about the post type, not the creator's choice. This is the
 *    server-computed, non-overloaded signal (OR-26, `docs/TDD-3A-3B-3C-phase-3.md:126`) —
 *    NOT `mediaType === "carousel" && reach.derivedFrom === "NONE"`. That combination is
 *    overloaded: it is also true for a mixed image+video carousel whose cover slide is an
 *    image but a later slide carries real reach (`unavailableReason:
 *    "REACH_NOT_ON_FIRST_SLIDE"` in that case, which correctly falls through to case 3
 *    below, never case 2) — using `derivedFrom` here would fabricate "this post type
 *    doesn't report counts" on a post that DOES contain video (R-13.5.3a).
 * 3. Anything else, INCLUDING `likeAndViewCountsDisabled === false` — fetch failures, private
 *    accounts, `REACH_NOT_ON_FIRST_SLIDE`, and unseen payload shapes must never be diagnosed
 *    as case 1 or case 2 by inference (Decision 6, R-13.5.2). This is the mandatory,
 *    non-fallback default.
 */
export function deriveAbsentCountReason(input: {
  unavailableReason: UnavailableReason | null;
  likeAndViewCountsDisabled: boolean | null;
}): AbsentCountReason {
  if (input.likeAndViewCountsDisabled === true) return "CREATOR_DISABLED";
  if (input.unavailableReason === "CONTENT_KIND_UNSUPPORTED") return "TYPE_NOT_REPORTED";
  return "NOT_AVAILABLE";
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

/**
 * Ticket #205 — the Counts cell's comfortable-density likes-line comment figure. Mirrors
 * `classifyReachCountState` exactly: `performance.computed.comments` is already resolved
 * server-side (`{ value, state }`, same shape as `computed.likes`), so this only maps that
 * resolved `PerformanceAvailabilityState` onto the shared `CountState` union — the component
 * must never branch on `computed.comments` directly. Comments have no `plays` equivalent
 * (design §2: like counts only ever render Hidden / 0 / — / count, and comments follow the
 * same four-state grammar) and, per `availability.ts`'s own comment, are never `HIDDEN` in
 * practice (`like_and_view_counts_disabled` deliberately never gates comments) — the `hidden`
 * branch below only exists so this stays exhaustive over the shared `PerformanceAvailabilityState`
 * type rather than assuming that invariant holds forever.
 */
export function classifyCommentCountState(comments: PerformanceComputed["comments"]): CountState {
  if (comments.state === "HIDDEN") return { kind: "hidden" };
  if (comments.state === "UNKNOWN") return { kind: "unknown" };
  if (comments.state === "ZERO") return { kind: "zero" };
  // AVAILABLE — a value must exist by construction; if it somehow doesn't, degrade to
  // `unknown` rather than rendering a fabricated `0`.
  if (comments.value == null) return { kind: "unknown" };
  return { kind: "count", value: comments.value };
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

/**
 * Ticket #147 / DESIGN-3B §3.1.1 (amendment B5, 2026-08-12) — the score-explain popover's
 * deterministic "these disagree" line. Compares the 1-5 judgement against the Tier 2
 * multiplier (not Tier 1 against Tier 2 — the Tier 1 ratio has no stored creator-relative
 * reference, so that comparison needs a schema change and is set aside per B5).
 *
 * Thresholds, per §3.1.1's truth table:
 * - score: `4-5` high, `3` neutral (the score side's own deadband — a rater-chosen
 *   "middling" value, not a boundary), `1-2` low.
 * - multiplier: `m >= 1.15` high, `m < 0.85` low, deadband `0.85 <= m < 1.15` (the bracket
 *   is asymmetric on purpose — it matches the one-decimal precision the multiplier already
 *   renders at, so nothing displaying as `0.9x`/`1.0x`/`1.1x` is ever called high or low).
 *
 * Only two of §3.1.1's copy variants render — D1 (score high, multiplier low) and D2 (score
 * low, multiplier high). The two agreement variants (`Strong on both...` / `Weak on both
 * readings.`) are retired by B5 and must not be implemented: with a deadband, "agreement" is
 * no longer the clean complement of "disagreement" — the neutral zone renders nothing, on
 * purpose. `null` whenever either side is missing, when both sides are in the deadband, or
 * when the two readings don't clear both thresholds in opposite directions.
 */
function computeScoreMultiplierDisagreement(
  score: number | null,
  tier2: PerformanceTier2 | null,
): string | null {
  if (score == null || tier2?.multiplier == null) {
    return null;
  }

  const multiplier = tier2.multiplier;
  const scoreHigh = score >= 4;
  const scoreLow = score <= 2;
  const multiplierHigh = multiplier >= 1.15;
  const multiplierLow = multiplier < 0.85;

  if (scoreHigh && multiplierLow) {
    return "The 1–5 reads this more favourably than the measured comparison does — it came in under this creator's usual for this kind of post. The measured figures above are the ones to quote.";
  }

  if (scoreLow && multiplierHigh) {
    return "The 1–5 reads this less favourably than the measured comparison does — it came in over this creator's usual for this kind of post. The measured figures above are the ones to quote.";
  }

  return null;
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
 * The "wrong-denominator" reasons are DESIGN-3C's own worked examples, verbatim, not
 * invented: `no follower measure here` (§4, Eng. / followers, reel row) and, for Eng. /
 * reach, one of two strings depending on the row's actual content kind — collapsing them
 * is exactly what R-13.5.2 (§5.4) forbids: `not published for image posts` (§4, all-image-
 * carousel row) for genuinely image-only content, or `no post-level reach` (§5.4 line 293)
 * for video content (a reel, a video-bearing carousel) whose reach happens to be
 * unavailable — that post DOES publish counts, so the image-posts string would be false
 * (PR #198 review, round 3, blocker: the fix must not pick the string by denominator alone).
 */
function deriveEngagementCell(
  computed: PerformanceComputed,
  denominator: "REACH" | "FOLLOWERS",
  mediaType: AnalysisListItem["mediaType"],
): AnalysisTableEngagementCell {
  const { tier1, unavailableReason, reach, audience } = computed;

  if (tier1?.denominator === denominator) {
    if (tier1.denominator === "REACH") {
      return {
        kind: "value",
        ratio: tier1.ratio,
        denominator: "REACH",
        reachKind: tier1.reachKind,
        reachValue: reach.value,
        // R-D3 — a video-bearing carousel's reach is first-slide-derived (D4), never a
        // per-post figure; the confidence penalty is already carried on `computed.confidence`
        // (`judgement.ts`), this field only drives the qualifier's `· first slide only` suffix.
        firstSlideOnly: reach.derivedFrom === "CAROUSEL_FIRST_SLIDE",
      };
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
      text:
        denominator === "REACH"
          ? VIDEO_MEDIA_TYPES.has(mediaType)
            ? "no post-level reach"
            : "not published for image posts"
          : "no follower measure here",
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
 * Ticket #149 / DESIGN-3C §2.1 — the Content cell's mode chip (`Caption only` / `Images only`,
 * AC-13). Parses the same `bucketKey` `bucketNoun()` above already parses
 * (`platform:mediaType:analysisMode`) rather than adding a second stored/fetched field. `null`
 * when `tier2` is `null` (no performance block) or the bucket key's third segment isn't one of
 * the three known modes — the Content cell renders no chip rather than guess one (R-13.5.3a).
 */
function deriveAnalysisMode(tier2: PerformanceTier2 | null): AnalysisMode | null {
  if (tier2 == null) {
    return null;
  }
  const mode = tier2.bucketKey.split(":")[2];
  return mode === "full_video" || mode === "images_only" || mode === "metadata_only" ? mode : null;
}

/**
 * Ticket #145 (PR #198 review, blocker 8) — the analyses table's per-row cell decisions,
 * computed once per row in `hooks.ts`'s `select` rather than on every render inside
 * `AnalysisTableRow`. `null` iff `performance` is `null` (failed/pending rows never reach this
 * — `AnalysisTableRow` renders the whole-row failed treatment for those instead).
 */
export function deriveAnalysisTablePerformance(
  performance: AnalysisPerformance,
  mediaType: AnalysisListItem["mediaType"],
  likeAndViewCountsDisabled: boolean | null,
): AnalysisTableDerivedPerformance | null {
  if (performance == null) {
    return null;
  }

  const { computed, judgement } = performance;

  return {
    reachCountState: classifyReachCountState(computed.reach),
    commentCountState: classifyCommentCountState(computed.comments),
    absentCountReason: deriveAbsentCountReason({
      unavailableReason: computed.unavailableReason,
      likeAndViewCountsDisabled,
    }),
    performanceCell: derivePerformanceCell(computed, judgement.performanceScore),
    multiplierCell: deriveMultiplierCell(computed),
    engagementReachCell: deriveEngagementCell(computed, "REACH", mediaType),
    engagementFollowersCell: deriveEngagementCell(computed, "FOLLOWERS", mediaType),
    disagreementLine: computeScoreMultiplierDisagreement(judgement.performanceScore, computed.tier2),
    analysisMode: deriveAnalysisMode(computed.tier2),
  };
}
