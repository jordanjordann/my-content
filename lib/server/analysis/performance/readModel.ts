import type { Platform } from "@/lib/server/analysis/classifier/rules";
import {
  resolveInstagramCommentAvailability,
  resolveInstagramLikeAvailability,
  resolveYoutubeCommentAvailability,
  resolveYoutubeLikeAvailability,
} from "./availability";
import { denominatorForBucket, median as computeMedian, metricFor } from "./baseline";
import type { LiveComparator } from "./baseline";
import { BASELINE_MIN_SAMPLE } from "./constants";
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
 * gains an INJECTED `livePool` parameter, never an I/O call of its own. A
 * `MEASURED` row (stored `perf_multiplier` present) ignores it entirely and
 * is read verbatim off the row, frozen, exactly as D8 always described. The
 * live pool itself is fetched once per request, batched across the whole
 * page (D3), by the caller — `baseline.ts`'s `fetchLiveEligibleComparatorIds`
 * — and handed in here as a plain array of `{ id, value }` pairs. Do not
 * infer from this file alone that the RESPONSE is byte-stable across two
 * reads of an unchanged row: for a `perf_multiplier IS NULL` row it is not,
 * by design (§14.8a / ticket #252), because the caller may pass a
 * different `livePool` on the second call even though `row` itself hasn't
 * changed.
 *
 * **Ticket #252 (TDD §14.8a's LIVE extension) — the multiplier itself, not
 * just the cold-start count, is now derived live for any row whose stored
 * `perf_multiplier IS NULL`.** `buildTier2()` below emits an explicit
 * `state`/`reason` discriminator on `PerformanceTier2` so every consumer
 * (`deriveMultiplierCell`, the popover) reads ONE source of truth instead
 * of inferring state from `(multiplier, median)` nullness — a below-
 * threshold row with an unresolved own metric has both `null` yet is not
 * cold start, and a live-measured row has stored `multiplier == null` yet
 * is measured. See DESIGN-3C (`docs/design/DESIGN-3C-vs-their-usual-state-routing.md`)
 * §3 for the routing rule this function implements.
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
  /**
   * Ticket #252 — needed to self-exclude this row from its own live
   * comparator pool (`livePool` may legitimately contain this row's own
   * id — the batched query has no notion of "self" across many pools,
   * D3) before a median is taken. Not used for anything else in this file.
   */
  id: string;
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

/**
 * Ticket #252 (DESIGN-3C §3). The discriminator every `PerformanceTier2`
 * consumer must switch on — never re-derive from `(multiplier, median)`
 * nullness (that inference is exactly what broke down: a below-threshold
 * row with an unresolved own metric has both `null` yet is not cold start,
 * and a live-measured row has a stored `multiplier == null` yet is
 * measured).
 */
export type PerformanceTier2State = "MEASURED" | "NOT_COMPARABLE" | "COLD_START";

/** Mirrors `BaselineResult`'s `NOT_COMPARABLE` reasons (`types.ts`) — always present on that state, always `null` elsewhere. */
export type PerformanceTier2Reason = "POST_METRIC_UNRESOLVED" | "MEDIAN_ZERO";

export interface PerformanceTier2 {
  /** `null` at Tier 2 cold start, or `NOT_COMPARABLE`/`POST_METRIC_UNRESOLVED` below the live threshold — no median exists yet either way. */
  median: number | null;
  /** Never null in practice — `computeBaseline` always resolves a count, even `0` (R-8.4.4/R-13.3.4). */
  sampleSize: number;
  bucketKey: string;
  /** `null` unless `state === "MEASURED"`. */
  multiplier: number | null;
  /**
   * Ticket #260 — the server's own `BASELINE_MIN_SAMPLE` (`constants.ts`, default `5`,
   * env-overridable via `PERFORMANCE_BASELINE_MIN_SAMPLE`), carried per row so the client
   * never re-declares this threshold as a hardcoded, driftable duplicate constant (ticket
   * #260 deleted the old client-side copy of it). This is the single source of truth the
   * cold-start progress cell clamps its live `sampleSize` against.
   */
  minSample: number;
  /** Ticket #252 — see `PerformanceTier2State`'s doc. The single field every consumer switches on. */
  state: PerformanceTier2State;
  /** Non-null iff `state === "NOT_COMPARABLE"`. */
  reason: PerformanceTier2Reason | null;
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

/** `?? 0` is defence-in-depth only (never null in practice, R-8.4.4/R-13.3.4) — matches the posture the performance module already takes elsewhere for facts that are "true by construction upstream, guarded again here anyway". */
function frozenSampleSize(row: PerformanceBlockRow): number {
  return row.perfBaselineSampleSize ?? 0;
}

/** Ticket #252 — this row's id may legitimately be present in its own batched pool (D3 has no per-row notion of "self"); drop it before anything downstream counts or medians the pool. */
function excludeSelf(livePool: LiveComparator[] | null | undefined, id: string): LiveComparator[] {
  return (livePool ?? []).filter((comparator) => comparator.id !== id);
}

/**
 * Ticket #252 (DESIGN-3C §3) — the routing rule, implemented in the exact
 * order specified there (an extension of `computeBaseline()`'s own
 * precedence, own-metric-unresolved moved one step earlier, ahead of the
 * pool-size/cold-start check):
 *
 *   1. Stored multiplier present → `MEASURED`, frozen, untouched. The live
 *      pool is never even inspected.
 *   2. Own metric unresolved → `NOT_COMPARABLE` / `POST_METRIC_UNRESOLVED`,
 *      regardless of pool size.
 *   3. Pool ≥ threshold and median `=== 0` → `NOT_COMPARABLE` / `MEDIAN_ZERO`.
 *   4. Pool ≥ threshold → `MEASURED`, live multiplier.
 *   5. Else → `COLD_START`.
 *
 * A full baseline that already existed at WRITE time (`perfBaselineMedian
 * != null`, ticket #251's NOT_COMPARABLE carve-out) is reused verbatim
 * rather than re-derived live — that classification (own-metric-unresolved
 * or median-zero) can never change after the fact, because the post's own
 * reach/likes/comments are immutable stored columns, and the write path's
 * result on a genuinely completed baseline is what D8 already promises to
 * freeze. `livePool` is only consulted when `perfBaselineMedian == null` —
 * i.e. this row was still cold start the last time it was written — and
 * only for the sample-size leak fix (DESIGN-3C §4.3): the live count is
 * injected into `tier2.sampleSize` ONLY when the DERIVED state resolves to
 * `COLD_START`, never on a `NOT_COMPARABLE` row (own metric unresolved,
 * live pool below threshold) — that row "has no comparison at all", so no
 * surface (popover, future export, a11y label) should read a live-looking
 * count off it. Per constraint #4, no mixed-denominator `throw` is ported
 * here — this read path degrades to "no live multiplier" instead of 500ing
 * the list, because every candidate a pool can contain was already
 * classified against the bucket-derived denominator by
 * `fetchLiveEligibleComparatorIds()` (TR-1), so a mixed set cannot occur
 * through a correct call path in the first place.
 */
function buildTier2(row: PerformanceBlockRow, livePool?: LiveComparator[] | null): PerformanceTier2 | null {
  if (row.perfBucketKey == null) {
    return null;
  }

  // Step 1 — a stored multiplier is MEASURED forever. The live pool is
  // irrelevant; nothing below this branch may run for this row.
  if (row.perfMultiplier != null) {
    return {
      state: "MEASURED",
      reason: null,
      median: row.perfBaselineMedian,
      sampleSize: frozenSampleSize(row),
      bucketKey: row.perfBucketKey,
      multiplier: row.perfMultiplier,
      minSample: BASELINE_MIN_SAMPLE,
    };
  }

  const denominator = denominatorForBucket(row.perfBucketKey);
  const ownMetric = metricFor(denominator, {
    reachValue: row.perfReachValue,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
  });

  // A full baseline already existed at write time — reuse it verbatim
  // (ticket #251's frozen NOT_COMPARABLE carve-out). `ownMetric` here is
  // the SAME classification the write path made off the SAME immutable
  // stored columns, so it agrees with whichever reason was frozen then.
  if (row.perfBaselineMedian != null) {
    return {
      state: "NOT_COMPARABLE",
      reason: ownMetric == null ? "POST_METRIC_UNRESOLVED" : "MEDIAN_ZERO",
      median: row.perfBaselineMedian,
      sampleSize: frozenSampleSize(row),
      bucketKey: row.perfBucketKey,
      multiplier: null,
      minSample: BASELINE_MIN_SAMPLE,
    };
  }

  // From here: this row was cold start the last time it was written
  // (`perfBaselineMedian == null`). Its CURRENT state depends on the live
  // pool.

  // Step 2 — own metric unresolved wins regardless of pool size. No live
  // comparator count is injected here (DESIGN-3C §4.3): this row has no
  // comparison at all, so `sampleSize` stays the frozen (small/write-time)
  // column rather than a live-looking number.
  if (ownMetric == null) {
    return {
      state: "NOT_COMPARABLE",
      reason: "POST_METRIC_UNRESOLVED",
      median: null,
      sampleSize: frozenSampleSize(row),
      bucketKey: row.perfBucketKey,
      multiplier: null,
      minSample: BASELINE_MIN_SAMPLE,
    };
  }

  // No live pool was supplied at all (`undefined`/`null`, as opposed to a
  // genuinely fetched empty array) — degrade to the pre-#252/#206 default:
  // treat as cold start off the frozen (write-time) count. Every OTHER
  // outcome above needed no live pool; this is the only branch that
  // depends on a caller having actually fetched one.
  if (livePool == null) {
    return {
      state: "COLD_START",
      reason: null,
      median: null,
      sampleSize: frozenSampleSize(row),
      bucketKey: row.perfBucketKey,
      multiplier: null,
      minSample: BASELINE_MIN_SAMPLE,
    };
  }

  const comparators = excludeSelf(livePool, row.id);
  const poolSize = comparators.length;

  // Step 5 — below threshold, own metric resolved: unchanged cold start,
  // still the only state where the progress counter is honest. The live
  // count IS injected here — this is the pre-existing #206 mechanic,
  // unaffected by this ticket.
  if (poolSize < BASELINE_MIN_SAMPLE) {
    return {
      state: "COLD_START",
      reason: null,
      median: null,
      sampleSize: poolSize,
      bucketKey: row.perfBucketKey,
      multiplier: null,
      minSample: BASELINE_MIN_SAMPLE,
    };
  }

  const medianValue = computeMedian(comparators.map((comparator) => comparator.value));

  // Step 3 — pool ≥ threshold, median exactly zero: division is undefined,
  // not a fabricated 1x/0x.
  if (medianValue === 0) {
    return {
      state: "NOT_COMPARABLE",
      reason: "MEDIAN_ZERO",
      median: 0,
      sampleSize: poolSize,
      bucketKey: row.perfBucketKey,
      multiplier: null,
      minSample: BASELINE_MIN_SAMPLE,
    };
  }

  // Step 4 — a real live multiplier.
  return {
    state: "MEASURED",
    reason: null,
    median: medianValue,
    sampleSize: poolSize,
    bucketKey: row.perfBucketKey,
    multiplier: ownMetric.value / medianValue,
    minSample: BASELINE_MIN_SAMPLE,
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
  livePool?: LiveComparator[] | null,
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
    tier2: buildTier2(row, livePool),
    tier3,
    tierUsed: row.perfTierUsed,
    confidence: row.perfConfidence ?? "NONE",
    confidenceReason: row.perfConfidenceReason,
    provisional: row.perfProvisional ?? false,
    unavailableReason: row.perfUnavailableReason,
  };
}
