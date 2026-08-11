import { NextResponse } from "next/server";

import { getAnalysisDetail } from "@/lib/server/db";
import { isAuthenticated } from "@/lib/server/auth";
import { buildComputedPerformanceBlock, type PerformanceBlockRow } from "@/lib/server/analysis/performance";
import type { AnalysisPerformance } from "@/lib/api/analyses/types";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const detail = await getAnalysisDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }

    let results: unknown = null;
    if (detail.resultContent) {
      try {
        results = JSON.parse(detail.resultContent);
      } catch {
        results = null;
      }
    }

    // Ticket #144 (TDD §7) — purely additive, verbatim same derivation as
    // `app/api/analyses/route.ts`'s list endpoint.
    const computed = buildComputedPerformanceBlock({
      platform: detail.platform as "instagram" | "youtube",
      likeCount: detail.likeCount,
      commentCount: detail.commentCount,
      likeAndViewCountsDisabled: detail.likeAndViewCountsDisabled,
      followerCount: detail.followerCount,
      audienceSourceFetchedAt: detail.audienceSourceFetchedAt,
      createdAt: detail.createdAt,
      perfReachValue: detail.perfReachValue,
      perfReachKind: detail.perfReachKind as PerformanceBlockRow["perfReachKind"],
      perfReachDerivedFrom: detail.perfReachDerivedFrom as PerformanceBlockRow["perfReachDerivedFrom"],
      perfTier1Ratio: detail.perfTier1Ratio,
      perfTier1Denominator: detail.perfTier1Denominator as PerformanceBlockRow["perfTier1Denominator"],
      perfBucketKey: detail.perfBucketKey,
      perfBaselineMedian: detail.perfBaselineMedian,
      perfBaselineSampleSize: detail.perfBaselineSampleSize,
      perfMultiplier: detail.perfMultiplier,
      perfPostAgeHours: detail.perfPostAgeHours,
      perfTierUsed: detail.perfTierUsed as PerformanceBlockRow["perfTierUsed"],
      perfConfidence: detail.perfConfidence as PerformanceBlockRow["perfConfidence"],
      perfConfidenceReason: detail.perfConfidenceReason as PerformanceBlockRow["perfConfidenceReason"],
      perfProvisional: detail.perfProvisional,
      perfUnavailableReason: detail.perfUnavailableReason as PerformanceBlockRow["perfUnavailableReason"],
    });

    const resultsPerformance = (results as { performance?: { performanceScore: number | null; verdict: string; drivers: string[] } } | null)
      ?.performance;

    const performance: AnalysisPerformance =
      computed == null
        ? null
        : {
            computed,
            judgement: {
              performanceScore: resultsPerformance?.performanceScore ?? null,
              verdict: resultsPerformance?.verdict ?? "",
              drivers: resultsPerformance?.drivers ?? [],
            },
          };

    return NextResponse.json({
      id: detail.id,
      prompt: detail.prompt,
      status: detail.status,
      title: detail.title,
      url: detail.url,
      platform: detail.platform,
      mediaType: detail.mediaType,
      username: detail.username,
      thumbnailUrl: detail.thumbnailUrl,
      viewCount: detail.viewCount,
      playCount: detail.playCount,
      likeCount: detail.likeCount,
      likeAndViewCountsDisabled: detail.likeAndViewCountsDisabled,
      postDate: detail.postDate,
      caption: detail.caption,
      durationSec: detail.durationSec,
      results,
      createdAt: detail.createdAt,
      performance,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch analysis." },
      { status: 500 },
    );
  }
}
