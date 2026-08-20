import { describe, expect, it } from "vitest";

import { NOT_COMPARABLE_MULTIPLIER_CELL_COPY } from "@/lib/api/analyses/constants";

/**
 * Ticket #262 (DESIGN-3C §2) — the `NOT_COMPARABLE` copy record's hard copy constraint: no new
 * words may be invented. The below-threshold short form
 * (`POST_METRIC_UNRESOLVED_NO_BASELINE`) must be the TRAILING CLAUSE of the shipped long form
 * (`POST_METRIC_UNRESOLVED`), verbatim — not reworded, not repunctuated, not recapitalised.
 */
describe("NOT_COMPARABLE_MULTIPLIER_CELL_COPY — ticket #262's hard copy constraint", () => {
  it("the below-threshold short form is a verbatim substring of the shipped long form", () => {
    const long = NOT_COMPARABLE_MULTIPLIER_CELL_COPY.POST_METRIC_UNRESOLVED;
    const short = NOT_COMPARABLE_MULTIPLIER_CELL_COPY.POST_METRIC_UNRESOLVED_NO_BASELINE;

    expect(long.includes(short)).toBe(true);
  });

  it("the short form is exactly the long form's trailing clause, after the em-dash", () => {
    const long = NOT_COMPARABLE_MULTIPLIER_CELL_COPY.POST_METRIC_UNRESOLVED;
    const short = NOT_COMPARABLE_MULTIPLIER_CELL_COPY.POST_METRIC_UNRESOLVED_NO_BASELINE;

    expect(long).toBe(`this creator's usual is set — ${short}`);
    expect(short).toBe("this post's own count wasn't published");
  });

  it("the short form never contains the now-false leading clause", () => {
    const short = NOT_COMPARABLE_MULTIPLIER_CELL_COPY.POST_METRIC_UNRESOLVED_NO_BASELINE;
    expect(short).not.toMatch(/this creator's usual is set/);
  });

  it("is exhaustive over the three known NOT_COMPARABLE reasons — no missing key", () => {
    expect(Object.keys(NOT_COMPARABLE_MULTIPLIER_CELL_COPY).sort()).toEqual(
      ["MEDIAN_ZERO", "POST_METRIC_UNRESOLVED", "POST_METRIC_UNRESOLVED_NO_BASELINE"].sort(),
    );
  });
});
