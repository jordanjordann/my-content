"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAuthStatus, submitPin } from "@/lib/api/auth/api";
import { AUTH_KEYS } from "@/lib/api/auth/constants";

export { AUTH_KEYS } from "@/lib/api/auth/constants";

export function useAuthStatusQuery() {
  return useQuery({
    queryKey: AUTH_KEYS.status(),
    queryFn: getAuthStatus,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useSubmitPinMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pin, pinConfigured }: { pin: string; pinConfigured: boolean }) =>
      submitPin(pin, pinConfigured),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_KEYS.status() });
    },
  });
}
