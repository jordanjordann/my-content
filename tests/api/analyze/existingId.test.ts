import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Ticket #312 (#281 audit finding) — docs/TDD-analysis-write-verification.md
 * §4.1, check A: `POST /api/analyze`'s route-level existence check on
 * `existingId`, run BEFORE the batch loop so a phantom id 404s with ZERO
 * paid ScrapeCreators/Gemini spend, instead of running a full paid pipeline
 * and reporting `200 OK` for an id that doesn't exist.
 *
 * `runAnalysis` is mocked — this file is not exercising the pipeline's own
 * `rowsAffected` assertion (check B, covered by
 * `tests/server/analysis/pipeline/writeVerification.test.ts`), only the
 * route's contract: does it call the paid pipeline at all, and does it
 * return the right status code.
 */

const { isAuthenticatedMock, runAnalysisMock, analysisExistsMock } = vi.hoisted(() => ({
  isAuthenticatedMock: vi.fn<() => Promise<boolean>>(),
  runAnalysisMock: vi.fn(),
  analysisExistsMock: vi.fn<(id: string) => Promise<boolean>>(),
}));

vi.mock("@/lib/server/auth", () => ({
  isAuthenticated: isAuthenticatedMock,
}));

vi.mock("@/lib/server/analysis/pipeline", () => ({
  runAnalysis: runAnalysisMock,
}));

vi.mock("@/lib/server/db", () => ({
  analysisExists: analysisExistsMock,
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
  analysisExistsMock.mockReset();
});

describe("POST /api/analyze — existingId validation (#312/#281)", () => {
  it("404s and makes ZERO paid calls when existingId does not exist", async () => {
    analysisExistsMock.mockResolvedValue(false);
    const { POST } = await import("@/app/api/analyze/route");

    const response = await POST(
      makePostRequest({ urls: ["https://instagram.com/reel/x"], prompt: "", existingId: "ghost-id" }),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Analysis not found.");
    expect(analysisExistsMock).toHaveBeenCalledWith("ghost-id");
    expect(runAnalysisMock).not.toHaveBeenCalled();
  });

  it("proceeds to runAnalysis and returns 200 when existingId does exist", async () => {
    analysisExistsMock.mockResolvedValue(true);
    const { POST } = await import("@/app/api/analyze/route");

    const response = await POST(
      makePostRequest({ urls: ["https://instagram.com/reel/x"], prompt: "", existingId: "real-id" }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.analysesCreated).toBe(1);
    expect(runAnalysisMock).toHaveBeenCalledTimes(1);
  });

  it("never calls analysisExists for a brand-new analysis (no existingId)", async () => {
    const { POST } = await import("@/app/api/analyze/route");

    const response = await POST(makePostRequest({ urls: ["https://instagram.com/reel/x"], prompt: "" }));

    expect(response.status).toBe(200);
    expect(analysisExistsMock).not.toHaveBeenCalled();
    expect(runAnalysisMock).toHaveBeenCalledTimes(1);
  });
});
