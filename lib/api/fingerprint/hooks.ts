"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchFingerprint, patchFingerprintOverrides } from "@/lib/api/fingerprint/api";
import { FINGERPRINT_KEYS } from "@/lib/api/fingerprint/constants";
import { isFingerprintAbsence, toOverriddenKeySet, topDistributionValue } from "@/lib/api/fingerprint/helpers";
import type {
  FingerprintOverridePatch,
  FingerprintResult,
  FingerprintSelection,
} from "@/lib/api/fingerprint/types";

/**
 * Derives the `select` shape consumed by (a future) UI (TDD §6): a typed absence for
 * the cold-start `404` case, or the view plus an `overriddenKeys` `Set`/`isOverridden`
 * lookup and the precomputed per-distribution top values for the found case. Defined at
 * module scope, mirroring `lib/api/analyses/hooks.ts`'s `selectIndexedAnalyses`, so
 * TanStack can memoize `select` across renders. `topDistributionValue` is invoked here,
 * inside `select` — per AGENTS.md's data-transformation rule, derivation belongs in
 * `select`, not a function reference left for a future UI consumer to call at render
 * time.
 */
export function selectFingerprint(result: FingerprintResult): FingerprintSelection {
  if (isFingerprintAbsence(result)) {
    return { status: "absent", absence: result };
  }

  const overriddenKeys = toOverriddenKeySet(result);
  return {
    status: "found",
    view: result,
    overriddenKeys,
    isOverridden: (key: string) => overriddenKeys.has(key),
    topValues: {
      topicNiche: topDistributionValue(result.topicNicheDistribution),
      formatArchetype: topDistributionValue(result.formatArchetypeDistribution),
      hookType: topDistributionValue(result.hookTypeDistribution),
      ctaType: topDistributionValue(result.ctaTypeDistribution),
      ctaTiming: topDistributionValue(result.ctaTimingDistribution),
      pacing: topDistributionValue(result.pacingDistribution),
      verbalTone: topDistributionValue(result.verbalTonePatterns),
    },
  };
}

export function useFingerprint(profileId: string) {
  return useQuery({
    queryKey: FINGERPRINT_KEYS.detail(profileId),
    queryFn: () => fetchFingerprint(profileId),
    enabled: Boolean(profileId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    select: selectFingerprint,
  });
}

export function useUpdateFingerprintOverrides() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, patch }: { profileId: string; patch: FingerprintOverridePatch }) =>
      patchFingerprintOverrides(profileId, patch),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: FINGERPRINT_KEYS.detail(variables.profileId) });
    },
  });
}
