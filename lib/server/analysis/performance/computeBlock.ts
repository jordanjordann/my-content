import type { Platform } from "@/lib/server/analysis/classifier/rules";
import {
  resolveInstagramCommentAvailability,
  resolveInstagramLikeAvailability,
  resolveYoutubeCommentAvailability,
  resolveYoutubeLikeAvailability,
} from "./availability";
import { computeBaseline, computeBucketKey, denominatorForBucket } from "./baseline";
import type { AnalysisMode, MediaType } from "./baseline";
import { MATURITY_FLOOR_HOURS } from "./constants";
import { computeJudgement } from "./judgement";
import { computeEngagementRate, computeReachEngagementRatio, computeReachPerFollower } from "./ratios";
import type {
  AvailabilityState,
  ComputedPerformanceBlock,
  ReachResult,
  Tier1Ratio,
  Tier3Ratio,
} from "./types";

/**
 * TDD §2 module map / §4 / §5.1 (ticket #143, 3B-5). Orchestrates reach +
 * availability + ratios + baseline + judgement into the frozen
 * `ComputedPerformanceBlock` — this is the ONLY place `pipeline/index.ts`
 * calls into to get the five OR-13 fields plus every other `perf_*` value.
 *
 * Runs between adapter and prompt-build (TDD §2's architecture diagram):
 * `adapter -> [computeBlock] -> prompt-build -> gemini -> prose guard ->
 * parser -> persist`. Every input here has already been resolved by the
 * adapter/fetcher stage or the profile-resolution stage — this function does
 * exactly one I/O call itself (`computeBaseline`'s single `SELECT`).
 */

/** `AvailabilityState` for likes/comments — platform-branched, per `availability.ts`'s own module doc (OR-20/OR-21/V1). */
function resolveEngagementAvailability(params: {
  platform: Platform;
  likeCount: number | null | undefined;
  commentCount: number | null | undefined;
  likeAndViewCountsDisabled: boolean | null | undefined;
}): { likeState: AvailabilityState; commentState: AvailabilityState } {
  if (params.platform === "youtube") {
    return {
      likeState: resolveYoutubeLikeAvailability(params.likeCount).state,
      commentState: resolveYoutubeCommentAvailability(params.commentCount).state,
    };
  }

  return {
    likeState: resolveInstagramLikeAvailability({
      rawCount: params.likeCount,
      likeAndViewCountsDisabled: params.likeAndViewCountsDisabled,
    }).state,
    commentState: resolveInstagramCommentAvailability(params.commentCount).state,
  };
}

/**
 * Tier 1 ratio selection (PRD §12.2/§12.5). Reach-denominated whenever a
 * reach figure exists at all (`derivedFrom !== "NONE"`) and is usable
 * (`AVAILABLE`/`ZERO`) — R-12.2.1 reserves the follower-denominated form for
 * content kinds with NO reach field at all, never as a fallback for
 * unusable/hidden reach on content that does carry one. `ratios.ts`'s own
 * functions are the arithmetic (TR-1 — one expression per quantity); this
 * function only decides WHICH one to call and gates on availability, per
 * `ratios.ts`'s own module doc ("call them only when the corresponding
 * input's availability state is AVAILABLE/ZERO").
 */
function isUsableAvailability(state: AvailabilityState): boolean {
  return state === "AVAILABLE" || state === "ZERO";
}

function resolveTier1Ratio(params: {
  reach: ReachResult;
  likeCount: number | null;
  commentCount: number | null;
  likeState: AvailabilityState;
  commentState: AvailabilityState;
  followerCount: number | null;
}): Tier1Ratio | null {
  const hasEngagementNumerator =
    isUsableAvailability(params.likeState) || isUsableAvailability(params.commentState);
  if (!hasEngagementNumerator) {
    return null;
  }

  const reachUsable = isUsableAvailability(params.reach.state);

  if (params.reach.derivedFrom !== "NONE" && reachUsable) {
    return computeReachEngagementRatio({
      likeCount: params.likeCount,
      commentCount: params.commentCount,
      reachValue: params.reach.value,
      reachKind: params.reach.kind,
    });
  }

  if (params.reach.derivedFrom === "NONE") {
    return computeEngagementRate({
      likeCount: params.likeCount,
      commentCount: params.commentCount,
      followerCount: params.followerCount,
    });
  }

  return null;
}

/** Tier 3 (PRD §5.1/§12.5): reach ÷ followers. Never applicable when there is no reach at all (`derivedFrom === "NONE"`). */
function resolveTier3Ratio(reach: ReachResult, followerCount: number | null): Tier3Ratio | null {
  if (reach.derivedFrom === "NONE") {
    return null;
  }
  if (!isUsableAvailability(reach.state)) {
    return null;
  }
  return computeReachPerFollower({ reachValue: reach.value, followerCount });
}

/** Hours between `postDate` (ISO 8601) and `now`. `null` when `postDate` is missing/unparseable — never fabricated as `0`. */
function computePostAgeHours(postDate: string | null | undefined, now: Date): number | null {
  if (!postDate) {
    return null;
  }
  const posted = new Date(postDate);
  if (Number.isNaN(posted.getTime())) {
    return null;
  }
  const diffMs = now.getTime() - posted.getTime();
  return diffMs / (1000 * 60 * 60);
}

export interface ComputePerformanceBlockInput {
  platform: Platform;
  mediaType: MediaType;
  analysisMode: AnalysisMode;
  reach: ReachResult;
  likeCount: number | null | undefined;
  commentCount: number | null | undefined;
  likeAndViewCountsDisabled: boolean | null | undefined;
  followerCount: number | null | undefined;
  /** `profiles.last_fetched_at` at analysis time — copied verbatim into `audienceSourceFetchedAt` (§1.3). `null` when no profile resolved. */
  audienceSourceFetchedAt: string | null;
  postDate: string | null | undefined;
  profileId: string | null;
  analysisId: string;
  schemaVersion: number;
  /** Injectable for tests; defaults to `new Date()`. */
  now?: Date;
}

/**
 * The single entry point `pipeline/index.ts` calls. Every field of the
 * returned `ComputedPerformanceBlock` is what gets persisted to the
 * `perf_*` columns (plus `audience_source_fetched_at`) — this function does
 * not itself touch the database beyond the one `computeBaseline` read.
 */
export async function computePerformanceBlock(
  input: ComputePerformanceBlockInput,
): Promise<ComputedPerformanceBlock> {
  const now = input.now ?? new Date();
  const followerCount = input.followerCount ?? null;
  const likeCount = input.likeCount ?? null;
  const commentCount = input.commentCount ?? null;

  const { likeState, commentState } = resolveEngagementAvailability({
    platform: input.platform,
    likeCount,
    commentCount,
    likeAndViewCountsDisabled: input.likeAndViewCountsDisabled,
  });

  const tier1Ratio = resolveTier1Ratio({
    reach: input.reach,
    likeCount,
    commentCount,
    likeState,
    commentState,
    followerCount,
  });
  const tier3Ratio = resolveTier3Ratio(input.reach, followerCount);

  const bucketKey = computeBucketKey(input.platform, input.mediaType, input.analysisMode);
  const postAgeHours = computePostAgeHours(input.postDate, now);

  const reachValueForBaseline = isUsableAvailability(input.reach.state) ? input.reach.value : null;

  // denominatorForBucket() throws on a malformed key — computeBucketKey()
  // above already validated platform/mediaType/analysisMode, so this call
  // only re-derives the axis, it does not re-validate.
  denominatorForBucket(bucketKey);

  // D5 part 3 / TDD §6: Tier 2's baseline excludes candidates younger than
  // the maturity floor. No `profileId` means no creator to compare against
  // at all — skip the DB read entirely rather than querying with a `NULL`
  // `profile_id` (which would match nothing anyway, but skipping is
  // explicit rather than incidental).
  const baseline = input.profileId
    ? await computeBaseline({
        profileId: input.profileId,
        bucketKey,
        schemaVersion: input.schemaVersion,
        excludeAnalysisId: input.analysisId,
        minPostAgeHours: MATURITY_FLOOR_HOURS,
        currentPost: {
          reachValue: reachValueForBaseline,
          likeCount,
          commentCount,
        },
      })
    : ({ state: "COLD_START" as const, bucketKey, sampleSize: 0 });

  const judgement = computeJudgement({
    platform: input.platform,
    reach: input.reach,
    likeAndViewCountsDisabled: input.likeAndViewCountsDisabled,
    likeState,
    commentState,
    followerCount,
    tier1Ratio,
    tier3Ratio,
    baseline,
    postAgeHours,
  });

  return {
    reach: input.reach,
    likeState,
    commentState,
    tier1Ratio,
    tier3Ratio,
    bucketKey,
    baseline,
    postAgeHours,
    audienceSourceFetchedAt: input.audienceSourceFetchedAt,
    ...judgement,
  };
}
