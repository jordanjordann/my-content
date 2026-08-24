"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAnalyses, getAnalysis, analyzeContent, deleteAnalysis } from "@/lib/api/analyses/api";
import { ANALYSES_FETCH_ALL_PAGE_SIZE, ANALYSIS_KEYS } from "@/lib/api/analyses/constants";
import type {
  AnalysesListResponse,
  AnalysisDetail,
  AnalysisDetailClassified,
  AnalysisListItemIndexed,
  AnalysesPagination,
  GetAnalysesParams,
} from "@/lib/api/analyses/types";
import {
  classifyLikeCount,
  classifyViewCount,
  deriveAnalysisTablePerformance,
  isUntrustedYoutubeMetadataOnly,
  normalize,
  toProxiedThumbnail,
} from "@/lib/api/analyses/helpers";

/**
 * Precomputes the keyword search index (`searchText`) for each analysis. Only title/caption/
 * prompt are indexed — not username or url (indexing username would make the keyword box
 * silently duplicate the Account filter). Defined at module scope so TanStack can memoize
 * `select` across renders instead of rebuilding the closure on every one.
 */
function selectIndexedAnalyses(
  data: AnalysesListResponse,
): { analyses: AnalysisListItemIndexed[]; accounts: string[]; pagination: AnalysesPagination } {
  return {
    analyses: data.analyses.map((analysis) => ({
      ...analysis,
      thumbnailUrl: toProxiedThumbnail(analysis.thumbnailUrl, analysis.platform),
      searchText: normalize(
        [analysis.title, analysis.caption, analysis.prompt].filter(Boolean).join(" "),
      ),
      viewCountState: classifyViewCount({
        viewCount: analysis.viewCount,
        playCount: analysis.playCount,
        likeAndViewCountsDisabled: analysis.likeAndViewCountsDisabled,
      }),
      likeCountState: classifyLikeCount({
        likeCount: analysis.likeCount,
        likeAndViewCountsDisabled: analysis.likeAndViewCountsDisabled,
      }),
      tableDerived: deriveAnalysisTablePerformance(
        analysis.performance,
        analysis.mediaType,
        analysis.likeAndViewCountsDisabled,
      ),
    })),
    accounts: data.accounts,
    pagination: data.pagination,
  };
}

/**
 * Routes `thumbnailUrl` through the image proxy for Instagram content and attaches the
 * classified `viewCountState`/`likeCountState` (TDD §4.3) so the detail modal never
 * branches on raw counts.
 */
function selectProxiedAnalysisDetail(data: AnalysisDetail): AnalysisDetailClassified {
  return {
    ...data,
    thumbnailUrl: toProxiedThumbnail(data.thumbnailUrl, data.platform),
    viewCountState: classifyViewCount({
      viewCount: data.viewCount,
      playCount: data.playCount,
      likeAndViewCountsDisabled: data.likeAndViewCountsDisabled,
    }),
    likeCountState: classifyLikeCount({
      likeCount: data.likeCount,
      likeAndViewCountsDisabled: data.likeAndViewCountsDisabled,
    }),
    isUntrustedYoutubeMetadataOnly: isUntrustedYoutubeMetadataOnly(data.platform, data.storedAnalysisMode),
  };
}

/**
 * Ticket #144 — `params` (page/pageSize) is part of the query key so each
 * page/page-size combination caches independently, matching server-side
 * pagination's stable-per-page contract. Sorting was removed by owner
 * ruling (#266, 2026-08-20) — the server's order is fixed.
 */
export function useAnalysesQuery(params: GetAnalysesParams = {}) {
  return useQuery({
    queryKey: [...ANALYSIS_KEYS.lists(), params],
    queryFn: () => getAnalyses(params),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    select: selectIndexedAnalyses,
  });
}

/**
 * B4 (PR #196 review) — bridge for the OLD `/app/analyses` page
 * (`AnalysesContent.tsx`). That page's Account/Platform/Status/keyword
 * filters run client-side over whatever `useAnalysesQuery` returns; before
 * ticket #144 that was every row (`getAnalysesList()` had no cap), so
 * filtering searched the full corpus correctly. #144 capped the default
 * response at `ANALYSES_PAGE_SIZE` (50) for server-side pagination, which
 * silently made the old page's filters page-scoped — a filter whose only
 * matches live on page 2+ now renders a false "no results" state once the
 * corpus exceeds 50 rows.
 *
 * This requests `ANALYSES_FETCH_ALL_PAGE_SIZE` rows in one response,
 * restoring the old page's original "search everything" behaviour without
 * touching `useAnalysesQuery`'s own default (still `ANALYSES_PAGE_SIZE`)
 * that #145's server-paginated 3C table depends on. Do NOT reach for this
 * in new code — once #145 replaces the old page, this hook goes away.
 */
export function useAllAnalysesQuery() {
  return useAnalysesQuery({ pageSize: ANALYSES_FETCH_ALL_PAGE_SIZE });
}

export function useAnalysisQuery(id: string) {
  return useQuery({
    queryKey: ANALYSIS_KEYS.detail(id),
    queryFn: () => getAnalysis(id),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    select: selectProxiedAnalysisDetail,
  });
}

export function useAnalyzeContentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ urls, prompt }: { urls: string[]; prompt: string }) =>
      analyzeContent(urls, prompt),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ANALYSIS_KEYS.lists() });
    },
  });
}

export function useDeleteAnalysisMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAnalysis(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ANALYSIS_KEYS.lists() });
    },
  });
}
