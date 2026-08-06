import { db } from "@/lib/server/db";
import type { Platform } from "@/lib/server/analysis/classifier/rules";
import { BASELINE_MIN_SAMPLE } from "./constants";
import type { BaselineDenominator, BaselineResult } from "./types";

/**
 * Tier 2 — the creator's own baseline (ticket #141, TDD §6, PRD §3.3 / §12.4).
 *
 * ## Bucket key: `(platform, content kind)`, D4 — and why it is more than `media_type`
 *
 * D4's own text says "(platform, content kind)"; PRD §4.2's input table
 * spells out what "content kind" IS: **`analysis_mode` + media type**, not
 * media type alone. That distinction is load-bearing, not decorative:
 * `media_type = 'carousel'` covers BOTH a video-bearing carousel (reach
 * resolved from the first slide, TOP_LEVEL-adjacent, R-4.3.2's `REACH`
 * side) and an all-image carousel (no reach field exists at all, PRD §12 —
 * `ENGAGEMENT_COUNT` side). Bucketing on `media_type` alone would silently
 * pool those two into one "carousel" baseline for any creator who posts
 * both kinds — precisely the cross-denominator average R-4.3.2/R-12.3.2
 * forbid, and it would do so on the *normal*, expected path, not a rare
 * corruption.
 *
 * `analysis_mode` (`lib/server/analysis/pipeline/index.ts`, ticket #71)
 * already resolves this for free: `'full_video'` iff at least one media
 * part is video, `'images_only'` iff not. Folding it into the bucket key
 * gives every bucket the single-denominator-by-construction property the
 * TDD claims — `instagram:carousel:full_video` never contains an
 * all-image-carousel row, and `instagram:carousel:images_only` never
 * contains a video-bearing one — WITHOUT touching `perf_reach_derived_from`
 * (whose `NONE` value is independently overloaded — all-image carousel vs.
 * image-first mixed carousel — and is explicitly out of scope for this
 * ticket per the dispatch). This also happens to explain the fifth
 * `bucketNoun()` value ("videos", `see below`): `media_type = 'post'` (a
 * single non-carousel post) splits into a video single post
 * (`analysis_mode = 'full_video'`) and an image single post
 * (`'images_only'`), which read differently to a reader ("6 videos" vs.
 * "6 posts").
 *
 * `computeBaseline()` still asserts single-denominator on the fetched
 * candidate set (TDD §6 step 4) as defence-in-depth — the same posture
 * `ratios.ts`'s negative-count guard already takes for a fact that is
 * "true by construction upstream, guarded again here anyway."
 *
 * ## What Tier 2 actually compares (PRD §3.3 / §12.4)
 *
 * Not the Tier 1 ratio. A post with resolved reach compares its own
 * `perf_reach_value` against the bucket's median `perf_reach_value`
 * ("3.2× typical reach"). A post with no reach (§12.4 — image carousels,
 * single images) compares `likes + comments` against the bucket's median
 * `likes + comments` ("1.8× typical likes+comments") — reach never enters
 * that computation (AC-23). `perf_tier1_ratio` is still selected, exactly
 * as the TDD's §6 query specifies, for parity with the documented query
 * shape and any future consumer; `computeBaseline()` itself does not read
 * it.
 */

/** Mirrors `MediaMetadata.mediaType` / `classifier/rules.ts`'s `MediaType`. */
export type MediaType = "reel" | "post" | "carousel" | "short";

/**
 * Mirrors `lib/server/analysis/pipeline/index.ts`'s inline `analysisMode`
 * union (ticket #71) — not exported there, so re-declared here rather than
 * introducing a cross-module coupling to a pipeline-internal local.
 */
export type AnalysisMode = "full_video" | "images_only" | "metadata_only";

const BUCKET_KEY_SEPARATOR = ":";

/** `(platform, content kind)` per D4 — content kind = media type + analysis mode (PRD §4.2). */
export function computeBucketKey(
  platform: Platform,
  mediaType: MediaType,
  analysisMode: AnalysisMode,
): string {
  return [platform, mediaType, analysisMode].join(BUCKET_KEY_SEPARATOR);
}

/**
 * `bucketNoun()` (owner ruling OR-9). Copy renders `based on {N} {noun}` —
 * never the literal word "videos" for a bucket that is not one. Derived
 * from `perf_bucket_key` at render time (no new column). Unknown/malformed
 * keys fall through to the generic `"posts"`.
 */
export function bucketNoun(bucketKey: string): string {
  const [, mediaType, analysisMode] = bucketKey.split(BUCKET_KEY_SEPARATOR);

  if (mediaType === "reel") {
    return "reels";
  }
  if (mediaType === "carousel") {
    return "carousels";
  }
  if (mediaType === "short") {
    return "Shorts";
  }
  if (mediaType === "post" && analysisMode === "full_video") {
    return "videos";
  }
  return "posts";
}

interface BaselinePostMetrics {
  reachValue: number | null;
  likeCount: number | null;
  commentCount: number | null;
}

interface BaselineMetric {
  denominator: BaselineDenominator;
  value: number;
}

/**
 * OR-20 rule 3 discipline, same as `ratios.ts`'s `usableCount`: `null`/
 * `undefined` contributes 0, a negative value is an unavailability
 * sentinel and is never clamped — it makes the whole count unusable.
 */
function usableCount(value: number | null | undefined): number | null {
  if (value == null) {
    return 0;
  }
  if (value < 0) {
    return null;
  }
  return value;
}

/**
 * Which axis a single post's Tier 2 comparison falls on (PRD §3.3 / §12.4).
 * Reach, when resolved and non-negative, is always authoritative — no
 * content kind stores a `perf_reach_value` unless it genuinely has one
 * (R-4.3.2). Otherwise the metric is `likes + comments`; `null` means
 * neither is usable (hidden/negative-sentinel counts and no reach) and the
 * post cannot contribute to — or be measured against — a baseline.
 */
function metricFor(post: BaselinePostMetrics): BaselineMetric | null {
  if (post.reachValue != null && post.reachValue >= 0) {
    return { denominator: "REACH", value: post.reachValue };
  }

  const likes = usableCount(post.likeCount);
  const comments = usableCount(post.commentCount);
  if (likes === null || comments === null) {
    return null;
  }
  return { denominator: "ENGAGEMENT_COUNT", value: likes + comments };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export interface ComputeBaselineInput {
  profileId: string;
  bucketKey: string;
  schemaVersion: number;
  /** The analysis being scored — excluded from its own candidate pool. */
  excludeAnalysisId: string;
  /** D5 part 3 — a candidate below the maturity floor is not yet a trustworthy comparator. */
  minPostAgeHours: number;
  /** This post's own reach/likes/comments — the numerator of the multiplier. */
  currentPost: BaselinePostMetrics;
}

/**
 * Tier 2 baseline (TDD §6). One extra DB read (PRD §9.1), no transaction
 * (RUNBOOK / dispatch hazard note — `@libsql/client`'s local sqlite3
 * driver leaks a connection through `transaction()`; a single `SELECT` via
 * `db.execute()` sidesteps it entirely, same pattern as
 * `lib/server/fingerprint/repository.ts`'s `getCompletedV2Analyses`).
 *
 * Median is computed in JS (TDD §6) — these sets are tiny.
 *
 * **R-4.3.2 / R-12.3.2 enforcement lives here, as defence-in-depth on top
 * of the bucket key's own single-denominator-by-construction property
 * (see the module doc comment).** A mixed-denominator candidate set
 * throws rather than averaging.
 */
export async function computeBaseline(input: ComputeBaselineInput): Promise<BaselineResult> {
  const result = await db.execute({
    sql: `
      SELECT perf_tier1_ratio, perf_reach_value, like_count, comment_count
      FROM analyses
      WHERE profile_id = ? AND perf_bucket_key = ? AND status = 'completed'
        AND schema_version = ? AND id != ?
        AND perf_post_age_hours >= ?
    `,
    args: [
      input.profileId,
      input.bucketKey,
      input.schemaVersion,
      input.excludeAnalysisId,
      input.minPostAgeHours,
    ],
  });

  const candidateMetrics = result.rows
    .map((row): BaselineMetric | null =>
      metricFor({
        reachValue: row.perf_reach_value == null ? null : Number(row.perf_reach_value),
        likeCount: row.like_count == null ? null : Number(row.like_count),
        commentCount: row.comment_count == null ? null : Number(row.comment_count),
      }),
    )
    .filter((metric): metric is BaselineMetric => metric !== null);

  const currentMetric = metricFor(input.currentPost);

  const denominatorsSeen = new Set<BaselineDenominator>(candidateMetrics.map((m) => m.denominator));
  if (currentMetric) {
    denominatorsSeen.add(currentMetric.denominator);
  }
  if (denominatorsSeen.size > 1) {
    throw new Error(
      `Mixed-denominator Tier 2 baseline set for bucket "${input.bucketKey}": ` +
        `found ${[...denominatorsSeen].sort().join(" and ")} in the same candidate set. ` +
        `R-4.3.2/R-12.3.2 forbid averaging across denominators — this must never happen ` +
        `given the bucket key's single-denominator-by-construction property; refusing to average.`,
    );
  }

  const sampleSize = candidateMetrics.length;

  if (sampleSize < BASELINE_MIN_SAMPLE) {
    return { bucketKey: input.bucketKey, sampleSize, median: null, multiplier: null };
  }

  const medianValue = median(candidateMetrics.map((m) => m.value));
  const multiplier =
    currentMetric && medianValue > 0 ? currentMetric.value / medianValue : null;

  return { bucketKey: input.bucketKey, sampleSize, median: medianValue, multiplier };
}

export type { BaselineDenominator, BaselineResult } from "./types";
