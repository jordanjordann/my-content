import { NextResponse } from "next/server";

import { getAnalysisDetail } from "@/lib/server/db";
import { isAuthenticated } from "@/lib/server/auth";
import {
  buildComputedPerformanceBlock,
  candidatePoolKey,
  fetchLiveEligibleComparatorIds,
  MATURITY_FLOOR_HOURS,
  type LiveComparator,
  type PerformanceBlockRow,
} from "@/lib/server/analysis/performance";
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

    // Ticket #206 (D1/D3), extended live by #252 — same batched live
    // comparator derivation as the list endpoint, degenerate to a
    // single-pool request here (one detail row). `buildTier2()` decides
    // whether/how to use it; this row's own id may legitimately be a
    // member of its own pool (self-exclusion happens in `readModel.ts`).
    let livePool: LiveComparator[] | null = null;
    if (
      detail.perfBucketKey != null &&
      detail.perfMultiplier == null &&
      detail.profileId != null &&
      detail.schemaVersion != null
    ) {
      const pool = {
        profileId: detail.profileId,
        bucketKey: detail.perfBucketKey,
        schemaVersion: detail.schemaVersion,
      };
      const liveComparators = await fetchLiveEligibleComparatorIds([pool], MATURITY_FLOOR_HOURS);
      livePool = liveComparators.get(candidatePoolKey(pool)) ?? null;
    }

    // Ticket #144 (TDD §7) — purely additive, verbatim same derivation as
    // `app/api/analyses/route.ts`'s list endpoint.
    const computed = buildComputedPerformanceBlock({
      id: detail.id,
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
    }, livePool);

    const resultsPerformance = (results as { performance?: { performanceScore: number | null; verdict: string; drivers: string[] } } | null)
      ?.performance;

    const performance: AnalysisPerformance =
      computed == null
        ? null
        : {
            computed,
            judgement: {
              performanceScore: resultsPerformance?.performanceScore ?? null,
              // B3: `null` means no judgement exists — never fabricate an empty string.
              verdict: resultsPerformance?.verdict ?? null,
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
      // Ticket #294 — raw `analyses.analysis_mode` column, passed through as-is (AGENTS.md's
      // API-layer rule); `lib/api/analyses/hooks.ts`'s `select` derives the untrusted flag.
      storedAnalysisMode: detail.storedAnalysisMode,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch analysis." },
      { status: 500 },
    );
  }
}
