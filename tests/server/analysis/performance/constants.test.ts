import { afterEach, describe, expect, it, vi } from "vitest";

describe("performance/constants — env-overridable, TDD §1.4", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("MATURITY_FLOOR_HOURS defaults to 72", async () => {
    vi.resetModules();
    const { MATURITY_FLOOR_HOURS } = await import("@/lib/server/analysis/performance/constants");
    expect(MATURITY_FLOOR_HOURS).toBe(72);
  });

  it("MATURITY_FLOOR_HOURS is overridable via PERFORMANCE_MATURITY_FLOOR_HOURS", async () => {
    vi.stubEnv("PERFORMANCE_MATURITY_FLOOR_HOURS", "48");
    vi.resetModules();
    const { MATURITY_FLOOR_HOURS } = await import("@/lib/server/analysis/performance/constants");
    expect(MATURITY_FLOOR_HOURS).toBe(48);
  });

  it("MATURITY_FLOOR_HOURS throws on an invalid override", async () => {
    vi.stubEnv("PERFORMANCE_MATURITY_FLOOR_HOURS", "not-a-number");
    vi.resetModules();
    await expect(import("@/lib/server/analysis/performance/constants")).rejects.toThrow(
      /Invalid PERFORMANCE_MATURITY_FLOOR_HOURS/,
    );
  });

  it("MATURITY_FLOOR_HOURS throws on a non-positive override", async () => {
    vi.stubEnv("PERFORMANCE_MATURITY_FLOOR_HOURS", "0");
    vi.resetModules();
    await expect(import("@/lib/server/analysis/performance/constants")).rejects.toThrow(
      /Invalid PERFORMANCE_MATURITY_FLOOR_HOURS/,
    );
  });

  it("BASELINE_MIN_SAMPLE defaults to 5", async () => {
    vi.resetModules();
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    expect(BASELINE_MIN_SAMPLE).toBe(5);
  });

  it("BASELINE_MIN_SAMPLE is overridable via PERFORMANCE_BASELINE_MIN_SAMPLE", async () => {
    vi.stubEnv("PERFORMANCE_BASELINE_MIN_SAMPLE", "3");
    vi.resetModules();
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    expect(BASELINE_MIN_SAMPLE).toBe(3);
  });

  it("BASELINE_MIN_SAMPLE throws on a non-integer override", async () => {
    vi.stubEnv("PERFORMANCE_BASELINE_MIN_SAMPLE", "2.5");
    vi.resetModules();
    await expect(import("@/lib/server/analysis/performance/constants")).rejects.toThrow(
      /Invalid PERFORMANCE_BASELINE_MIN_SAMPLE/,
    );
  });

  it("BASELINE_MIN_SAMPLE throws on a non-positive override", async () => {
    vi.stubEnv("PERFORMANCE_BASELINE_MIN_SAMPLE", "-1");
    vi.resetModules();
    await expect(import("@/lib/server/analysis/performance/constants")).rejects.toThrow(
      /Invalid PERFORMANCE_BASELINE_MIN_SAMPLE/,
    );
  });
});
