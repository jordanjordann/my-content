import { NextResponse } from "next/server";

import {
  getAnalysesList,
  getUniqueAccounts,
  deleteAnalysis,
  ANALYSES_MAX_PAGE_SIZE,
} from "@/lib/server/db";
import { isAuthenticated } from "@/lib/server/auth";
import {
  buildComputedPerformanceBlock,
  candidatePoolKey,
  fetchLiveEligibleComparatorIds,
  MATURITY_FLOOR_HOURS,
  type CandidatePoolKey,
  type LiveComparator,
  type PerformanceBlockRow,
} from "@/lib/server/analysis/performance";
import type { AnalysisPerformance, ContentAnalysis } from "@/lib/api/analyses/types";

export const runtime = "nodejs";

function parsePage(raw: string | null): number | null {
  if (raw == null) {
    return 1;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

/**
 * B4 (PR #196 review) — optional override of the server default page size
 * (`ANALYSES_PAGE_SIZE`), clamped to `[1, ANALYSES_MAX_PAGE_SIZE]` at the DB
 * layer. Used by the OLD `/app/analyses` page's "fetch all" bridge; #145's
 * server-paginated 3C table leaves this unset and gets the 50/page default.
 */
function parsePageSize(raw: string | null): number | null | undefined {
  if (raw == null) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= ANALYSES_MAX_PAGE_SIZE
    ? parsed
    : null;
}

/**
 * Lifts the model-output fields out of `result_content` (ticket #144, step
 * 2) exactly the way `overallScore`/`scorecard` already are — `api.ts`/the
 * route never re-derives them, only parses the JSON that was already
 * stored verbatim.
 */
function parseResultContent(resultContent: string | null): Partial<ContentAnalysis> {
  if (!resultContent) {
    return {};
  }
  try {
    return JSON.parse(resultContent) as Partial<ContentAnalysis>;
  } catch {
    return {};
  }
}

function buildPerformance(
  row: PerformanceBlockRow,
  resultContent: string | null,
  livePool?: LiveComparator[] | null,
): AnalysisPerformance {
  const computed = buildComputedPerformanceBlock(row, livePool);
  if (computed == null) {
    return null;
  }
  const parsed = parseResultContent(resultContent);
  const performance = (parsed as { performance?: { performanceScore: number | null; verdict: string; drivers: string[] } })
    .performance;
  return {
    computed,
    judgement: {
      performanceScore: performance?.performanceScore ?? null,
      // B3: `null` means no judgement exists (e.g. no `performance` block in
      // `result_content`) — never fabricate an empty string for that case.
      verdict: performance?.verdict ?? null,
      drivers: performance?.drivers ?? [],
    },
  };
}

export async function GET(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parsePage(searchParams.get("page"));
    const pageSize = parsePageSize(searchParams.get("pageSize"));

    if (page == null) {
      return NextResponse.json({ error: "Invalid 'page' query parameter." }, { status: 400 });
    }
    if (pageSize === null) {
      return NextResponse.json(
        { error: `Invalid 'pageSize' query parameter — must be an integer between 1 and ${ANALYSES_MAX_PAGE_SIZE}.` },
        { status: 400 },
      );
    }

    // Sorting was removed by owner ruling (#266, 2026-08-20) — the order is always
    // `a.updated_at DESC` (see `lib/server/db.ts`'s `getAnalysesList`). Any `sortBy`/
    // `sortDir` query params a caller still sends are simply ignored, not rejected.
    const [{ analyses, pagination }, accounts] = await Promise.all([
      getAnalysesList({ page, pageSize }),
      getUniqueAccounts(),
    ]);

    // Ticket #206 (D1/D3), extended live by ticket #252 — the server read
    // path fetches every eligible live comparator (id + classified metric
    // value), once per request, batched across the whole page.
    // `readModel.ts` stays pure; the I/O happens here and the pool is
    // handed in per row below, where `buildTier2()` decides whether it's
    // needed at all (a `MEASURED`/frozen row never touches it) and derives
    // both the live sample size AND, new in #252, the live multiplier/
    // median from it. D3's second guard: skip the extra query entirely
    // when the page has no `perf_multiplier IS NULL` rows to begin with.
    const nullMultiplierPools: CandidatePoolKey[] = [];
    for (const analysis of analyses) {
      if (
        analysis.perfBucketKey != null &&
        analysis.perfMultiplier == null &&
        analysis.profileId != null &&
        analysis.schemaVersion != null
      ) {
        nullMultiplierPools.push({
          profileId: analysis.profileId,
          bucketKey: analysis.perfBucketKey,
          schemaVersion: analysis.schemaVersion,
        });
      }
    }
    const liveComparators =
      nullMultiplierPools.length > 0
        ? await fetchLiveEligibleComparatorIds(nullMultiplierPools, MATURITY_FLOOR_HOURS)
        : new Map<string, LiveComparator[]>();

    const analysesWithDetails = analyses.map((analysis) => {
      const parsed = parseResultContent(analysis.resultContent);
      const overallScore: number | null = typeof parsed.overallScore === "number" ? parsed.overallScore : null;
      const scorecard: ContentAnalysis["scorecard"] | null = parsed.scorecard ?? null;
      // Ticket #149 — lifted the same way `overallScore`/`scorecard` already are. `resultContent`
      // is already fetched and parsed above for those two fields; `style` costs nothing extra.
      const style: ContentAnalysis["style"] | null = parsed.style ?? null;

      // This row's own live pool, still including "self" if this row itself
      // is an eligible comparator for its own pool (D3 has no per-row
      // notion of "self" across a batched query) — `readModel.ts`'s
      // `buildTier2()` is the one place self-exclusion happens, ticket #252.
      let livePool: LiveComparator[] | null = null;
      if (
        analysis.perfBucketKey != null &&
        analysis.perfMultiplier == null &&
        analysis.profileId != null &&
        analysis.schemaVersion != null
      ) {
        livePool =
          liveComparators.get(
            candidatePoolKey({
              profileId: analysis.profileId,
              bucketKey: analysis.perfBucketKey,
              schemaVersion: analysis.schemaVersion,
            }),
          ) ?? null;
      }

      return {
        id: analysis.id,
        prompt: analysis.prompt,
        status: analysis.status,
        url: analysis.url,
        platform: analysis.platform,
        mediaType: analysis.mediaType,
        username: analysis.username,
        overallScore,
        scorecard,
        style,
        // Lets the UI degrade gracefully on a version it doesn't know how
        // to render (TDD §3.3, §8.2) — null on rows that predate the
        // redesign (migration 007, no backfill).
        schemaVersion: analysis.schemaVersion,
        thumbnailUrl: analysis.thumbnailUrl,
        viewCount: analysis.viewCount,
        playCount: analysis.playCount,
        likeCount: analysis.likeCount,
        likeAndViewCountsDisabled: analysis.likeAndViewCountsDisabled,
        postDate: analysis.postDate,
        durationSec: analysis.durationSec,
        caption: analysis.caption,
        title: analysis.title,
        createdAt: analysis.createdAt,
        // Ticket #144 (TDD §7) — purely additive.
        performance: buildPerformance(
          {
            id: analysis.id,
            platform: analysis.platform as "instagram" | "youtube",
            likeCount: analysis.likeCount,
            commentCount: analysis.commentCount,
            likeAndViewCountsDisabled: analysis.likeAndViewCountsDisabled,
            followerCount: analysis.followerCount,
            audienceSourceFetchedAt: analysis.audienceSourceFetchedAt,
            createdAt: analysis.createdAt,
            perfReachValue: analysis.perfReachValue,
            perfReachKind: analysis.perfReachKind as PerformanceBlockRow["perfReachKind"],
            perfReachDerivedFrom: analysis.perfReachDerivedFrom as PerformanceBlockRow["perfReachDerivedFrom"],
            perfTier1Ratio: analysis.perfTier1Ratio,
            perfTier1Denominator: analysis.perfTier1Denominator as PerformanceBlockRow["perfTier1Denominator"],
            perfBucketKey: analysis.perfBucketKey,
            perfBaselineMedian: analysis.perfBaselineMedian,
            perfBaselineSampleSize: analysis.perfBaselineSampleSize,
            perfMultiplier: analysis.perfMultiplier,
            perfPostAgeHours: analysis.perfPostAgeHours,
            perfTierUsed: analysis.perfTierUsed as PerformanceBlockRow["perfTierUsed"],
            perfConfidence: analysis.perfConfidence as PerformanceBlockRow["perfConfidence"],
            perfConfidenceReason: analysis.perfConfidenceReason as PerformanceBlockRow["perfConfidenceReason"],
            perfProvisional: analysis.perfProvisional,
            perfUnavailableReason: analysis.perfUnavailableReason as PerformanceBlockRow["perfUnavailableReason"],
          },
          analysis.resultContent,
          livePool,
        ),
      };
    });

    return NextResponse.json({
      analyses: analysesWithDetails,
      accounts,
      pagination,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch analyses." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing analysis ID." }, { status: 400 });
    }

    // Ticket #312 (#281 audit P2): `deleteAnalysis` now inspects
    // `rowsAffected` instead of assuming success — a DELETE that matched no
    // row must not report `{ success: true }`.
    const { deleted } = await deleteAnalysis(id);
    if (!deleted) {
      return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete analysis." },
      { status: 500 },
    );
  }
}
