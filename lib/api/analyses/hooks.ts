"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAnalyses, getAnalysis, analyzeContent, deleteAnalysis } from "@/lib/api/analyses/api";
import { ANALYSIS_KEYS } from "@/lib/api/analyses/constants";

export function useAnalysesQuery() {
  return useQuery({
    queryKey: ANALYSIS_KEYS.lists(),
    queryFn: getAnalyses,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useAnalysisQuery(id: string) {
  return useQuery({
    queryKey: ANALYSIS_KEYS.detail(id),
    queryFn: () => getAnalysis(id),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    select: (data) => data,
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
