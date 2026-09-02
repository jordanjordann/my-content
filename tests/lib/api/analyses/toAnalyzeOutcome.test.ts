import { describe, expect, it } from "vitest";

import { toAnalyzeOutcome } from "@/lib/api/analyses/helpers";
import type { AnalyzeResponse } from "@/lib/api/analyses/types";

/**
 * Ticket #289 (TDD §4.2) — the hook-layer transform that turns the raw `/api/analyze`
 * response into an `AnalyzeOutcome`. Calls the REAL `toAnalyzeOutcome` exported from
 * `lib/api/analyses/helpers.ts` directly — nothing under test is mocked.
 */
describe("toAnalyzeOutcome", () => {
  it("carries a non-empty server reason through byte-for-byte", () => {
    const response: AnalyzeResponse = {
      analysisIds: [],
      analysesCreated: 0,
      failedUrls: [
        {
          url: "https://www.instagram.com/reel/abc",
          index: 0,
          error: "Content not found — it may be deleted or the URL is wrong.",
        },
      ],
    };

    const outcome = toAnalyzeOutcome(response, ["https://www.instagram.com/reel/abc"]);

    expect(outcome.failures[0].reason).toBe(
      "Content not found — it may be deleted or the URL is wrong.",
    );
  });

  it("falls back to a generic reason when the server sends an empty string", () => {
    const response: AnalyzeResponse = {
      analysisIds: [],
      analysesCreated: 0,
      failedUrls: [{ url: "https://www.instagram.com/reel/abc", index: 0, error: "" }],
    };

    const outcome = toAnalyzeOutcome(response, ["https://www.instagram.com/reel/abc"]);

    expect(outcome.failures[0].reason).toBe("Analysis failed.");
  });

  it("reconciliation guard — synthesizes a failure for a URL neither created nor reported failed", () => {
    const requestedUrls = [
      "https://www.instagram.com/reel/a",
      "https://www.instagram.com/reel/b",
      "https://www.instagram.com/reel/c",
    ];
    const response: AnalyzeResponse = {
      analysisIds: ["id-1"],
      analysesCreated: 1,
      failedUrls: [
        {
          url: "https://www.instagram.com/reel/b",
          index: 1,
          error: "Content not found — it may be deleted or the URL is wrong.",
        },
      ],
    };

    const outcome = toAnalyzeOutcome(response, requestedUrls);

    expect(outcome.failures).toHaveLength(2);
    const synthetic = outcome.failures.find(
      (f) => f.url === "https://www.instagram.com/reel/c",
    );
    expect(synthetic).toEqual({
      url: "https://www.instagram.com/reel/c",
      reason: "No result was returned for this URL.",
    });
  });

  it("all succeeded — failures is empty and created equals requested", () => {
    const requestedUrls = ["https://www.instagram.com/reel/a", "https://www.instagram.com/reel/b"];
    const response: AnalyzeResponse = {
      analysisIds: ["id-1", "id-2"],
      analysesCreated: 2,
      failedUrls: [],
    };

    const outcome = toAnalyzeOutcome(response, requestedUrls);

    expect(outcome.failures).toEqual([]);
    expect(outcome.created).toBe(outcome.requested);
  });

  it("keeps every failure entry, even with identical reasons — no de-duplication", () => {
    const requestedUrls = Array.from({ length: 5 }, (_, i) => `https://www.instagram.com/reel/${i}`);
    const failedUrls = requestedUrls.map((url, index) => ({
      url,
      index,
      error: "Content not found — it may be deleted or the URL is wrong.",
    }));
    const response: AnalyzeResponse = {
      analysisIds: [],
      analysesCreated: 0,
      failedUrls,
    };

    const outcome = toAnalyzeOutcome(response, requestedUrls);

    expect(outcome.failures).toHaveLength(5);
    expect(new Set(outcome.failures.map((f) => f.url)).size).toBe(5);
    outcome.failures.forEach((f) => {
      expect(f.reason).toBe("Content not found — it may be deleted or the URL is wrong.");
    });
  });

  it("passes analysisIds through unchanged", () => {
    const response: AnalyzeResponse = {
      analysisIds: ["id-1", "id-2"],
      analysesCreated: 2,
      failedUrls: [],
    };

    const outcome = toAnalyzeOutcome(response, ["a", "b"]);

    expect(outcome.analysisIds).toBe(response.analysisIds);
  });
});
