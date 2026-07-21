"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAnalyses, getAnalysis, analyzeContent, deleteAnalysis } from "@/lib/api/analyses/api";
import { ANALYSIS_KEYS } from "@/lib/api/analyses/constants";
import type {
  AnalysesListResponse,
  AnalysisDetail,
  AnalysisListItemIndexed,
} from "@/lib/api/analyses/types";
import { normalize, toProxiedThumbnail } from "@/lib/api/analyses/helpers";

/**
 * Precomputes the keyword search index (`searchText`) for each analysis. Only title/caption/
 * prompt are indexed — not username or url (indexing username would make the keyword box
 * silently duplicate the Account filter). Defined at module scope so TanStack can memoize
 * `select` across renders instead of rebuilding the closure on every one.
 */
function selectIndexedAnalyses(
  data: AnalysesListResponse,
): { analyses: AnalysisListItemIndexed[]; accounts: string[] } {
  return {
    analyses: data.analyses.map((analysis) => ({
      ...analysis,
      thumbnailUrl: toProxiedThumbnail(analysis.thumbnailUrl, analysis.platform),
      searchText: normalize(
        [analysis.title, analysis.caption, analysis.prompt].filter(Boolean).join(" "),
      ),
    })),
    accounts: data.accounts,
  };
}

/** Routes `thumbnailUrl` through the image proxy for Instagram content. */
function selectProxiedAnalysisDetail(data: AnalysisDetail): AnalysisDetail {
  return {
    ...data,
    thumbnailUrl: toProxiedThumbnail(data.thumbnailUrl, data.platform),
  };
}

export function useAnalysesQuery() {
  return useQuery({
    queryKey: ANALYSIS_KEYS.lists(),
    queryFn: getAnalyses,
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
