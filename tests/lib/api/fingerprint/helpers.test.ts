import { describe, expect, it } from "vitest";

import { isFingerprintAbsence, toOverriddenKeySet, topDistributionValue } from "@/lib/api/fingerprint/helpers";
import type { FingerprintView } from "@/lib/api/fingerprint/types";

/**
 * Ticket #117 — table-driven tests for the pure helpers `hooks.ts`'s `select` composes
 * (TDD §6, `docs/archive/specs/TDD-fingerprint-read-override-api.md`). Nothing under test is mocked.
 */

function makeView(overrides: Partial<FingerprintView> = {}): FingerprintView {
  return {
    topicNicheDistribution: [],
    formatArchetypeDistribution: [],
    hookTypeDistribution: [],
    ctaTypeDistribution: [],
    ctaTimingDistribution: [],
    pacingDistribution: [],
    audienceCalloutRate: 0.6,
    medianCutsPerMinute: 12,
    typicalBeatSequence: [],
    medianBeatCount: 5,
    verbalTonePatterns: [],
    captionStyleExemplars: [],
    hookTextExemplars: [],
    onScreenTextExemplars: [],
    sampleSize: 5,
    sourceAnalysisIds: ["a1", "a2", "a3", "a4", "a5"],
    dateRange: { earliest: "2026-05-01", latest: "2026-07-20" },
    profileId: "profile-1",
    fingerprintVersion: 1,
    schemaVersion: 2,
    consistencyIndex: 0.71,
    computedAt: "2026-07-25 02:51:00",
    createdAt: "2026-07-01 00:00:00",
    updatedAt: "2026-07-25 02:51:00",
    overriddenKeys: [],
    ...overrides,
  };
}

describe("isFingerprintAbsence", () => {
  it("is false for a found FingerprintView (no reason field)", () => {
    expect(isFingerprintAbsence(makeView())).toBe(false);
  });

  it("is true for a PROFILE_NOT_FOUND 404 body", () => {
    expect(
      isFingerprintAbsence({ error: "Profile not found.", reason: "PROFILE_NOT_FOUND" }),
    ).toBe(true);
  });

  it("is true for a NO_FINGERPRINT 404 body", () => {
    expect(
      isFingerprintAbsence({
        error: "No fingerprint available for this profile yet.",
        reason: "NO_FINGERPRINT",
        analysisCount: 3,
        required: 5,
      }),
    ).toBe(true);
  });
});

describe("toOverriddenKeySet", () => {
  it("wraps overriddenKeys in a Set for O(1) lookups", () => {
    const set = toOverriddenKeySet(makeView({ overriddenKeys: ["verbalTonePatterns", "medianBeatCount"] }));
    expect(set.has("verbalTonePatterns")).toBe(true);
    expect(set.has("medianBeatCount")).toBe(true);
    expect(set.has("pacingDistribution")).toBe(false);
  });

  it("returns an empty Set when nothing is overridden", () => {
    expect(toOverriddenKeySet(makeView({ overriddenKeys: [] })).size).toBe(0);
  });
});

describe("topDistributionValue", () => {
  it("returns null for an empty distribution", () => {
    expect(topDistributionValue([])).toBeNull();
  });

  it("returns the value with the highest share", () => {
    expect(
      topDistributionValue([
        { value: "FASHION", count: 1, share: 0.2 },
        { value: "FINANCE", count: 4, share: 0.8 },
      ]),
    ).toBe("FINANCE");
  });

  it("keeps the first-encountered entry on a share tie", () => {
    expect(
      topDistributionValue([
        { value: "FIRST", count: 2, share: 0.5 },
        { value: "SECOND", count: 2, share: 0.5 },
      ]),
    ).toBe("FIRST");
  });
});
