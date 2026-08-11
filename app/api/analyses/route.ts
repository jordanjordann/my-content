import { NextResponse } from "next/server";

import {
  getAnalysesList,
  getUniqueAccounts,
  deleteAnalysis,
  type AnalysesSortField,
  type SortDirection,
} from "@/lib/server/db";
import { isAuthenticated } from "@/lib/server/auth";
import { buildComputedPerformanceBlock, type PerformanceBlockRow } from "@/lib/server/analysis/performance";
import type { AnalysisPerformance, ContentAnalysis } from "@/lib/api/analyses/types";

export const runtime = "nodejs";

const SORT_FIELDS: readonly AnalysesSortField[] = [
  "creator",
  "posted",
  "reach",
  "contentScore",
  "performanceScore",
  "multiplier",
  "engagementReach",
  "engagementFollowers",
];

/** Strict input validation at the API boundary (role standard) — an invalid explicit value is rejected, never silently coerced to a default. */
function parseSortBy(raw: string | null): AnalysesSortField | null {
  if (raw == null) {
    return "posted";
  }
  return (SORT_FIELDS as readonly string[]).includes(raw) ? (raw as AnalysesSortField) : null;
}

function parseSortDir(raw: string | null): SortDirection | null {
  if (raw == null) {
    return "desc";
  }
  return raw === "asc" || raw === "desc" ? raw : null;
}

function parsePage(raw: string | null): number | null {
  if (raw == null) {
    return 1;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
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

function buildPerformance(row: PerformanceBlockRow, resultContent: string | null): AnalysisPerformance {
  const computed = buildComputedPerformanceBlock(row);
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
      verdict: performance?.verdict ?? "",
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
    const sortBy = parseSortBy(searchParams.get("sortBy"));
    const sortDir = parseSortDir(searchParams.get("sortDir"));

    if (page == null) {
      return NextResponse.json({ error: "Invalid 'page' query parameter." }, { status: 400 });
    }
    if (sortBy == null) {
      return NextResponse.json({ error: "Invalid 'sortBy' query parameter." }, { status: 400 });
    }
    if (sortDir == null) {
      return NextResponse.json({ error: "Invalid 'sortDir' query parameter." }, { status: 400 });
    }

    const [{ analyses, pagination }, accounts] = await Promise.all([
      getAnalysesList({ page, sortBy, sortDir }),
      getUniqueAccounts(),
    ]);

    const analysesWithDetails = analyses.map((analysis) => {
      const parsed = parseResultContent(analysis.resultContent);
      const overallScore: number | null = typeof parsed.overallScore === "number" ? parsed.overallScore : null;
      const scorecard: ContentAnalysis["scorecard"] | null = parsed.scorecard ?? null;

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

    await deleteAnalysis(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete analysis." },
      { status: 500 },
    );
  }
}
