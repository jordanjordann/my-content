import {
  computeEngagementRate,
  computeReachEngagementRatio,
  resolveInstagramCommentAvailability,
  resolveInstagramLikeAvailability,
} from "@/lib/server/analysis/performance";
import type {
  AvailabilityState,
  ComputedPerformanceBlock,
  ReachDerivedFrom,
  ReachKind,
} from "@/lib/server/analysis/performance";
import type { MediaMetadata } from "@/lib/server/analysis/types";

/**
 * Ticket #143 — `buildUserPrompt()`/`computePerformanceAssessmentBlock()`
 * now render a `ComputedPerformanceBlock` (`computeBlock.ts`'s output)
 * instead of deriving one inline from `MediaMetadata`. These prompt-only
 * unit tests (`user.engagementLabel.test.ts`, `user.slideManifest.test.ts`,
 * `resolveMediaParts.test.ts`) exercise the RENDERING of that block against
 * many `MediaMetadata` shapes — not `computeBlock.ts`'s own orchestration
 * (covered by `computeBlock.test.ts` / `judgement.test.ts` /
 * `reach.test.ts`, which exercise the real raw-payload-driven
 * `resolveInstagramReach`/`resolveYoutubeReach`). This helper reconstructs a
 * realistic `ComputedPerformanceBlock` from a test's `MediaMetadata` using
 * the SAME canonical ratio primitives production code calls
 * (`computeReachEngagementRatio`/`computeEngagementRate`/the availability
 * resolvers) — never a hand-rolled arithmetic expression — so these tests
 * stay a faithful proof of the rendering logic without re-deriving
 * `computeBlock.ts`'s own orchestration a second time.
 *
 * `reach.derivedFrom` is inferred from `mediaType`/`mediaParts`/
 * `likeAndViewCountsDisabled` — the same "does this content structurally
 * carry a reach field at all" question `reach.ts` answers from the raw
 * payload's key set (R-12.7.1), approximated here from `MediaMetadata`
 * since these tests never construct a raw `ScrapeCreatorsMedia` payload.
 */
export function buildTestComputedPerformanceBlock(metadata: MediaMetadata): ComputedPerformanceBlock {
  const { value: displayedViewCount, isPlayCount } = resolveDisplayedViewCountForTest(metadata);

  const hasVideoPart = (metadata.mediaParts ?? []).some((part) => part.kind === "video");
  const isReelOrShortLike = metadata.mediaType === "reel" || metadata.mediaType === "short";
  // A reel/short/video-bearing post structurally carries a reach field even
  // when its VALUE is unresolved (hidden counts, an unusable false-zero,
  // etc.) — `derivedFrom` is about field PRESENCE, not value usability.
  const looksLikeVideoContent =
    isReelOrShortLike || hasVideoPart || metadata.likeAndViewCountsDisabled === true;

  const derivedFrom: ReachDerivedFrom = !looksLikeVideoContent
    ? "NONE"
    : metadata.mediaType === "carousel"
      ? "CAROUSEL_FIRST_SLIDE"
      : "TOP_LEVEL";

  const reachKind: ReachKind | null =
    derivedFrom === "NONE" ? null : displayedViewCount == null ? "UNKNOWN" : isPlayCount ? "PLAYS" : "VIEWS";
  const reachState: AvailabilityState =
    derivedFrom === "NONE" || displayedViewCount == null
      ? "UNKNOWN"
      : displayedViewCount === 0
        ? "ZERO"
        : "AVAILABLE";

  const reach = {
    value: reachState === "AVAILABLE" || reachState === "ZERO" ? displayedViewCount : null,
    kind: reachKind,
    state: reachState,
    derivedFrom,
    laterSlideReach: { usable: false as const },
  };

  const likeState = resolveInstagramLikeAvailability({
    rawCount: metadata.likeCount ?? null,
    likeAndViewCountsDisabled: metadata.likeAndViewCountsDisabled,
  }).state;
  const commentState = resolveInstagramCommentAvailability(metadata.commentCount ?? null).state;

  const reachUsable = reach.state === "AVAILABLE" || reach.state === "ZERO";
  const tier1Ratio =
    derivedFrom !== "NONE" && reachUsable
      ? computeReachEngagementRatio({
          likeCount: metadata.likeCount,
          commentCount: metadata.commentCount,
          reachValue: reach.value,
          reachKind: reach.kind,
        })
      : derivedFrom === "NONE"
        ? computeEngagementRate({
            likeCount: metadata.likeCount,
            commentCount: metadata.commentCount,
            followerCount: metadata.followerCount,
          })
        : null;

  return {
    reach,
    likeState,
    commentState,
    tier1Ratio,
    tier3Ratio: null,
    bucketKey: `${metadata.mediaType}:test`,
    baseline: { state: "COLD_START", bucketKey: `${metadata.mediaType}:test`, sampleSize: 0 },
    postAgeHours: null,
    audienceSourceFetchedAt: null,
    tierUsed: tier1Ratio != null ? "REACH_ONLY" : "UNAVAILABLE",
    confidence: tier1Ratio != null ? "HIGH" : "NONE",
    confidenceReason: null,
    basedOnVideos: 0,
    provisional: false,
    unavailableReason: null,
  };
}

/** Mirrors `prompts/user.ts`'s private `resolveDisplayedViewCount` (Q4=(c)) — duplicated here deliberately, this is a test-only reconstruction, not production logic. */
function resolveDisplayedViewCountForTest(metadata: MediaMetadata): {
  value: number | null;
  isPlayCount: boolean;
} {
  if (metadata.likeAndViewCountsDisabled === true) {
    return { value: null, isPlayCount: false };
  }
  if (metadata.displayedCountIsPlayCount && metadata.playCount != null) {
    return { value: metadata.playCount, isPlayCount: true };
  }
  return { value: metadata.viewCount, isPlayCount: false };
}
