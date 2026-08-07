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
 * part is video, `'images_only'`/`'metadata_only'` iff not. Folding it into
 * the bucket key gives every bucket the single-denominator-by-construction
 * property the TDD claims — `instagram:carousel:full_video` never contains
 * an all-image-carousel row, and `instagram:carousel:images_only` never
 * contains a video-bearing one — WITHOUT touching `perf_reach_derived_from`
 * (whose `NONE` value is independently overloaded — all-image carousel vs.
 * image-first mixed carousel — and is explicitly out of scope for this
 * ticket per the dispatch). This also happens to explain the fifth
 * `bucketNoun()` value ("videos", `see below`): `media_type = 'post'` (a
 * single non-carousel post) splits into a video single post
 * (`analysis_mode = 'full_video'`) and an image single post. **Corrected
 * (post-review): a lone image post does NOT produce `analysis_mode =
 * 'images_only'`.** `resolveMediaParts()` returns an empty part array for a
 * single image ("a lone image post is not sent to Gemini as media"), so
 * `analysisMode` never leaves its `'metadata_only'` initial value —
 * `instagram:post:images_only` is unreachable; single image posts land in
 * `instagram:post:metadata_only`. `images_only` is reached only by
 * `carousel` (an all-image carousel). Both `'images_only'` and
 * `'metadata_only'` carry the same `ENGAGEMENT_COUNT` denominator (no video
 * part means no reach field, full stop) — the split between them exists for
 * `bucketNoun()`'s wording, not for the denominator, which only ever
 * depends on whether `analysisMode === 'full_video'` (see
 * `denominatorForBucket()` below).
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

const VALID_PLATFORMS: readonly Platform[] = ["instagram", "youtube"];
const VALID_MEDIA_TYPES: readonly MediaType[] = ["reel", "post", "carousel", "short"];
const VALID_ANALYSIS_MODES: readonly AnalysisMode[] = [
  "full_video",
  "images_only",
  "metadata_only",
];

/**
 * `analysis_mode` is `TEXT` with no `NOT NULL` (migrations/012:93) and
 * `pipeline/index.ts:84` explicitly resets it to `NULL` on the re-analysis
 * path. libsql types a DB row's column as `string | null`, and #142 will
 * read one of these three values off exactly such a row. Without this guard
 * a single `as AnalysisMode` cast turns a `NULL` into the silently
 * plausible bucket key `"instagram:reel:"` — a phantom bucket that pools
 * whatever else lost its `analysis_mode`. Fail loudly here instead, at
 * construction time, not downstream in a query result.
 */
export function computeBucketKey(
  platform: Platform,
  mediaType: MediaType,
  analysisMode: AnalysisMode,
): string {
  if (!VALID_PLATFORMS.includes(platform)) {
    throw new Error(`computeBucketKey: unrecognized or missing platform "${String(platform)}".`);
  }
  if (!VALID_MEDIA_TYPES.includes(mediaType)) {
    throw new Error(
      `computeBucketKey: unrecognized or missing mediaType "${String(mediaType)}".`,
    );
  }
  if (!VALID_ANALYSIS_MODES.includes(analysisMode)) {
    throw new Error(
      `computeBucketKey: unrecognized or missing analysisMode "${String(analysisMode)}" — ` +
        `analysis_mode is nullable in the schema and is reset to NULL on re-analysis ` +
        `(pipeline/index.ts:84); refusing to build a phantom bucket key from it.`,
    );
  }
  return [platform, mediaType, analysisMode].join(BUCKET_KEY_SEPARATOR);
}

/**
 * The denominator a bucket's candidates are measured against, derived from
 * the bucket key's `analysisMode` component alone (TDD §6: "the baseline
 * set is single-denominator by construction, because `perf_bucket_key`
 * encodes content kind and content kind determines the denominator").
 * `'full_video'` means at least one media part is video, which is exactly
 * when a reach field can exist at all (`reach.ts`'s `hasReachFields()`);
 * `'images_only'`/`'metadata_only'` both mean no video part, hence no reach
 * field, hence `ENGAGEMENT_COUNT` (see the module doc above).
 *
 * **This must be the sole source of a candidate's denominator — never
 * row-level nullness.** A reach-denominated post whose reach happens to be
 * unresolvable (hidden play/view counts) is still reach-denominated; it is
 * not thereby engagement-denominated. `metricFor()` below excludes such a
 * row instead of relabelling it.
 */
export function denominatorForBucket(bucketKey: string): BaselineDenominator {
  const parts = bucketKey.split(BUCKET_KEY_SEPARATOR);
  const [platform, mediaType, analysisMode] = parts;
  if (
    parts.length !== 3 ||
    !VALID_PLATFORMS.includes(platform as Platform) ||
    !VALID_MEDIA_TYPES.includes(mediaType as MediaType) ||
    !VALID_ANALYSIS_MODES.includes(analysisMode as AnalysisMode)
  ) {
    throw new Error(
      `denominatorForBucket: malformed bucket key "${bucketKey}" — expected ` +
        `"platform:mediaType:analysisMode" with recognized segments; refusing to guess a denominator.`,
    );
  }
  return analysisMode === "full_video" ? "REACH" : "ENGAGEMENT_COUNT";
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
 * **Deliberately NOT `ratios.ts`'s `usableCount`, and must not be merged
 * with it (ticket #140 is already merged and out of scope).** `ratios.ts`
 * answers "what is this post's engagement total", where a hidden count
 * legitimately contributes 0 to a sum. This module asks a different
 * question — "does this post qualify as a Tier 2 comparator at all" — and
 * a post with no usable counts does not qualify. Scoring it `0` would make
 * it a valid sample worth zero engagement: it inflates `sampleSize` toward
 * `BASELINE_MIN_SAMPLE` *and* drags the median down, which inflates every
 * multiplier computed against the bucket (the "reads 3.2× when the truth
 * is 1.3×" failure). So: `null`/`undefined` disqualifies the candidate
 * (`null`), a negative value is the OR-20 unavailability sentinel and also
 * disqualifies it, and only a genuine non-negative number counts.
 */
function usableEngagementCount(value: number | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  if (value < 0) {
    return null;
  }
  return value;
}

/**
 * Which axis a single post's Tier 2 comparison falls on (PRD §3.3 / §12.4).
 * The denominator is NOT inferred from row-level nullness — it is fixed by
 * the bucket (`denominatorForBucket()`), because content kind determines
 * the denominator by construction (TDD §6). A `REACH` bucket's post with an
 * unresolved reach value (hidden play/view counts on a reel, e.g.) is
 * excluded (`null`), never relabelled `ENGAGEMENT_COUNT` — that reel is
 * still reach-denominated, it just isn't a usable comparator this round. An
 * `ENGAGEMENT_COUNT` bucket's post with no usable likes/comments (a
 * disabled-counts image carousel) is excluded the same way, not scored `0`.
 */
function metricFor(
  denominator: BaselineDenominator,
  post: BaselinePostMetrics,
): BaselineMetric | null {
  if (denominator === "REACH") {
    if (post.reachValue != null && post.reachValue >= 0) {
      return { denominator: "REACH", value: post.reachValue };
    }
    return null;
  }

  const likes = usableEngagementCount(post.likeCount);
  const comments = usableEngagementCount(post.commentCount);
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
 * throws rather than averaging. Post-fix, every candidate and the current
 * post are classified against the same bucket-derived denominator
 * (`denominatorForBucket(input.bucketKey)`), so this guard cannot fire
 * through a correct call path — it is kept as the same defence-in-depth
 * assertion `ratios.ts`'s negative-count guard takes for a fact that is
 * "true by construction upstream, guarded again here anyway" (module doc).
 */
export async function computeBaseline(input: ComputeBaselineInput): Promise<BaselineResult> {
  const denominator = denominatorForBucket(input.bucketKey);

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
      metricFor(denominator, {
        reachValue: row.perf_reach_value == null ? null : Number(row.perf_reach_value),
        likeCount: row.like_count == null ? null : Number(row.like_count),
        commentCount: row.comment_count == null ? null : Number(row.comment_count),
      }),
    )
    .filter((metric): metric is BaselineMetric => metric !== null);

  const currentMetric = metricFor(denominator, input.currentPost);

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
    return {
      state: "COLD_START",
      bucketKey: input.bucketKey,
      sampleSize,
    };
  }

  const medianValue = median(candidateMetrics.map((m) => m.value));

  // Priority order matches the type doc (types.ts `BaselineResult`):
  // this post's own unresolved metric is checked before median-zero,
  // because an unresolved numerator can't be multiplied regardless of
  // what the median is.
  if (!currentMetric) {
    return {
      state: "NOT_COMPARABLE",
      bucketKey: input.bucketKey,
      sampleSize,
      median: medianValue,
      reason: "POST_METRIC_UNRESOLVED",
    };
  }

  // Non-negative-metric invariant: this collapse into NOT_COMPARABLE/
  // MEDIAN_ZERO (rather than a division) is only correct because every
  // metric value flowing into `median()` is non-negative by construction —
  // `metricFor()`'s REACH branch requires `post.reachValue >= 0`, and its
  // ENGAGEMENT_COUNT branch only accepts values `usableEngagementCount()`
  // has already rejected below zero. Given that, `medianValue === 0` can
  // only mean "every comparator scored exactly zero", never "the bucket
  // skews negative" — so `!currentMetric` (checked above) and
  // `medianValue === 0` (checked here) are jointly exhaustive of the
  // "no multiplier" cases; anything else falls through to a real division.
  // If a metric were ever allowed to go negative, this guard would stop
  // being equivalent to "can't multiply" and this branch would instead let
  // a genuinely negative `multiplier` fall through as MEASURED, silently.
  if (medianValue === 0) {
    return {
      state: "NOT_COMPARABLE",
      bucketKey: input.bucketKey,
      sampleSize,
      median: medianValue,
      reason: "MEDIAN_ZERO",
    };
  }

  return {
    state: "MEASURED",
    bucketKey: input.bucketKey,
    sampleSize,
    median: medianValue,
    multiplier: currentMetric.value / medianValue,
  };
}

export type { BaselineDenominator, BaselineResult } from "./types";
