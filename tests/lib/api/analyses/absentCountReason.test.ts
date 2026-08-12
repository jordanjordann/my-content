import { describe, expect, it } from "vitest";

import { deriveAbsentCountReason } from "@/lib/api/analyses/helpers";
import { ABSENT_COUNT_REASON_COPY } from "@/lib/api/analyses/constants";

/**
 * Ticket #146 / OR-11 (TDD §9.5) — the three-case absent-count reason. Calls the REAL
 * `deriveAbsentCountReason` exported from `lib/api/analyses/helpers.ts` directly — nothing
 * under test is mocked. Case 3 (`NOT_AVAILABLE`) is the mandatory non-fallback default; a
 * negative assertion (never "turned off") is required, not just presence.
 *
 * PR #200 review, blocker B1 — case 2 is gated on `unavailableReason ===
 * "CONTENT_KIND_UNSUPPORTED"` (OR-26, `docs/TDD-3A-3B-3C-phase-3.md:126`), never on the
 * overloaded `mediaType === "carousel" && reach.derivedFrom === "NONE"` combination that also
 * matches a mixed image+video carousel.
 */
describe("deriveAbsentCountReason", () => {
  it("case 1 — likeAndViewCountsDisabled === true (explicitly) is CREATOR_DISABLED, even when the reason is CONTENT_KIND_UNSUPPORTED", () => {
    expect(
      deriveAbsentCountReason({
        unavailableReason: "CONTENT_KIND_UNSUPPORTED",
        likeAndViewCountsDisabled: true,
      }),
    ).toBe("CREATOR_DISABLED");
  });

  it("case 2 — unavailableReason CONTENT_KIND_UNSUPPORTED (an all-image carousel/single-image post) with the flag not true is TYPE_NOT_REPORTED", () => {
    expect(
      deriveAbsentCountReason({
        unavailableReason: "CONTENT_KIND_UNSUPPORTED",
        likeAndViewCountsDisabled: false,
      }),
    ).toBe("TYPE_NOT_REPORTED");
  });

  it("case 2 also fires when the flag is null (unknown/never fetched), not just false", () => {
    expect(
      deriveAbsentCountReason({
        unavailableReason: "CONTENT_KIND_UNSUPPORTED",
        likeAndViewCountsDisabled: null,
      }),
    ).toBe("TYPE_NOT_REPORTED");
  });

  it("case 3 — a mixed image+video carousel (unavailableReason REACH_NOT_ON_FIRST_SLIDE) is NOT_AVAILABLE, never TYPE_NOT_REPORTED — the post DOES contain video and DOES report counts (B1, OR-26)", () => {
    expect(
      deriveAbsentCountReason({
        unavailableReason: "REACH_NOT_ON_FIRST_SLIDE",
        likeAndViewCountsDisabled: false,
      }),
    ).toBe("NOT_AVAILABLE");
  });

  it("case 3 — unavailableReason null (reach resolved, or no reason recorded) is NOT_AVAILABLE-eligible territory too: it is not CONTENT_KIND_UNSUPPORTED", () => {
    expect(
      deriveAbsentCountReason({
        unavailableReason: null,
        likeAndViewCountsDisabled: false,
      }),
    ).toBe("NOT_AVAILABLE");
  });

  it("case 3 is the mandatory non-fallback default — a row with likeAndViewCountsDisabled === false never lands in case 1", () => {
    const result = deriveAbsentCountReason({
      unavailableReason: "REACH_HIDDEN",
      likeAndViewCountsDisabled: false,
    });
    expect(result).not.toBe("CREATOR_DISABLED");
    expect(["TYPE_NOT_REPORTED", "NOT_AVAILABLE"]).toContain(result);
  });

  it("all three cases produce distinct strings", () => {
    const strings = new Set(Object.values(ABSENT_COUNT_REASON_COPY));
    expect(strings.size).toBe(3);
  });

  it("case 3's copy never contains 'turned off' — a fetch failure must never be diagnosed as deliberate creator action", () => {
    expect(ABSENT_COUNT_REASON_COPY.NOT_AVAILABLE.toLowerCase()).not.toContain("turned off");
    expect(ABSENT_COUNT_REASON_COPY.NOT_AVAILABLE).toBe("Counts weren't available");
  });

  it("copy matches the TDD's exact strings verbatim, for all three cases", () => {
    expect(ABSENT_COUNT_REASON_COPY.CREATOR_DISABLED).toBe("Creator turned off counts");
    expect(ABSENT_COUNT_REASON_COPY.TYPE_NOT_REPORTED).toBe("This post type doesn't report counts");
    expect(ABSENT_COUNT_REASON_COPY.NOT_AVAILABLE).toBe("Counts weren't available");
  });
});
