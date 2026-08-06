// Barrel — only re-exports, no implementation (AGENTS.md module conventions).
// Grows further as baseline.ts, judgement.ts, computeBlock.ts land (TDD §2).

export { MATURITY_FLOOR_HOURS, BASELINE_MIN_SAMPLE } from "./constants";

export {
  resolveInstagramLikeAvailability,
  resolveInstagramCommentAvailability,
  resolveYoutubeLikeAvailability,
  resolveYoutubeCommentAvailability,
} from "./availability";

export { resolveInstagramReach, resolveYoutubeReach } from "./reach";

export {
  computeEngagementRate,
  computeReachEngagementRatio,
  computeReachPerFollower,
} from "./ratios";

export type {
  AvailabilityState,
  CountAvailabilityResult,
  Denominator,
  FollowerDenominatedRatio,
  ReachDenominatedRatio,
  ReachDerivedFrom,
  ReachKind,
  ReachResult,
  Tier1Ratio,
  Tier3Ratio,
} from "./types";
