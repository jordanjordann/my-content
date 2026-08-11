import { createClient } from "@libsql/client";

const databaseUrl = process.env.TURSO_DATABASE_URL ?? "file:./my-content.db";

export const db = createClient({
  url: databaseUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

/**
 * Preserves "unknown" end to end: a NULL column stays `null`, never
 * silently coerced to `false`. Only a stored `1` is `true`; anything else
 * that isn't NULL (i.e. `0`) is `false`. Mirrors
 * `toNullableBoolean` in `lib/server/profiles/repository.ts`.
 */
function toNullableBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value) === 1;
}

export async function getSetting(key: string) {
  const result = await db.execute({
    sql: "SELECT value FROM settings WHERE key = ? LIMIT 1",
    args: [key],
  });

  const row = result.rows[0];
  return typeof row?.value === "string" ? row.value : null;
}

export async function setSetting(key: string, value: string) {
  await db.execute({
    sql: `
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value
    `,
    args: [key, value],
  });
}

export async function deleteSettings(keys: string[]) {
  if (keys.length === 0) {
    return;
  }

  await db.execute({
    sql: `DELETE FROM settings WHERE key IN (${keys.map(() => "?").join(", ")})`,
    args: keys,
  });
}

// Analysis query helpers

/**
 * Ticket #144 (TDD §9.6, OR-8). 50 rows/page, fixed — not client-tunable
 * (the ticket's own wording: "server-side pagination, 50 rows/page").
 */
export const ANALYSES_PAGE_SIZE = 50;

/**
 * PR #196 review, B4 — bridge cap for the OLD `/app/analyses` page
 * (`AnalysesContent.tsx`), whose client-side filters need the full corpus,
 * not one server-paginated page. `getAnalysesList({ pageSize })` accepts an
 * explicit override up to this cap so that page can request "all rows in
 * one response" without removing the `ANALYSES_PAGE_SIZE`-per-page default
 * #144 built (and #145's server-side-filtered 3C table still relies on).
 * Once #145 replaces the old page, its call site (and this constant) goes
 * away — do NOT reach for a large `pageSize` in new code.
 */
export const ANALYSES_MAX_PAGE_SIZE = 5000;

/**
 * Ticket #144 — the sortable fields (TDD §9.6): creator, posted, reach,
 * content score, performance score, multiplier, and each engagement
 * column separately (reach-denominated / follower-denominated Tier 1
 * ratio, DESIGN-3C §9.1 columns 8/9).
 */
export type AnalysesSortField =
  | "creator"
  | "posted"
  | "reach"
  | "contentScore"
  | "performanceScore"
  | "multiplier"
  | "engagementReach"
  | "engagementFollowers";

export type SortDirection = "asc" | "desc";

/**
 * SQL expression per sortable field. `contentScore` reads `overallScore`
 * out of `result_content` via `json_extract` — a SERVER-side SQL sort, not
 * the client-side `json_extract` sort the ticket rules out; `performanceScore`
 * is the promoted column (#139) specifically because THAT sort could not be
 * done this way at 3A's row volume. The two engagement columns select the
 * Tier 1 ratio only when its stored denominator matches — the other
 * denominator's rows sort as absent (R-S1), never as a mismatched value.
 */
const SORT_COLUMN_EXPRESSIONS: Record<AnalysesSortField, string> = {
  creator: "a.username",
  posted: "a.post_date",
  reach: "a.perf_reach_value",
  contentScore: "json_extract(a.result_content, '$.overallScore')",
  performanceScore: "a.performance_score",
  multiplier: "a.perf_multiplier",
  engagementReach: "(CASE WHEN a.perf_tier1_denominator = 'REACH' THEN a.perf_tier1_ratio END)",
  engagementFollowers: "(CASE WHEN a.perf_tier1_denominator = 'FOLLOWERS' THEN a.perf_tier1_ratio END)",
};

export interface GetAnalysesListParams {
  /** 1-based. Defaults to 1, clamped to >= 1. */
  page?: number;
  /** Defaults to `"posted"` — OR-8: newest first, never performance by default. */
  sortBy?: AnalysesSortField;
  /** Defaults to `"desc"`. */
  sortDir?: SortDirection;
  /**
   * Defaults to `ANALYSES_PAGE_SIZE` (50). B4 bridge — an explicit override,
   * clamped to `[1, ANALYSES_MAX_PAGE_SIZE]`, lets a caller request a
   * larger single response (e.g. the OLD `/app/analyses` page's "fetch all"
   * mode) without disturbing the default page size #145's server-paginated
   * table depends on.
   */
  pageSize?: number;
}

/**
 * R-S1/AC-14: absent values in the sort column ALWAYS sink to the bottom,
 * in BOTH directions — an unscored/unmeasured row must never be ordered as
 * if it were `0`. The standard SQLite idiom: a leading `col IS NULL`
 * ascending key groups every non-null row first regardless of the
 * requested direction (0 sorts before 1), then the requested direction
 * only orders WITHIN the non-null group. `a.id` is a final tiebreaker so
 * ordering (and therefore pagination) is stable across pages even when the
 * sort column has duplicate values.
 */
function buildOrderByClause(sortBy: AnalysesSortField, sortDir: SortDirection): string {
  // Runtime guard (PR #196 review, N1): the route already allow-lists `sortBy` against
  // `SORT_FIELDS` and 400s on anything else, but this DB layer must not depend on that —
  // a future caller that bypasses the route, or an `as`-widened value, must not reach an
  // unchecked property lookup. `hasOwnProperty`, not `in`, so `"constructor"` cannot pass.
  if (!Object.prototype.hasOwnProperty.call(SORT_COLUMN_EXPRESSIONS, sortBy)) {
    throw new Error(`Invalid sort field: ${String(sortBy)}`);
  }
  const column = SORT_COLUMN_EXPRESSIONS[sortBy];
  const direction = sortDir === "asc" ? "ASC" : "DESC";
  return `ORDER BY ${column} IS NULL ASC, ${column} ${direction}, a.id ASC`;
}

export async function getAnalysesList(params: GetAnalysesListParams = {}) {
  const page = params.page != null && params.page >= 1 ? Math.floor(params.page) : 1;
  const sortBy = params.sortBy ?? "posted";
  const sortDir = params.sortDir ?? "desc";
  const pageSize =
    params.pageSize != null && params.pageSize >= 1
      ? Math.min(Math.floor(params.pageSize), ANALYSES_MAX_PAGE_SIZE)
      : ANALYSES_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const [listResult, countResult] = await Promise.all([
    db.execute({
      sql: `
        SELECT
          a.id,
          a.prompt,
          a.status,
          a.title,
          a.url,
          a.platform,
          a.media_type,
          a.username,
          a.thumbnail_url,
          a.view_count,
          a.play_count,
          a.like_count,
          a.comment_count,
          a.like_and_view_counts_disabled,
          a.post_date,
          a.caption,
          a.duration_sec,
          a.result_content,
          a.schema_version,
          a.created_at,
          a.updated_at,
          a.follower_count,
          a.perf_reach_value,
          a.perf_reach_kind,
          a.perf_reach_derived_from,
          a.perf_tier1_ratio,
          a.perf_tier1_denominator,
          a.perf_bucket_key,
          a.perf_baseline_median,
          a.perf_baseline_sample_size,
          a.perf_multiplier,
          a.perf_post_age_hours,
          a.audience_source_fetched_at,
          a.perf_tier_used,
          a.perf_confidence,
          a.perf_confidence_reason,
          a.perf_provisional,
          a.perf_unavailable_reason,
          a.performance_score
        FROM analyses a
        ${buildOrderByClause(sortBy, sortDir)}
        LIMIT ? OFFSET ?
      `,
      args: [pageSize, offset],
    }),
    db.execute({ sql: "SELECT COUNT(*) as count FROM analyses", args: [] }),
  ]);

  const total = Number(countResult.rows[0]?.count ?? 0);

  const analyses = listResult.rows.map((row) => ({
    id: row.id as string,
    prompt: (row.prompt as string) ?? null,
    status: row.status as string,
    title: (row.title as string) ?? null,
    url: row.url as string,
    platform: row.platform as string,
    mediaType: row.media_type as string,
    username: row.username as string,
    thumbnailUrl: (row.thumbnail_url as string) ?? null,
    viewCount: row.view_count == null ? null : Number(row.view_count),
    playCount: row.play_count == null ? null : Number(row.play_count),
    likeCount: row.like_count == null ? null : Number(row.like_count),
    commentCount: row.comment_count == null ? null : Number(row.comment_count),
    likeAndViewCountsDisabled: toNullableBoolean(row.like_and_view_counts_disabled),
    postDate: (row.post_date as string) ?? null,
    caption: (row.caption as string) ?? null,
    durationSec: row.duration_sec == null ? null : Number(row.duration_sec),
    resultContent: (row.result_content as string) ?? null,
    schemaVersion: row.schema_version == null ? null : Number(row.schema_version),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    followerCount: row.follower_count == null ? null : Number(row.follower_count),
    perfReachValue: row.perf_reach_value == null ? null : Number(row.perf_reach_value),
    perfReachKind: (row.perf_reach_kind as string) ?? null,
    perfReachDerivedFrom: (row.perf_reach_derived_from as string) ?? null,
    perfTier1Ratio: row.perf_tier1_ratio == null ? null : Number(row.perf_tier1_ratio),
    perfTier1Denominator: (row.perf_tier1_denominator as string) ?? null,
    perfBucketKey: (row.perf_bucket_key as string) ?? null,
    perfBaselineMedian: row.perf_baseline_median == null ? null : Number(row.perf_baseline_median),
    perfBaselineSampleSize:
      row.perf_baseline_sample_size == null ? null : Number(row.perf_baseline_sample_size),
    perfMultiplier: row.perf_multiplier == null ? null : Number(row.perf_multiplier),
    perfPostAgeHours: row.perf_post_age_hours == null ? null : Number(row.perf_post_age_hours),
    audienceSourceFetchedAt: (row.audience_source_fetched_at as string) ?? null,
    perfTierUsed: (row.perf_tier_used as string) ?? null,
    perfConfidence: (row.perf_confidence as string) ?? null,
    perfConfidenceReason: (row.perf_confidence_reason as string) ?? null,
    perfProvisional: toNullableBoolean(row.perf_provisional),
    perfUnavailableReason: (row.perf_unavailable_reason as string) ?? null,
    performanceScore: row.performance_score == null ? null : Number(row.performance_score),
  }));

  return {
    analyses,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getUniqueAccounts() {
  const result = await db.execute({
    sql: "SELECT DISTINCT username FROM analyses WHERE username IS NOT NULL ORDER BY username",
    args: [],
  });

  return result.rows.map((row) => row.username as string);
}

export async function getAnalysisDetail(analysisId: string) {
  const analysisResult = await db.execute({
    sql: `
      SELECT id, prompt, status, title, url, platform, media_type, username,
             thumbnail_url, view_count, play_count, like_count, comment_count,
             like_and_view_counts_disabled, post_date, caption, duration_sec,
             result_content, schema_version, created_at,
             follower_count, perf_reach_value, perf_reach_kind,
             perf_reach_derived_from, perf_tier1_ratio, perf_tier1_denominator,
             perf_bucket_key, perf_baseline_median, perf_baseline_sample_size,
             perf_multiplier, perf_post_age_hours, audience_source_fetched_at,
             perf_tier_used, perf_confidence, perf_confidence_reason,
             perf_provisional, perf_unavailable_reason, performance_score
      FROM analyses
      WHERE id = ?
      LIMIT 1
    `,
    args: [analysisId],
  });

  const analysisRow = analysisResult.rows[0];
  if (!analysisRow) {
    return null;
  }

  return {
    id: analysisRow.id as string,
    prompt: (analysisRow.prompt as string) ?? null,
    status: analysisRow.status as string,
    title: (analysisRow.title as string) ?? null,
    url: analysisRow.url as string,
    platform: analysisRow.platform as string,
    mediaType: analysisRow.media_type as string,
    username: analysisRow.username as string,
    thumbnailUrl: (analysisRow.thumbnail_url as string) ?? null,
    viewCount: analysisRow.view_count == null ? null : Number(analysisRow.view_count),
    playCount: analysisRow.play_count == null ? null : Number(analysisRow.play_count),
    likeCount: analysisRow.like_count == null ? null : Number(analysisRow.like_count),
    commentCount: analysisRow.comment_count == null ? null : Number(analysisRow.comment_count),
    likeAndViewCountsDisabled: toNullableBoolean(analysisRow.like_and_view_counts_disabled),
    postDate: (analysisRow.post_date as string) ?? null,
    caption: (analysisRow.caption as string) ?? null,
    durationSec: analysisRow.duration_sec == null ? null : Number(analysisRow.duration_sec),
    resultContent: (analysisRow.result_content as string) ?? null,
    schemaVersion: analysisRow.schema_version == null ? null : Number(analysisRow.schema_version),
    createdAt: analysisRow.created_at as string,
    followerCount: analysisRow.follower_count == null ? null : Number(analysisRow.follower_count),
    perfReachValue: analysisRow.perf_reach_value == null ? null : Number(analysisRow.perf_reach_value),
    perfReachKind: (analysisRow.perf_reach_kind as string) ?? null,
    perfReachDerivedFrom: (analysisRow.perf_reach_derived_from as string) ?? null,
    perfTier1Ratio: analysisRow.perf_tier1_ratio == null ? null : Number(analysisRow.perf_tier1_ratio),
    perfTier1Denominator: (analysisRow.perf_tier1_denominator as string) ?? null,
    perfBucketKey: (analysisRow.perf_bucket_key as string) ?? null,
    perfBaselineMedian:
      analysisRow.perf_baseline_median == null ? null : Number(analysisRow.perf_baseline_median),
    perfBaselineSampleSize:
      analysisRow.perf_baseline_sample_size == null ? null : Number(analysisRow.perf_baseline_sample_size),
    perfMultiplier: analysisRow.perf_multiplier == null ? null : Number(analysisRow.perf_multiplier),
    perfPostAgeHours:
      analysisRow.perf_post_age_hours == null ? null : Number(analysisRow.perf_post_age_hours),
    audienceSourceFetchedAt: (analysisRow.audience_source_fetched_at as string) ?? null,
    perfTierUsed: (analysisRow.perf_tier_used as string) ?? null,
    perfConfidence: (analysisRow.perf_confidence as string) ?? null,
    perfConfidenceReason: (analysisRow.perf_confidence_reason as string) ?? null,
    perfProvisional: toNullableBoolean(analysisRow.perf_provisional),
    perfUnavailableReason: (analysisRow.perf_unavailable_reason as string) ?? null,
    performanceScore:
      analysisRow.performance_score == null ? null : Number(analysisRow.performance_score),
  };
}

export async function deleteAnalysis(analysisId: string) {
  await db.execute({
    sql: "DELETE FROM analyses WHERE id = ?",
    args: [analysisId],
  });
}
