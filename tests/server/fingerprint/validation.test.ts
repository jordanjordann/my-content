import { describe, expect, it } from "vitest";
import { validateOverridePatch } from "@/lib/server/fingerprint/validation";
import type { ComputedFingerprint } from "@/lib/server/fingerprint/types";

/**
 * Direct unit coverage for `validateOverridePatch`'s D4 validators (code
 * review follow-up on PR #120 / ticket #115). `overrides.test.ts` exercises
 * the enum guard, the unknown-key path, and the exemplar-subset rule
 * end-to-end via `applyFingerprintOverridePatch`; this file covers the
 * remaining pure-function branches directly, without needing a database.
 */

function baseComputed(overrides: Partial<ComputedFingerprint> = {}): ComputedFingerprint {
  return {
    topicNicheDistribution: [{ value: "FOOD_CULINARY", count: 5, share: 1 }],
    formatArchetypeDistribution: [{ value: "TALKING_HEAD", count: 5, share: 1 }],
    hookTypeDistribution: [{ value: "DIRECT_VALUE_PROMISE", count: 5, share: 1 }],
    ctaTypeDistribution: [{ value: "FOLLOW", count: 5, share: 1 }],
    ctaTimingDistribution: [{ value: "END", count: 5, share: 1 }],
    pacingDistribution: [{ value: "MEDIUM", count: 5, share: 1 }],
    audienceCalloutRate: 0.4,
    medianCutsPerMinute: 10,
    typicalBeatSequence: ["HOOK", "BODY_PROOF"],
    medianBeatCount: 3,
    verbalTonePatterns: [{ value: "santai", count: 5, share: 1 }],
    captionStyleExemplars: ["exemplar a", "exemplar b"],
    hookTextExemplars: ["hook a"],
    onScreenTextExemplars: ["text a"],
    sampleSize: 5,
    sourceAnalysisIds: ["id-1", "id-2", "id-3", "id-4", "id-5"],
    dateRange: { earliest: "2026-01-01T00:00:00.000Z", latest: "2026-02-01T00:00:00.000Z" },
    ...overrides,
  };
}

describe("validateOverridePatch — Σshare tolerance", () => {
  it("accepts a distribution whose shares sum to exactly 1", () => {
    const computed = baseComputed();
    const result = validateOverridePatch(
      { pacingDistribution: [{ value: "SLOW", count: 2, share: 0.5 }, { value: "FAST", count: 2, share: 0.5 }] },
      computed,
    );
    expect(result).toEqual({ ok: true });
  });

  it("accepts a distribution within the documented ±0.01 tolerance", () => {
    const computed = baseComputed();
    const result = validateOverridePatch(
      { pacingDistribution: [{ value: "SLOW", count: 2, share: 0.995 }, { value: "FAST", count: 2, share: 0.005 }] },
      computed,
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a distribution whose shares sum outside ±0.01", () => {
    const computed = baseComputed();
    const result = validateOverridePatch(
      { pacingDistribution: [{ value: "SLOW", count: 2, share: 0.5 }, { value: "FAST", count: 2, share: 0.3 }] },
      computed,
    );
    expect(result).toEqual({ ok: false, invalidKeys: ["pacingDistribution"] });
  });

  it("accepts an empty distribution (the non-empty gate skips the sum check)", () => {
    const computed = baseComputed();
    const result = validateOverridePatch({ pacingDistribution: [] }, computed);
    expect(result).toEqual({ ok: true });
  });
});

describe("validateOverridePatch — duplicate `value` entries", () => {
  it("rejects a distribution with a duplicate value even if shares are otherwise valid", () => {
    const computed = baseComputed();
    const result = validateOverridePatch(
      {
        pacingDistribution: [
          { value: "SLOW", count: 1, share: 0.5 },
          { value: "SLOW", count: 1, share: 0.5 },
        ],
      },
      computed,
    );
    expect(result).toEqual({ ok: false, invalidKeys: ["pacingDistribution"] });
  });
});

describe("validateOverridePatch — dateRange", () => {
  it("accepts a well-formed range with earliest before latest", () => {
    const computed = baseComputed();
    const result = validateOverridePatch(
      { dateRange: { earliest: "2026-01-01T00:00:00.000Z", latest: "2026-02-01T00:00:00.000Z" } },
      computed,
    );
    expect(result).toEqual({ ok: true });
  });

  it("accepts both sides null", () => {
    const computed = baseComputed();
    const result = validateOverridePatch({ dateRange: { earliest: null, latest: null } }, computed);
    expect(result).toEqual({ ok: true });
  });

  it("rejects earliest after latest", () => {
    const computed = baseComputed();
    const result = validateOverridePatch(
      { dateRange: { earliest: "2026-03-01T00:00:00.000Z", latest: "2026-02-01T00:00:00.000Z" } },
      computed,
    );
    expect(result).toEqual({ ok: false, invalidKeys: ["dateRange"] });
  });

  it("rejects a non-ISO-parseable string", () => {
    const computed = baseComputed();
    const result = validateOverridePatch(
      { dateRange: { earliest: "not-a-date", latest: null } },
      computed,
    );
    expect(result).toEqual({ ok: false, invalidKeys: ["dateRange"] });
  });

  it("rejects an object missing one of the two required keys", () => {
    const computed = baseComputed();
    const result = validateOverridePatch({ dateRange: { earliest: null } }, computed);
    expect(result).toEqual({ ok: false, invalidKeys: ["dateRange"] });
  });
});

describe("validateOverridePatch — typicalBeatSequence", () => {
  it("accepts an array of known beat types", () => {
    const computed = baseComputed();
    const result = validateOverridePatch({ typicalBeatSequence: ["HOOK", "SETUP"] }, computed);
    expect(result).toEqual({ ok: true });
  });

  it("accepts an empty array", () => {
    const computed = baseComputed();
    const result = validateOverridePatch({ typicalBeatSequence: [] }, computed);
    expect(result).toEqual({ ok: true });
  });

  it("rejects an array containing an unknown beat type", () => {
    const computed = baseComputed();
    const result = validateOverridePatch({ typicalBeatSequence: ["HOOK", "NOT_A_BEAT"] }, computed);
    expect(result).toEqual({ ok: false, invalidKeys: ["typicalBeatSequence"] });
  });
});

describe("validateOverridePatch — median positivity", () => {
  it("accepts a positive medianCutsPerMinute", () => {
    const computed = baseComputed();
    expect(validateOverridePatch({ medianCutsPerMinute: 12 }, computed)).toEqual({ ok: true });
  });

  it("rejects a zero medianCutsPerMinute", () => {
    const computed = baseComputed();
    expect(validateOverridePatch({ medianCutsPerMinute: 0 }, computed)).toEqual({
      ok: false,
      invalidKeys: ["medianCutsPerMinute"],
    });
  });

  it("rejects a negative medianBeatCount", () => {
    const computed = baseComputed();
    expect(validateOverridePatch({ medianBeatCount: -1 }, computed)).toEqual({
      ok: false,
      invalidKeys: ["medianBeatCount"],
    });
  });

  it("accepts a positive medianBeatCount", () => {
    const computed = baseComputed();
    expect(validateOverridePatch({ medianBeatCount: 4 }, computed)).toEqual({ ok: true });
  });

  it("null is still valid for both (D3/D4: null always means delete)", () => {
    const computed = baseComputed();
    expect(validateOverridePatch({ medianCutsPerMinute: null, medianBeatCount: null }, computed)).toEqual({
      ok: true,
    });
  });
});

describe("validateOverridePatch — consistencyIndex range", () => {
  it("accepts 0 and 1 (inclusive bounds)", () => {
    const computed = baseComputed();
    expect(validateOverridePatch({ consistencyIndex: 0 }, computed)).toEqual({ ok: true });
    expect(validateOverridePatch({ consistencyIndex: 1 }, computed)).toEqual({ ok: true });
  });

  it("rejects a value above 1", () => {
    const computed = baseComputed();
    expect(validateOverridePatch({ consistencyIndex: 1.01 }, computed)).toEqual({
      ok: false,
      invalidKeys: ["consistencyIndex"],
    });
  });

  it("rejects a negative value", () => {
    const computed = baseComputed();
    expect(validateOverridePatch({ consistencyIndex: -0.01 }, computed)).toEqual({
      ok: false,
      invalidKeys: ["consistencyIndex"],
    });
  });
});

describe("validateOverridePatch — exemplar subset is multiset/count-aware (review follow-up)", () => {
  it("rejects a patch that duplicates a computed exemplar beyond its available count", () => {
    const computed = baseComputed({ hookTextExemplars: ["a"] });
    const result = validateOverridePatch({ hookTextExemplars: ["a", "a", "a"] }, computed);
    expect(result).toEqual({ ok: false, invalidKeys: ["hookTextExemplars"] });
  });

  it("accepts a patch that repeats a value no more times than it appears in computed", () => {
    const computed = baseComputed({ captionStyleExemplars: ["a", "a", "b"] });
    const result = validateOverridePatch({ captionStyleExemplars: ["a", "a"] }, computed);
    expect(result).toEqual({ ok: true });
  });

  it("rejects a patch requesting more copies than computed has, even when computed has some duplicates", () => {
    const computed = baseComputed({ captionStyleExemplars: ["a", "a", "b"] });
    const result = validateOverridePatch({ captionStyleExemplars: ["a", "a", "a"] }, computed);
    expect(result).toEqual({ ok: false, invalidKeys: ["captionStyleExemplars"] });
  });

  it("accepts pruning and reordering with no duplication", () => {
    const computed = baseComputed({ onScreenTextExemplars: ["a", "b", "c"] });
    const result = validateOverridePatch({ onScreenTextExemplars: ["c", "a"] }, computed);
    expect(result).toEqual({ ok: true });
  });
});
