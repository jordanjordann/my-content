import { describe, expect, it } from "vitest";

import { formatAbbrev } from "@/app/app/analyses/components/counts/EngagementCount/helpers";

/**
 * Ticket #101 review round (finding N2) — `formatAbbrev` was promoted from
 * `AnalysisDetailModal/helpers.ts` (`formatViews`) to the single shared abbreviation
 * helper for every surface with zero test coverage. Table-driven coverage of the K/M
 * tiers, the 999_950-999_999 rounding-boundary bug (`999.999.toFixed(1) -> "1000.0"`,
 * previously shipped as `"1000.0K"` instead of tiering up to M), and the documented
 * out-of-contract behavior for negative and non-integer input.
 */
describe("formatAbbrev", () => {
  const cases: Array<[number, string]> = [
    [0, "0"],
    [1, "1"],
    [999, "999"],
    [1_000, "1.0K"],
    [1_049, "1.0K"],
    [999_999, "1.0M"],
    [1_000_000, "1.0M"],
    [1_234_567, "1.2M"],
    [999_999_999, "1000.0M"],
  ];

  it.each(cases)("formatAbbrev(%i) -> %s", (input, expected) => {
    expect(formatAbbrev(input)).toBe(expected);
  });

  it("999_950-999_999 all tier up to 1.0M instead of rounding artifact '1000.0K'", () => {
    for (const count of [999_950, 999_975, 999_990, 999_999]) {
      expect(formatAbbrev(count)).toBe("1.0M");
    }
  });

  it("999_949 stays at the K tier, just below the rounding boundary", () => {
    expect(formatAbbrev(999_949)).toBe("999.9K");
  });

  it("contract: negative numbers are out of contract and fall through to toLocaleString()", () => {
    expect(formatAbbrev(-5)).toBe("-5");
  });

  it("contract: non-integers are out of contract and fall through to toLocaleString()", () => {
    expect(formatAbbrev(999.5)).toBe("999.5");
  });
});
