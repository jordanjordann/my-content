import type { Platform } from "@/lib/server/analysis/classifier/rules";
import {
  resolveInstagramCommentAvailability,
  resolveInstagramLikeAvailability,
  resolveYoutubeCommentAvailability,
  resolveYoutubeLikeAvailability,
} from "./availability";
import { computeReachPerFollower } from "./ratios";
import type {
  AvailabilityState,
  Confidence,
  ConfidenceReason,
  Denominator,
  ReachDerivedFrom,
  ReachKind,
  Tier,
  Tier1Ratio,
  Tier3Ratio,
  UnavailableReason,
} from "./types";

/**
 * Ticket #144 (TDD §7, §9.6) — assembles the API response's `performance`
 * block from a DB row, WITHOUT a new migration (owner ruling: no migration
 * 014). Every field here is either a stored `perf_*` column read verbatim,
 * or a PURE re-derivation off already-stored, immutable columns using the
 * SAME resolvers `computeBlock.ts` used at write time (TR-1 — one
 * canonical derivation, reused, never reimplemented) — never a fresh I/O
 * call, never `new Date()`. That purity is what D8 ("byte-identical across
 * two reads of the same completed analysis") rests on.
 *
 * **Ticket #206 (TDD §14.8a) — this function itself is still pure; the
 * response it feeds is not, on exactly one field.** `buildComputedPerformanceBlock`
 * gains an INJECTED `liveColdStartSampleSize` parameter, never an I/O call
 * of its own. It is applied to `tier2.sampleSize` only when `tier2` exists
 * (`perfBucketKey != null`) AND the row is cold start (`perfMultiplier ==
 * null`) — every other field, and a `MEASURED` row's `tier2.sampleSize` in
 * particular, is still read verbatim off the row and stays exactly as
 * frozen as D8 always described. The live value itself is computed once
 * per request, batched across the whole page (D3), by the caller —
 * `baseline.ts`'s `fetchLiveEligibleComparatorIds` — and handed in here as
 * a plain number. Do not infer from this file alone that the RESPONSE is
 * byte-stable across two reads of an unchanged row: for a cold-start row it
 * is not, by design (§14.8a), because the caller may pass a different
 * `liveColdStartSampleSize` on the second call even though `row` itself
 * hasn't changed.
 *
 * Two fields are genuinely RECONSTRUCTED rather than stored, because
 * storing them would have required a migration this ticket is not allowed
 * to add:
 *
 * - `likes`/`comments` (`{ value, state }`): re-derived by calling
 *   `availability.ts`'s own resolvers again over the stored `like_count`/
 *   `comment_count`/`like_and_view_counts_disabled` columns — the EXACT
 *   same raw inputs `computeBlock.ts` fed them at write time
 *   (`pipeline/index.ts` writes `metadata.likeCount`/`metadata.commentCount`
 *   to those columns, unchanged, in the same UPDATE that persists the
 *   `perf_*` block). Reusing the resolver, not reimplementing its rules, is
 *   what keeps this a single canonical derivation.
 * - `reach.state`: reconstructed from the stored `perf_reach_value` alone
 *   (never `HIDDEN` — see `reachStateFromStoredValue`'s doc for why that's
 *   provably safe, not a guess).
 *
 * `tier3` (`reachPerFollower`) is likewise NOT a stored column — it is
 * recomputed by calling `ratios.ts`'s own `computeReachPerFollower` over
 * the stored `perf_reach_value` and `follower_count`, the same pure
 * function `computeBlock.ts` calls at write time.
 */

export interface PerformanceBlockRow {
  platform: Platform;
  likeCount: number | null;
  commentCount: number | null;
  likeAndViewCountsDisabled: boolean | null;
  followerCount: number | null;
  audienceSourceFetchedAt: string | null;
  /** The analysis row's own `created_at` — the timestamp this audience snapshot was captured for this analysis (distinct from `audienceSourceFetchedAt`, which is the PROFILE cache's own staleness). */
  createdAt: string;
  perfReachValue: number | null;
  perfReachKind: ReachKind | null;
  perfReachDerivedFrom: ReachDerivedFrom | null;
  perfTier1Ratio: number | null;
  perfTier1Denominator: Denominator | null;
  perfBucketKey: string | null;
  perfBaselineMedian: number | null;
  perfBaselineSampleSize: number | null;
  perfMultiplier: number | null;
  perfPostAgeHours: number | null;
  perfTierUsed: Tier | null;
  perfConfidence: Confidence | null;
  perfConfidenceReason: ConfidenceReason | null;
  perfProvisional: boolean | null;
  perfUnavailableReason: UnavailableReason | null;
}

export interface PerformanceTier2 {
  /** `null` at Tier 2 cold start (`BaselineResult.state === "COLD_START"`) — no baseline exists yet. */
  median: number | null;
  /** Never null in practice — `computeBaseline` always resolves a count, even `0` (R-8.4.4/R-13.3.4). */
  sampleSize: number;
  bucketKey: string;
  /** `null` at cold start, or `NOT_COMPARABLE` (a full baseline exists but this post's own metric didn't resolve against it). */
  multiplier: number | null;
}

export interface PerformanceComputed {
  reach: { value: number | null; kind: ReachKind | null; derivedFrom: ReachDerivedFrom; state: AvailabilityState };
  likes: { value: number | null; state: AvailabilityState };
  comments: { value: number | null; state: AvailabilityState };
  audience: { value: number | null; capturedAt: string; sourceFetchedAt: string | null };
  postAgeHours: number | null;
  tier1: Tier1Ratio | null;
  tier2: PerformanceTier2 | null;
  tier3: Tier3Ratio | null;
  tierUsed: Tier;
  confidence: Confidence;
  confidenceReason: ConfidenceReason | null;
  provisional: boolean;
  unavailableReason: UnavailableReason | null;
}

/**
 * `ReachResult.state` reconstruction from the stored value ALONE.
 * Provably safe (not a guess) because `reach.ts`'s resolvers
 * (`resolveNodeReach`, `resolveInstagramReach`, `resolveYoutubeReach`)
 * never produce `state: "HIDDEN"` for reach — that state exists on
 * `AvailabilityState` for likes/comments (creator-disabled counts), but
 * reach itself has no such flag-driven hidden state anywhere in `reach.ts`.
 * So the three remaining states collapse deterministically onto the stored
 * value: present and positive is `AVAILABLE`, present and `0` is a
 * corroborated `ZERO` (R-4.3.1), and `null` is `UNKNOWN` — never `HIDDEN`.
 */
function reachStateFromStoredValue(value: number | null): AvailabilityState {
  if (value == null) {
    return "UNKNOWN";
  }
  return value > 0 ? "AVAILABLE" : "ZERO";
}

/** Re-derives `likeState`/`commentState` via the SAME `availability.ts` resolvers `computeBlock.ts` used at write time (TR-1). */
function resolveEngagementAvailability(row: PerformanceBlockRow) {
  if (row.platform === "youtube") {
    return {
      likes: resolveYoutubeLikeAvailability(row.likeCount),
      comments: resolveYoutubeCommentAvailability(row.commentCount),
    };
  }
  return {
    likes: resolveInstagramLikeAvailability({
      rawCount: row.likeCount,
      likeAndViewCountsDisabled: row.likeAndViewCountsDisabled,
    }),
    comments: resolveInstagramCommentAvailability(row.commentCount),
  };
}

function buildTier1Ratio(row: PerformanceBlockRow): Tier1Ratio | null {
  if (row.perfTier1Ratio == null || row.perfTier1Denominator == null) {
    return null;
  }
  if (row.perfTier1Denominator === "FOLLOWERS") {
    return { denominator: "FOLLOWERS", ratio: row.perfTier1Ratio };
  }
  // `denominator === "REACH"`: `resolveTier1Ratio`/`computeReachEngagementRatio`
  // only ever produce this variant when `reachKind` is a genuine, non-UNKNOWN
  // kind (ratios.ts's own guard) — so `perfReachKind` is expected non-null
  // here by construction. `"UNKNOWN"` is a defensive fallback only, never
  // reachable from a row this pipeline itself wrote.
  return { denominator: "REACH", ratio: row.perfTier1Ratio, reachKind: row.perfReachKind ?? "UNKNOWN" };
}

/**
 * `liveColdStartSampleSize` — ticket #206 (TDD §14.8a). Applied ONLY when
 * this row is cold start (`perfMultiplier == null`); a `MEASURED` row's
 * `sampleSize` is an operand of a stored multiplier and stays frozen,
 * unconditionally, regardless of what the caller passes in. `undefined`
 * (not injected by the caller) falls back to the stored column, exactly
 * the pre-#206 behaviour — this keeps every existing call site that
 * doesn't pass the new parameter unaffected.
 */
function buildTier2(row: PerformanceBlockRow, liveColdStartSampleSize?: number | null): PerformanceTier2 | null {
  if (row.perfBucketKey == null) {
    return null;
  }
  const isColdStart = row.perfMultiplier == null;
  const sampleSize =
    isColdStart && liveColdStartSampleSize != null
      ? liveColdStartSampleSize
      : // Never null in practice (see PerformanceTier2's doc) — `?? 0` is
        // defence-in-depth only, matching the posture the performance module
        // already takes elsewhere for facts that are "true by construction
        // upstream, guarded again here anyway".
        (row.perfBaselineSampleSize ?? 0);
  return {
    median: row.perfBaselineMedian,
    sampleSize,
    bucketKey: row.perfBucketKey,
    multiplier: row.perfMultiplier,
  };
}

/**
 * `performance` is `null` only for rows written before schema 3 (TDD §7) —
 * post-migration-012, none exist (that migration `DELETE`d every prior
 * row). Gated on `perfTierUsed` because every `perf_*` column is written
 * together, in the same `UPDATE`, in `pipeline/index.ts` — a `null`
 * `perfTierUsed` means that write never happened for this row.
 */
export function buildComputedPerformanceBlock(
  row: PerformanceBlockRow,
  liveColdStartSampleSize?: number | null,
): PerformanceComputed | null {
  if (row.perfTierUsed == null) {
    return null;
  }

  const { likes, comments } = resolveEngagementAvailability(row);
  const tier3 = computeReachPerFollower({ reachValue: row.perfReachValue, followerCount: row.followerCount });

  return {
    reach: {
      value: row.perfReachValue,
      kind: row.perfReachKind,
      derivedFrom: row.perfReachDerivedFrom ?? "NONE",
      state: reachStateFromStoredValue(row.perfReachValue),
    },
    likes,
    comments,
    audience: {
      value: row.followerCount,
      capturedAt: row.createdAt,
      sourceFetchedAt: row.audienceSourceFetchedAt,
    },
    postAgeHours: row.perfPostAgeHours,
    tier1: buildTier1Ratio(row),
    tier2: buildTier2(row, liveColdStartSampleSize),
    tier3,
    tierUsed: row.perfTierUsed,
    confidence: row.perfConfidence ?? "NONE",
    confidenceReason: row.perfConfidenceReason,
    provisional: row.perfProvisional ?? false,
    unavailableReason: row.perfUnavailableReason,
  };
}
