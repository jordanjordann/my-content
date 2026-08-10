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
 *
 * PR #191 review, blocker B1b: `derivedFrom` for a carousel is decided by
 * SLIDE 0 ONLY, exactly mirroring `reach.ts`'s `resolveInstagramReach()` —
 * a `mediaParts.some(kind === "video")` check (ANY slide) was the bug: it
 * disagreed with production for an image-on-slide-0 + video-on-slide-3
 * carousel, returning `CAROUSEL_FIRST_SLIDE` where production returns
 * `NONE`, so `user.engagementLabel.test.ts` never actually exercised that
 * shape against the real production rule. `hasVideo`, separately, DOES
 * scan every slide (mirroring `reach.ts`'s `hasVideoChild` scan) — the two
 * facts are deliberately NOT the same predicate.
 */
export function buildTestComputedPerformanceBlock(metadata: MediaMetadata): ComputedPerformanceBlock {
  const { value: displayedViewCount, isPlayCount } = resolveDisplayedViewCountForTest(metadata);

  const parts = metadata.mediaParts ?? [];
  const firstSlideIsVideo = metadata.mediaType === "carousel" && parts[0]?.kind === "video";
  const hasVideoAnywhere = parts.some((part) => part.kind === "video");
  const isReelOrShortLike = metadata.mediaType === "reel" || metadata.mediaType === "short";
  // A reel/short/video-bearing post structurally carries a reach field even
  // when its VALUE is unresolved (hidden counts, an unusable false-zero,
  // etc.) — `derivedFrom` is about field PRESENCE, not value usability.
  // For a carousel, ONLY slide 0 decides `derivedFrom` (production's D4
  // first-slide rule) — a later slide's video does NOT flip `derivedFrom`
  // away from `"NONE"`, it only flips `hasVideo`.
  const looksLikeVideoContent =
    isReelOrShortLike ||
    (metadata.mediaType === "carousel" ? firstSlideIsVideo : hasVideoAnywhere) ||
    metadata.likeAndViewCountsDisabled === true;

  const derivedFrom: ReachDerivedFrom = !looksLikeVideoContent
    ? "NONE"
    : metadata.mediaType === "carousel"
      ? "CAROUSEL_FIRST_SLIDE"
      : "TOP_LEVEL";

  // B1: `hasVideo` scans EVERY slide (or is trivially true for a reel/
  // short/single-video post) — independent of `derivedFrom`, mirroring
  // `reach.ts`'s `hasVideoChild`/`hasReachFields(raw)` scans.
  const hasVideo =
    metadata.mediaType === "carousel" ? hasVideoAnywhere : isReelOrShortLike || looksLikeVideoContent;

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
    hasVideo,
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
