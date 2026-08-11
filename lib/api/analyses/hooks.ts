"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAnalyses, getAnalysis, analyzeContent, deleteAnalysis } from "@/lib/api/analyses/api";
import { ANALYSIS_KEYS } from "@/lib/api/analyses/constants";
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
  };
}

/**
 * Ticket #144 — `params` (page/sortBy/sortDir) is part of the query key so
 * each page/sort combination caches independently, matching server-side
 * pagination's stable-per-page contract.
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
