import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Ticket #279 (band-aid): `MAX_URLS_PER_BATCH` was lowered from 10 to 4
 * (73s worst-case per analysis * 4 = 292s, under a self-imposed ~5min UX
 * budget — see the constant's own comment for the arithmetic). This pins
 * that the server actually enforces the new value, not just that a
 * constant with that name exists somewhere.
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
  it("MAX_URLS_PER_BATCH is 4 (the value the ticket's arithmetic derives)", async () => {
    const { MAX_URLS_PER_BATCH } = await import("@/lib/server/analysis/constants");
    expect(MAX_URLS_PER_BATCH).toBe(4);
  });

  it("accepts a batch of exactly 4 URLs (the new limit) and runs all 4", async () => {
    const { POST } = await import("@/app/api/analyze/route");
    const urls = ["https://instagram.com/reel/1", "https://instagram.com/reel/2", "https://instagram.com/reel/3", "https://instagram.com/reel/4"];

    const response = await POST(makePostRequest({ urls, prompt: "" }));
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.analysesCreated).toBe(4);
    expect(runAnalysisMock).toHaveBeenCalledTimes(4);
  });

  it("rejects a batch of 5 URLs with 400 and never calls runAnalysis at all", async () => {
    const { POST } = await import("@/app/api/analyze/route");
    const urls = [
      "https://instagram.com/reel/1",
      "https://instagram.com/reel/2",
      "https://instagram.com/reel/3",
      "https://instagram.com/reel/4",
      "https://instagram.com/reel/5",
    ];

    const response = await POST(makePostRequest({ urls, prompt: "" }));
    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.error).toMatch(/max 4/);
    expect(runAnalysisMock).not.toHaveBeenCalled();
  });

  it("rejects the old limit of 10 URLs, proving the ticket's reduction actually took effect", async () => {
    const { POST } = await import("@/app/api/analyze/route");
    const urls = Array.from({ length: 10 }, (_, i) => `https://instagram.com/reel/${i}`);

    const response = await POST(makePostRequest({ urls, prompt: "" }));
    expect(response.status).toBe(400);
    expect(runAnalysisMock).not.toHaveBeenCalled();
  });
});
