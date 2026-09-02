import { describe, expect, it } from "vitest";

import { buildFailureSummary } from "@/app/app/analyses/components/AnalysesContent/helpers";
import type { AnalyzeFailure } from "@/lib/api/analyses/types";

function makeFailures(n: number, reason = "Content not found."): AnalyzeFailure[] {
  return Array.from({ length: n }, (_, i) => ({ url: `https://example.com/${i}`, reason }));
}

describe("buildFailureSummary", () => {
  it("0 failures -> empty string", () => {
    expect(buildFailureSummary([])).toBe("");
  });

  it("1 failure -> the reason verbatim", () => {
    const failures = makeFailures(1, "Content not found — it may be deleted or the URL is wrong.");
    expect(buildFailureSummary(failures)).toBe(
      "Content not found — it may be deleted or the URL is wrong.",
    );
  });

  it("2-3 failures -> joined with ' · ', each truncated to 80 chars", () => {
    const failures: AnalyzeFailure[] = [
      { url: "https://example.com/1", reason: "a".repeat(100) },
      { url: "https://example.com/2", reason: "Video is private." },
    ];
    const result = buildFailureSummary(failures);
    const [first, second] = result.split(" · ");
    expect(first).toBe(`${"a".repeat(80)}...`);
    expect(second).toBe("Video is private.");
  });

  it("4+ failures -> summary with count, panel referral", () => {
    const failures = makeFailures(5);
    expect(buildFailureSummary(failures)).toBe(
      "5 URLs failed — see the progress panel for details",
    );
  });

  it("boundary: exactly 3 failures (MAX_TOAST_FAILURE_REASONS) -> still joined, not the count summary", () => {
    const failures = makeFailures(3, "Video is private.");
    expect(buildFailureSummary(failures)).toBe(
      "Video is private. · Video is private. · Video is private.",
    );
  });

  it("boundary: exactly 4 failures (MAX_TOAST_FAILURE_REASONS + 1) -> the count summary, not joined", () => {
    const failures = makeFailures(4, "Video is private.");
    expect(buildFailureSummary(failures)).toBe(
      "4 URLs failed — see the progress panel for details",
    );
  });
});
