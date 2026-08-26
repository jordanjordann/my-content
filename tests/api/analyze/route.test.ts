import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Ticket #279: the plan to lower `MAX_URLS_PER_BATCH` from 10 was rejected
 * by owner ruling (2026-08-26) — deferred to Phase 3A. This file now only
 * pins that the route actually enforces whatever `MAX_URLS_PER_BATCH` is
 * set to, written against the constant rather than a hardcoded number, so
 * it doesn't need to be touched again if the value changes.
 *
 * `isAuthenticated` and `runAnalysis` are mocked — no live API calls, no
 * DB. `runAnalysis` is not the thing under test here; the route's own
 * length check (`app/api/analyze/route.ts`) is.
 */

const { isAuthenticatedMock, runAnalysisMock } = vi.hoisted(() => ({
  isAuthenticatedMock: vi.fn<() => Promise<boolean>>(),
  runAnalysisMock: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({
  isAuthenticated: isAuthenticatedMock,
}));

vi.mock("@/lib/server/analysis/pipeline", () => ({
  runAnalysis: runAnalysisMock,
}));

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  isAuthenticatedMock.mockReset();
  isAuthenticatedMock.mockResolvedValue(true);
  runAnalysisMock.mockReset();
  runAnalysisMock.mockImplementation(async ({ url }: { url: string }) => ({
    analysisId: `id-for-${url}`,
  }));
});

describe("POST /api/analyze — MAX_URLS_PER_BATCH enforcement (#279)", () => {
  it("accepts a batch of exactly MAX_URLS_PER_BATCH URLs and runs all of them", async () => {
    const { MAX_URLS_PER_BATCH } = await import("@/lib/server/analysis/constants");
    const { POST } = await import("@/app/api/analyze/route");
    const urls = Array.from(
      { length: MAX_URLS_PER_BATCH },
      (_, i) => `https://instagram.com/reel/${i}`,
    );

    const response = await POST(makePostRequest({ urls, prompt: "" }));
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.analysesCreated).toBe(MAX_URLS_PER_BATCH);
    expect(runAnalysisMock).toHaveBeenCalledTimes(MAX_URLS_PER_BATCH);
  });

  it("rejects a batch of MAX_URLS_PER_BATCH + 1 URLs with 400 and never calls runAnalysis", async () => {
    const { MAX_URLS_PER_BATCH } = await import("@/lib/server/analysis/constants");
    const { POST } = await import("@/app/api/analyze/route");
    const urls = Array.from(
      { length: MAX_URLS_PER_BATCH + 1 },
      (_, i) => `https://instagram.com/reel/${i}`,
    );

    const response = await POST(makePostRequest({ urls, prompt: "" }));
    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.error).toMatch(new RegExp(`max ${MAX_URLS_PER_BATCH}`));
    expect(runAnalysisMock).not.toHaveBeenCalled();
  });
});
