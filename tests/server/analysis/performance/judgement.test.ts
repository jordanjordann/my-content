import { describe, expect, it } from "vitest";

import {
  renderHiddenCountsReasonShortForm,
  resolveHiddenCountsUnavailableReason,
} from "@/lib/server/analysis/performance/judgement";

/**
 * Ticket #169 (PRD R-13.5.3/R-13.5.3a/R-13.5.3b, AC-30; TDD §5.3; DESIGN-3B
 * §5 rows 1 and 3). Scoped to exactly the two facts R-13.5.3a says must not
 * share one enum value:
 *
 *   - Row 1: the hidden-counts flag is CONFIRMED `true` -> `REACH_HIDDEN`.
 *   - Row 3: no usable performance input exists AND the flag is ABSENT
 *     (not `true`, not `false`) from the payload -> `CAUSE_NOT_DETERMINABLE`.
 *
 * The remaining five `unavailableReason` values (`REACH_UNKNOWN`,
 * `CONTENT_KIND_UNSUPPORTED`, `REACH_NOT_ON_FIRST_SLIDE`, `NO_AUDIENCE_DATA`,
 * `INSUFFICIENT_HISTORY`) are #143's full judgement module — out of scope
 * here (this function returns `null` for every case that isn't row 1 or
 * row 3, leaving those to #143).
 */
describe("resolveHiddenCountsUnavailableReason — R-13.5.3a's two-fact split", () => {
  it("flag CONFIRMED true resolves REACH_HIDDEN, never CAUSE_NOT_DETERMINABLE — even with no usable inputs at all", () => {
    const result = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: true,
      reachState: "UNKNOWN",
      likeState: "HIDDEN",
      commentState: "UNKNOWN",
    });

    expect(result).toBe("REACH_HIDDEN");
    expect(result).not.toBe("CAUSE_NOT_DETERMINABLE");
  });

  it("flag CONFIRMED true resolves REACH_HIDDEN even when other inputs (e.g. comments, unaffected by the flag) ARE usable", () => {
    const result = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: true,
      reachState: "UNKNOWN",
      likeState: "HIDDEN",
      commentState: "AVAILABLE",
    });

    expect(result).toBe("REACH_HIDDEN");
  });

  it("flag ABSENT (undefined) with no usable inputs resolves CAUSE_NOT_DETERMINABLE, never REACH_HIDDEN", () => {
    const result = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: undefined,
      reachState: "UNKNOWN",
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
    });

    expect(result).toBe("CAUSE_NOT_DETERMINABLE");
    expect(result).not.toBe("REACH_HIDDEN");
  });

  it("flag ABSENT (null) with no usable inputs also resolves CAUSE_NOT_DETERMINABLE — null and undefined are the same 'absent' fact", () => {
    const result = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: null,
      reachState: "UNKNOWN",
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
    });

    expect(result).toBe("CAUSE_NOT_DETERMINABLE");
  });

  it("flag ABSENT but a usable input exists (e.g. reach AVAILABLE) resolves neither — a score is computable, so this is not an absence case", () => {
    const result = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: undefined,
      reachState: "AVAILABLE",
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
    });

    expect(result).toBeNull();
  });

  it("a corroborated ZERO counts as a usable input (R-4.3.1) — flag absent + ZERO reach resolves neither reason", () => {
    const result = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: undefined,
      reachState: "ZERO",
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
    });

    expect(result).toBeNull();
  });

  it("flag EXPLICITLY false with no usable inputs resolves neither reason — we KNOW it isn't hidden, so R-13.5.3's 'cannot tell' does not apply; #143's other resolvers own this case", () => {
    const result = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: false,
      reachState: "UNKNOWN",
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
    });

    expect(result).toBeNull();
  });
});

/**
 * AC-30's negative assertion (PRD S9 example (c)): the `CAUSE_NOT_DETERMINABLE`
 * row must render string 3, and it must NOT assert that the creator hid
 * their counts. A test that only checked `result !== null` would pass on a
 * mapping that silently collapsed both reasons to the same string — this
 * asserts the actual rendered strings, and their inequality, which is what
 * a wrong mapping breaks.
 */
describe("renderHiddenCountsReasonShortForm — AC-30, DESIGN-3B §5 rows 1 and 3", () => {
  it("REACH_HIDDEN renders DESIGN-3B row 1's exact L1 string", () => {
    expect(renderHiddenCountsReasonShortForm("REACH_HIDDEN")).toBe("Creator hid the counts");
  });

  it("CAUSE_NOT_DETERMINABLE renders DESIGN-3B row 3's exact L1 string — string 3, not string 1", () => {
    expect(renderHiddenCountsReasonShortForm("CAUSE_NOT_DETERMINABLE")).toBe(
      "No performance data published",
    );
  });

  it("negative assertion (AC-30) — the CAUSE_NOT_DETERMINABLE string never asserts the creator hid their counts", () => {
    const rendered = renderHiddenCountsReasonShortForm("CAUSE_NOT_DETERMINABLE");

    expect(rendered).not.toBe(renderHiddenCountsReasonShortForm("REACH_HIDDEN"));
    expect(rendered).not.toMatch(/hid/i);
    expect(rendered).not.toMatch(/creator/i);
  });

  it("the two reasons produce two DIFFERENT strings end to end (resolve -> render)", () => {
    const hidden = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: true,
      reachState: "UNKNOWN",
      likeState: "HIDDEN",
      commentState: "UNKNOWN",
    });
    const notDeterminable = resolveHiddenCountsUnavailableReason({
      likeAndViewCountsDisabled: undefined,
      reachState: "UNKNOWN",
      likeState: "UNKNOWN",
      commentState: "UNKNOWN",
    });

    expect(hidden).not.toBeNull();
    expect(notDeterminable).not.toBeNull();
    expect(renderHiddenCountsReasonShortForm(hidden!)).not.toBe(
      renderHiddenCountsReasonShortForm(notDeterminable!),
    );
  });
});
