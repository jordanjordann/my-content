import { describe, expect, it } from "vitest";

import { selectFingerprint } from "@/lib/api/fingerprint/hooks";
import type { FingerprintView } from "@/lib/api/fingerprint/types";

/**
 * Ticket #117 code-review fix (PR #122) — `selectFingerprint`'s "found" branch must
 * precompute the per-distribution top values inside `select` itself (AGENTS.md's
 * data-transformation rule: "all derivation goes in `select`"), not hand the caller a
 * raw `topDistributionValue` function reference to invoke later at render time.
 */

const VIEW_FIXTURE: FingerprintView = {
  topicNicheDistribution: [
    { value: "FINANCE", count: 4, share: 0.8 },
    { value: "FITNESS", count: 1, share: 0.2 },
  ],
  formatArchetypeDistribution: [],
  hookTypeDistribution: [{ value: "QUESTION", count: 3, share: 0.6 }],
  ctaTypeDistribution: [{ value: "FOLLOW", count: 5, share: 1 }],
  ctaTimingDistribution: [{ value: "END", count: 5, share: 1 }],
  pacingDistribution: [{ value: "FAST", count: 2, share: 0.4 }],
  audienceCalloutRate: 0.6,
  medianCutsPerMinute: 12,
  typicalBeatSequence: [],
  medianBeatCount: 5,
  verbalTonePatterns: [{ value: "CASUAL", count: 4, share: 0.8 }],
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
  overriddenKeys: ["verbalTonePatterns"],
};

describe("selectFingerprint", () => {
  it("precomputes topValues as concrete values, not a function reference, for a found view", () => {
    const selection = selectFingerprint(VIEW_FIXTURE);

    if (selection.status !== "found") {
      throw new Error("expected a found selection");
    }

    expect(selection.topValues).toEqual({
      topicNiche: "FINANCE",
      formatArchetype: null,
      hookType: "QUESTION",
      ctaType: "FOLLOW",
      ctaTiming: "END",
      pacing: "FAST",
      verbalTone: "CASUAL",
    });
    expect(selection).not.toHaveProperty("topDistributionValue");
    for (const value of Object.values(selection.topValues)) {
      expect(typeof value).not.toBe("function");
    }
  });

  it("returns the absence unchanged for a 404 result", () => {
    const absence = { error: "Profile not found.", reason: "PROFILE_NOT_FOUND" as const };

    const selection = selectFingerprint(absence);

    expect(selection).toEqual({ status: "absent", absence });
  });
});
