import { describe, expect, it } from "vitest";
import {
  assertNumeralsAreReal,
  assertPerformanceProseIsSafe,
  assertQualifiedPercentages,
  NumeralFabricationError,
  ProseQualifierError,
} from "@/lib/server/analysis/prose";
import type { ComputedPerformanceBlock } from "@/lib/server/analysis/prose";

describe("assertQualifiedPercentages (TDD §8.2, Half B)", () => {
  it("throws on a bare, unqualified percentage — comma decimal", () => {
    expect(() => assertQualifiedPercentages("Engagementnya cukup tinggi, sekitar 4,1% untuk konten ini.")).toThrow(
      ProseQualifierError,
    );
  });

  it("throws on a bare, unqualified percentage — dot decimal (drifted generation)", () => {
    expect(() => assertQualifiedPercentages("Engagementnya sekitar 4.1% untuk konten ini.")).toThrow(
      ProseQualifierError,
    );
  });

  it("passes a percentage qualified with a reach/views denominator phrase", () => {
    expect(() => assertQualifiedPercentages("Engagement 4,1% dari 482,1RB penayangan, cukup solid.")).not.toThrow();
  });

  it("passes a percentage qualified with a followers denominator phrase", () => {
    expect(() => assertQualifiedPercentages("Rasio engagement 2,3% dari jumlah pengikut kreator.")).not.toThrow();
  });

  it("passes a percentage qualified with a plays denominator phrase", () => {
    expect(() => assertQualifiedPercentages("Engagement 5,0% dari 100RB yang menonton video ini.")).not.toThrow();
  });

  it("does not qualify off a denominator phrase more than 40 characters away", () => {
    const farAway = "penayangan".padStart(60, "x"); // padding pushes the keyword well past the 40-char window
    expect(() => assertQualifiedPercentages(`Engagement 4,1% ${farAway}`)).toThrow(ProseQualifierError);
  });
});

describe("assertNumeralsAreReal (S2/AC-7, Half B)", () => {
  // This is an arbitrary, hand-picked block for unit-testing the guard in
  // isolation — NOT a claim that `[4.1, 482100]` is the exact array
  // `resolvePerformanceAssessment()` emits for any one post. A real
  // `ANGKA_ENGAGEMENT` block for a reach-denominated post can carry several
  // numerals at once (e.g. `[4.1, 482.1]` for the abbreviated `"482,1RB"`
  // form), so `[4.1, 482100]` is at most a SUBSET of a producible block's
  // shape, and its second element (the raw, non-abbreviated count) would
  // not actually co-occur with `4.1` in the same `angka` string — see
  // `user.engagementLabel.test.ts`'s "Half A narrowing" suite for the
  // integration-level proof against the real `computePerformanceAssessmentBlock()`.
  const block: ComputedPerformanceBlock = { realNumerals: [4.1, 482100] };

  it("passes when every numeral in the text matches the computed block", () => {
    expect(() => assertNumeralsAreReal("Engagement 4,1% dari 482.100 penayangan.", block)).not.toThrow();
  });

  it("throws on a fabricated numeral absent from the computed block — non-vacuity proof", () => {
    // 9,9 is nowhere in `block.realNumerals` — proves the extractor is not
    // silently passing everything.
    expect(() => assertNumeralsAreReal("Performanya luar biasa, naik 9,9% dibanding biasanya.", block)).toThrow(
      NumeralFabricationError,
    );
  });

  it("does not trip on the OR-10 allow-listed BASELINE_MIN_SAMPLE (5) even with an empty computed block", () => {
    expect(() => assertNumeralsAreReal("Baseline ini didasarkan pada 5 video sebelumnya.", { realNumerals: [] })).not.toThrow();
  });

  it("does not trip on the OR-10 allow-listed cache TTL numeral even with an empty computed block", () => {
    expect(() => assertNumeralsAreReal("Data audiens diambil 7 hari lalu.", { realNumerals: [] })).not.toThrow();
  });

  it("respects the 1-decimal-place tolerance for a non-integer figure", () => {
    expect(() => assertNumeralsAreReal("Engagement 4,12% dari reach.", { realNumerals: [4.1] })).not.toThrow();
  });

  it("requires an exact match for an integer count", () => {
    expect(() => assertNumeralsAreReal("482.101 penayangan.", { realNumerals: [482100] })).toThrow(
      NumeralFabricationError,
    );
  });
});

describe("assertPerformanceProseIsSafe — orchestrates both guards over verdict + drivers[]", () => {
  const block: ComputedPerformanceBlock = { realNumerals: [4.1, 482100] };

  it("passes when verdict and every driver are qualified and real", () => {
    expect(() =>
      assertPerformanceProseIsSafe(
        {
          verdict: "Performa solid dengan engagement 4,1% dari 482.100 penayangan.",
          drivers: ["Hook cukup kuat sejak awal.", "Engagement 4,1% dari 482.100 penayangan mendukung skor ini."],
        },
        block,
      ),
    ).not.toThrow();
  });

  it("throws when a driver carries a bare unqualified percentage even if verdict is clean", () => {
    expect(() =>
      assertPerformanceProseIsSafe(
        {
          verdict: "Performa solid dengan engagement 4,1% dari 482.100 penayangan.",
          drivers: ["Konten ini memiliki engagement 9,9%."],
        },
        block,
      ),
    ).toThrow(ProseQualifierError);
  });
});
