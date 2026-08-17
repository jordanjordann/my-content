// Barrel — only re-exports, no implementation (AGENTS.md module conventions).

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

export {
  computeBaseline,
  computeBucketKey,
  bucketNoun,
  fetchLiveEligibleComparatorIds,
  candidatePoolKey,
} from "./baseline";
export type { AnalysisMode, CandidatePoolKey, ComputeBaselineInput, MediaType } from "./baseline";

export {
  computeConfidence,
  computeJudgement,
  computeProvisional,
  determineTierUsed,
  renderUnavailableReasonShortForm,
  resolveHiddenCountsUnavailableReason,
  resolveUnavailableReason,
} from "./judgement";
export type { HiddenCountsUnavailableReason, UnavailableReasonShortForm } from "./judgement";

export { computePerformanceBlock } from "./computeBlock";
export type { ComputePerformanceBlockInput } from "./computeBlock";

export { buildComputedPerformanceBlock } from "./readModel";
export type { PerformanceBlockRow, PerformanceComputed, PerformanceTier2 } from "./readModel";

export { assertNever } from "./types";
export type {
  AvailabilityState,
  BaselineDenominator,
  BaselineResult,
  Confidence,
  ConfidenceReason,
  ComputedPerformanceBlock,
  CountAvailabilityResult,
  Denominator,
  FollowerDenominatedRatio,
  LaterSlideReach,
  ReachDenominatedRatio,
  ReachDerivedFrom,
  ReachKind,
  ReachResult,
  Tier,
  Tier1Ratio,
  Tier3Ratio,
  UnavailableReason,
} from "./types";
