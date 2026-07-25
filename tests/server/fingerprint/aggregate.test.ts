import { describe, expect, it } from "vitest";
import { aggregateStyleFingerprint } from "@/lib/server/fingerprint/aggregate";
import type { FingerprintSourceAnalysis } from "@/lib/server/fingerprint/types";
import type { StyleAttributes } from "@/lib/server/analysis/types";

/**
 * `aggregate.ts` is pure TypeScript (ticket #72, Step 4) — these tests hand
 * build `StyleAttributes[]` in-memory. No DB, no fixtures, no network.
 */

function buildStyle(overrides: Partial<StyleAttributes> = {}): StyleAttributes {
  return {
    topicNiche: "FOOD_CULINARY",
    topicSubtopic: "resep cepat",
    formatArchetype: "TALKING_HEAD",
    hookType: "DIRECT_VALUE_PROMISE",
    hookTypeSecondary: null,
    hasAudienceCallout: false,
    hookText: "Ini resep favoritku",
    structureBeatMap: [
      { timestampSec: 0, beatType: "HOOK", description: "pembuka" },
      { timestampSec: 5, beatType: "BODY_PROOF", description: "isi" },
      { timestampSec: 20, beatType: "CTA", description: "penutup" },
    ],
    pacing: "MEDIUM",
    estimatedCutsPerMinute: 10,
    ctaType: ["FOLLOW"],
    ctaTiming: "END",
    onScreenText: ["Resep hari ini"],
    captionStyleNotes: "Gaya santai dengan emoji",
    verbalTonePatterns: ["Santai", "  Ramah "],
    ...overrides,
  };
}

function buildSource(id: string, postDate: string | null, style: Partial<StyleAttributes> = {}): FingerprintSourceAnalysis {
  return { id, postDate, style: buildStyle(style) };
}

describe("aggregateStyleFingerprint", () => {
  it("scores consistencyIndex = 1 for a perfectly uniform creator (same formatArchetype/hookType/ctaType/pacing every video)", () => {
    const sources = [
      buildSource("a1", "2026-01-01"),
      buildSource("a2", "2026-01-02"),
      buildSource("a3", "2026-01-03"),
      buildSource("a4", "2026-01-04"),
      buildSource("a5", "2026-01-05"),
    ];

    const { consistencyIndex } = aggregateStyleFingerprint(sources);
    expect(consistencyIndex).toBe(1);
  });

  it("approaches 0 for a maximally scattered creator (every dimension a distinct value each time)", () => {
    const sources: FingerprintSourceAnalysis[] = [
      buildSource("a1", null, {
        formatArchetype: "TALKING_HEAD",
        hookType: "DIRECT_VALUE_PROMISE",
        ctaType: ["FOLLOW"],
        pacing: "SLOW",
      }),
      buildSource("a2", null, {
        formatArchetype: "VOICEOVER_BROLL",
        hookType: "NUMBERED_LIST",
        ctaType: ["COMMENT_PROMPT"],
        pacing: "MEDIUM",
      }),
      buildSource("a3", null, {
        formatArchetype: "POV_SKIT",
        hookType: "CURIOSITY_QUESTION",
        ctaType: ["SAVE_PROMPT"],
        pacing: "FAST",
      }),
      buildSource("a4", null, {
        formatArchetype: "TUTORIAL_DEMO",
        hookType: "SIDE_BY_SIDE_COMPARISON",
        ctaType: ["SHARE_PROMPT"],
        pacing: "MIXED",
      }),
      buildSource("a5", null, {
        formatArchetype: "PRODUCT_REVIEW",
        hookType: "MYTH_CORRECTION",
        ctaType: ["LINK_IN_BIO"],
        pacing: "SLOW",
      }),
    ];

    const { consistencyIndex } = aggregateStyleFingerprint(sources);
    // 5 distinct values across 5 observations on 3 of the 4 dimensions
    // (pacing repeats SLOW once) scores low but not necessarily exactly 0 —
    // assert "close to the scattered end", not a brittle exact figure.
    expect(consistencyIndex).toBeLessThan(0.3);
    expect(consistencyIndex).toBeGreaterThanOrEqual(0);
  });

  it("counts hookType primary and secondary at equal weight in the distribution", () => {
    const sources = [
      buildSource("a1", null, { hookType: "DIRECT_VALUE_PROMISE", hookTypeSecondary: "NUMBERED_LIST" }),
      buildSource("a2", null, { hookType: "DIRECT_VALUE_PROMISE", hookTypeSecondary: null }),
    ];

    const { computed } = aggregateStyleFingerprint(sources);
    // 3 total instances: DIRECT_VALUE_PROMISE x2, NUMBERED_LIST x1.
    const directValue = computed.hookTypeDistribution.find((e) => e.value === "DIRECT_VALUE_PROMISE");
    const numberedList = computed.hookTypeDistribution.find((e) => e.value === "NUMBERED_LIST");
    expect(directValue).toEqual({ value: "DIRECT_VALUE_PROMISE", count: 2, share: 2 / 3 });
    expect(numberedList).toEqual({ value: "NUMBERED_LIST", count: 1, share: 1 / 3 });
  });

  it("uses hookType PRIMARY ONLY (not secondary) for consistencyIndex, unlike the distribution", () => {
    // Every video shares the same primary hookType; secondaries vary wildly.
    // If consistencyIndex accidentally counted secondaries, this would drag
    // the score down — it must not.
    const sources = [
      buildSource("a1", null, { hookType: "DIRECT_VALUE_PROMISE", hookTypeSecondary: "NUMBERED_LIST" }),
      buildSource("a2", null, { hookType: "DIRECT_VALUE_PROMISE", hookTypeSecondary: "CURIOSITY_QUESTION" }),
      buildSource("a3", null, { hookType: "DIRECT_VALUE_PROMISE", hookTypeSecondary: "MYTH_CORRECTION" }),
      buildSource("a4", null, { hookType: "DIRECT_VALUE_PROMISE", hookTypeSecondary: null }),
      buildSource("a5", null, { hookType: "DIRECT_VALUE_PROMISE", hookTypeSecondary: null }),
    ];

    const { consistencyIndex } = aggregateStyleFingerprint(sources);
    expect(consistencyIndex).toBe(1);
  });

  it("computes medianCutsPerMinute as a median (not mean) — one 90-cut montage does not drag the score", () => {
    const sources = [
      buildSource("a1", null, { estimatedCutsPerMinute: 8 }),
      buildSource("a2", null, { estimatedCutsPerMinute: 9 }),
      buildSource("a3", null, { estimatedCutsPerMinute: 10 }),
      buildSource("a4", null, { estimatedCutsPerMinute: 11 }),
      buildSource("a5", null, { estimatedCutsPerMinute: 90 }),
    ];

    const { computed } = aggregateStyleFingerprint(sources);
    expect(computed.medianCutsPerMinute).toBe(10);
  });

  it("excludes null estimatedCutsPerMinute values from the median", () => {
    const sources = [
      buildSource("a1", null, { estimatedCutsPerMinute: null }),
      buildSource("a2", null, { estimatedCutsPerMinute: null }),
      buildSource("a3", null, { estimatedCutsPerMinute: 6 }),
    ];

    const { computed } = aggregateStyleFingerprint(sources);
    expect(computed.medianCutsPerMinute).toBe(6);
  });

  it("normalises verbalTonePatterns (trim + lowercase) into a ranked distribution", () => {
    const sources = [
      buildSource("a1", null, { verbalTonePatterns: ["Santai", "  Ramah "] }),
      buildSource("a2", null, { verbalTonePatterns: ["santai"] }),
    ];

    const { computed } = aggregateStyleFingerprint(sources);
    expect(computed.verbalTonePatterns[0]).toEqual({ value: "santai", count: 2, share: 2 / 3 });
    expect(computed.verbalTonePatterns.map((e) => e.value)).toContain("ramah");
  });

  it("keeps captionStyleExemplars, hookTextExemplars, onScreenTextExemplars verbatim (no synthesis)", () => {
    const sources = [
      buildSource("a1", null, {
        captionStyleNotes: "Nada santai penuh emoji 🍜",
        hookText: "Kamu pasti belum tahu ini!",
        onScreenText: ["STEP 1", "STEP 2"],
      }),
    ];

    const { computed } = aggregateStyleFingerprint(sources);
    expect(computed.captionStyleExemplars).toEqual(["Nada santai penuh emoji 🍜"]);
    expect(computed.hookTextExemplars).toEqual(["Kamu pasti belum tahu ini!"]);
    expect(computed.onScreenTextExemplars).toEqual(["STEP 1", "STEP 2"]);
  });

  it("finds the most common ordered beat sequence and the median beat count", () => {
    const threeBeat = [
      { timestampSec: 0, beatType: "HOOK" as const, description: "a" },
      { timestampSec: 5, beatType: "BODY_PROOF" as const, description: "b" },
      { timestampSec: 20, beatType: "CTA" as const, description: "c" },
    ];
    const twoBeat = [
      { timestampSec: 0, beatType: "HOOK" as const, description: "a" },
      { timestampSec: 5, beatType: "CTA" as const, description: "b" },
    ];

    const sources = [
      buildSource("a1", null, { structureBeatMap: threeBeat }),
      buildSource("a2", null, { structureBeatMap: threeBeat }),
      buildSource("a3", null, { structureBeatMap: twoBeat }),
    ];

    const { computed } = aggregateStyleFingerprint(sources);
    expect(computed.typicalBeatSequence).toEqual(["HOOK", "BODY_PROOF", "CTA"]);
    expect(computed.medianBeatCount).toBe(3);
  });

  it("computes audienceCalloutRate as a plain share of videos with hasAudienceCallout true", () => {
    const sources = [
      buildSource("a1", null, { hasAudienceCallout: true }),
      buildSource("a2", null, { hasAudienceCallout: true }),
      buildSource("a3", null, { hasAudienceCallout: false }),
      buildSource("a4", null, { hasAudienceCallout: false }),
    ];

    const { computed } = aggregateStyleFingerprint(sources);
    expect(computed.audienceCalloutRate).toBe(0.5);
  });

  it("flattens ctaType as a multiset across videos, not a single-valued distribution", () => {
    const sources = [
      buildSource("a1", null, { ctaType: ["FOLLOW", "COMMENT_PROMPT"] }),
      buildSource("a2", null, { ctaType: ["FOLLOW"] }),
    ];

    const { computed } = aggregateStyleFingerprint(sources);
    const follow = computed.ctaTypeDistribution.find((e) => e.value === "FOLLOW");
    const comment = computed.ctaTypeDistribution.find((e) => e.value === "COMMENT_PROMPT");
    expect(follow).toEqual({ value: "FOLLOW", count: 2, share: 2 / 3 });
    expect(comment).toEqual({ value: "COMMENT_PROMPT", count: 1, share: 1 / 3 });
  });

  it("carries provenance: sampleSize, sourceAnalysisIds (in input order), and dateRange", () => {
    const sources = [buildSource("a1", "2026-01-05"), buildSource("a2", "2026-01-01"), buildSource("a3", null)];

    const { computed } = aggregateStyleFingerprint(sources);
    expect(computed.sampleSize).toBe(3);
    expect(computed.sourceAnalysisIds).toEqual(["a1", "a2", "a3"]);
    expect(computed.dateRange).toEqual({ earliest: "2026-01-01", latest: "2026-01-05" });
  });

  it("never lets consistencyIndex feed back into any distribution or exemplar (descriptive only)", () => {
    // Two runs over the same corpus in different array orders must produce
    // identical distributions/exemplars — nothing is re-ranked by the index.
    const sources = [buildSource("a1", null), buildSource("a2", null, { formatArchetype: "VOICEOVER_BROLL" })];
    const reversed = [...sources].reverse();

    const first = aggregateStyleFingerprint(sources);
    const second = aggregateStyleFingerprint(reversed);

    expect(first.computed.formatArchetypeDistribution).toEqual(second.computed.formatArchetypeDistribution);
  });
});
