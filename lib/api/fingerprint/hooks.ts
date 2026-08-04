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
 * lookup and a `topDistributionValue` helper for the found case. Defined at module
 * scope, mirroring `lib/api/analyses/hooks.ts`'s `selectIndexedAnalyses`, so TanStack
 * can memoize `select` across renders.
 */
function selectFingerprint(result: FingerprintResult): FingerprintSelection {
  if (isFingerprintAbsence(result)) {
    return { status: "absent", absence: result };
  }

  const overriddenKeys = toOverriddenKeySet(result);
  return {
    status: "found",
    view: result,
    overriddenKeys,
    isOverridden: (key: string) => overriddenKeys.has(key),
    topDistributionValue,
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
