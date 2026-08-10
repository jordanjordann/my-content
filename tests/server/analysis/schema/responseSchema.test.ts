import { describe, expect, it } from "vitest";
import { ANALYSIS_RESPONSE_SCHEMA, performanceSchema } from "@/lib/server/analysis/schema";

/**
 * TDD §4/§8.1 step 6, OR-13: `responseSchema` is narrowed to exactly THREE
 * fields for the performance/judgement layer — everything else a full
 * contract would need (`tierUsed`, `confidence`, `basedOnVideos`,
 * `provisional`, `unavailableReason`) is computed in code, never requested
 * from the model.
 */
describe("performanceSchema — narrowed to exactly three fields (OR-13)", () => {
  it("has exactly three properties", () => {
    expect(Object.keys(performanceSchema.properties ?? {})).toHaveLength(3);
  });

  it("the three properties are exactly performanceScore, verdict, drivers — no more, no less", () => {
    expect(new Set(Object.keys(performanceSchema.properties ?? {}))).toEqual(
      new Set(["performanceScore", "verdict", "drivers"]),
    );
  });

  it("does NOT include any of the five code-computed judgement fields", () => {
    const keys = Object.keys(performanceSchema.properties ?? {});
    for (const forbidden of ["tierUsed", "confidence", "basedOnVideos", "provisional", "unavailableReason"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("all three properties are required", () => {
    expect(new Set(performanceSchema.required ?? [])).toEqual(new Set(["performanceScore", "verdict", "drivers"]));
  });
});

describe("ANALYSIS_RESPONSE_SCHEMA — carries the performance sub-schema", () => {
  it("includes 'performance' as a required top-level property", () => {
    expect(ANALYSIS_RESPONSE_SCHEMA.properties?.performance).toBe(performanceSchema);
    expect(ANALYSIS_RESPONSE_SCHEMA.required).toContain("performance");
  });
});
