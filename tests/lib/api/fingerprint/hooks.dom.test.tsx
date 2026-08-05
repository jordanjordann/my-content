import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFingerprint, useUpdateFingerprintOverrides } from "@/lib/api/fingerprint/hooks";
import type { FingerprintView } from "@/lib/api/fingerprint/types";

/**
 * Ticket #123 — the harness's own acceptance test.
 *
 * This is the first test in the repo to render a real React tree (jsdom project,
 * `tests/**\/*.dom.test.tsx` glob — see `vitest.config.ts`). It exercises the exact
 * contract that #117/PR #122 review flagged as only "verified by construction":
 * `useUpdateFingerprintOverrides`'s `onSuccess` must invalidate `useFingerprint`'s query
 * key so an ACTIVE, mounted consumer's data reflects the mutation without a manual
 * refetch. If `onSuccess`'s `invalidateQueries` call in `lib/api/fingerprint/hooks.ts`
 * were deleted (or its `queryKey` drifted from `FINGERPRINT_KEYS.detail`), the GET call
 * count assertion below would stay at 1 and the final `overriddenKeys` assertion would
 * still see the stale pre-mutation value — this test would fail, not vacuously pass.
 */

const PROFILE_ID = "profile-1";

const BASE_VIEW: FingerprintView = {
  topicNicheDistribution: [{ value: "FINANCE", count: 4, share: 0.8 }],
  formatArchetypeDistribution: [],
  hookTypeDistribution: [{ value: "QUESTION", count: 3, share: 0.6 }],
  ctaTypeDistribution: [{ value: "FOLLOW", count: 5, share: 1 }],
  ctaTimingDistribution: [{ value: "END", count: 5, share: 1 }],
  pacingDistribution: [{ value: "FAST", count: 2, share: 0.4 }],
  audienceCalloutRate: 0.6,
  medianCutsPerMinute: 12,
  typicalBeatSequence: [],
  medianBeatCount: 5,
  verbalTonePatterns: [{ value: "CASUAL", count: 4, share: 0.8 }],
  captionStyleExemplars: [],
  hookTextExemplars: [],
  onScreenTextExemplars: [],
  sampleSize: 5,
  sourceAnalysisIds: ["a1", "a2", "a3", "a4", "a5"],
  dateRange: { earliest: "2026-05-01", latest: "2026-07-20" },
  profileId: PROFILE_ID,
  fingerprintVersion: 1,
  schemaVersion: 2,
  consistencyIndex: 0.71,
  computedAt: "2026-07-25 02:51:00",
  createdAt: "2026-07-01 00:00:00",
  updatedAt: "2026-07-25 02:51:00",
  overriddenKeys: [],
};

const PATCHED_VIEW: FingerprintView = {
  ...BASE_VIEW,
  audienceCalloutRate: 0.9,
  overriddenKeys: ["audienceCalloutRate"],
  updatedAt: "2026-08-05 10:00:00",
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUpdateFingerprintOverrides invalidating useFingerprint (real React tree)", () => {
  it("refetches and reflects the patched view after the mutation succeeds", async () => {
    let getCallCount = 0;
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        getCallCount += 1;
        return new Response(JSON.stringify(getCallCount === 1 ? BASE_VIEW : PATCHED_VIEW), {
          status: 200,
        });
      }
      if (method === "PATCH") {
        return new Response(JSON.stringify(PATCHED_VIEW), { status: 200 });
      }
      throw new Error(`unstubbed method in test: ${method} ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = createWrapper();
    const { result: queryResult } = renderHook(() => useFingerprint(PROFILE_ID), { wrapper });
    const { result: mutationResult } = renderHook(() => useUpdateFingerprintOverrides(), { wrapper });

    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));
    if (queryResult.current.data?.status !== "found") {
      throw new Error("expected a found selection before the mutation");
    }
    expect(queryResult.current.data.overriddenKeys.has("audienceCalloutRate")).toBe(false);
    expect(getCallCount).toBe(1);

    mutationResult.current.mutate({
      profileId: PROFILE_ID,
      patch: { audienceCalloutRate: 0.9 },
    });

    await waitFor(() => expect(mutationResult.current.isSuccess).toBe(true));

    // The invalidation triggers a background refetch of the ACTIVE useFingerprint
    // query — assert that refetch actually happened (a second GET) and that the
    // hook's own state now reflects the patched data, not just that the mutation
    // itself resolved.
    await waitFor(() => expect(getCallCount).toBe(2));
    await waitFor(() => {
      if (queryResult.current.data?.status !== "found") {
        throw new Error("expected a found selection after the mutation");
      }
      expect(queryResult.current.data.overriddenKeys.has("audienceCalloutRate")).toBe(true);
    });

    if (queryResult.current.data?.status !== "found") {
      throw new Error("expected a found selection after the mutation");
    }
    expect(queryResult.current.data.view.audienceCalloutRate).toBe(0.9);
  });
});
