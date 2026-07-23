import { describe, expect, it } from "vitest";

import { parseContentAnalysis } from "@/lib/server/analysis/parser/analysis";
import { AnalysisValidationError, assertContentAnalysis } from "@/lib/server/analysis/parser/validation";
import { ANALYSIS_SCHEMA_VERSION } from "@/lib/server/analysis/schema/constants";

/**
 * Golden-file tests for the parser/validation rewrite (ticket #68, TDD
 * §4.4-§4.5).
 *
 * The whole point of this rewrite is: nothing is repaired, defaulted, or
 * clamped. Every invalid fixture below MUST throw, and the valid fixture
 * MUST parse to exactly the expected shape (no silent coercion). Assert the
 * throw itself (and that it carries a field path), never a "repaired" value.
 */

/** A complete, valid raw Gemini response body (wire shape, pre-normalisation). */
function validRawPayload(): Record<string, unknown> {
  return {
    style: {
      topicNiche: "FOOD_CULINARY",
      topicSubtopic: "resep cepat saji",
      formatArchetype: "TALKING_HEAD",
      hookType: "CURIOSITY_QUESTION",
      hookTypeSecondary: "NONE",
      hasAudienceCallout: true,
      hookText: "Tahu nggak kenapa masakanmu selalu hambar?",
      structureBeatMap: [
        { timestampSec: 0, beatType: "HOOK", description: "Pertanyaan pembuka" },
        { timestampSec: 5, beatType: "BODY_PROOF", description: "Demo bumbu" },
        { timestampSec: 20, beatType: "CTA", description: "Ajakan follow" },
      ],
      pacing: "FAST",
      estimatedCutsPerMinute: 12,
      ctaType: ["FOLLOW"],
      ctaTiming: "END",
      onScreenText: ["Tips #1"],
      captionStyleNotes: "Santai, banyak emoji",
      verbalTonePatterns: ["antusias"],
    },
    overallScore: 4,
    scorecard: {
      hookStrength: 4,
      retentionFlow: 3,
      visualPolish: 5,
      ctaEffectiveness: 4,
      messageClarity: 5,
      originality: 3,
      emotionalResonance: 4,
    },
    summary: "Video resep singkat dengan hook kuat.",
    strengths: ["Hook langsung ke masalah"],
    weaknesses: ["Transisi tengah agak cepat"],
    keyMoments: ["Reveal bumbu rahasia"],
    redFlags: [],
    suggestions: ["Perlambat transisi tengah"],
  };
}

describe("assertContentAnalysis — valid payload", () => {
  it("parses a complete valid payload with no coercion", () => {
    const result = assertContentAnalysis(validRawPayload());

    expect(result.style.topicNiche).toBe("FOOD_CULINARY");
    expect(result.style.ctaType).toEqual(["FOLLOW"]);
    expect(result.scorecard.hookStrength).toBe(4);
    expect(result.overallScore).toBe(4);
    expect(result.redFlags).toEqual([]);
  });

  it("normalises the wire hookTypeSecondary NONE sentinel to domain null", () => {
    const result = assertContentAnalysis(validRawPayload());
    expect(result.style.hookTypeSecondary).toBeNull();
  });

  it("passes through a real hookTypeSecondary enum value unchanged", () => {
    const raw = validRawPayload();
    (raw.style as Record<string, unknown>).hookTypeSecondary = "NUMBERED_LIST";
    const result = assertContentAnalysis(raw);
    expect(result.style.hookTypeSecondary).toBe("NUMBERED_LIST");
  });
});

describe("parseContentAnalysis — end to end", () => {
  it("stamps schemaVersion server-side and normalises hookTypeSecondary", () => {
    const result = parseContentAnalysis(JSON.stringify(validRawPayload()));
    expect(result.schemaVersion).toBe(ANALYSIS_SCHEMA_VERSION);
    expect(result.style.hookTypeSecondary).toBeNull();
  });

  it("propagates JSON.parse's SyntaxError on malformed JSON, never repairs it", () => {
    expect(() => parseContentAnalysis("{not valid json")).toThrow(SyntaxError);
  });

  it("propagates SyntaxError on a MAX_TOKENS-truncated body (mid-string cutoff)", () => {
    const truncated = JSON.stringify(validRawPayload()).slice(0, 40);
    expect(() => parseContentAnalysis(truncated)).toThrow(SyntaxError);
  });
});

describe("assertContentAnalysis — invalid fixtures (each must throw)", () => {
  it("throws when a scorecard key is missing", () => {
    const raw = validRawPayload();
    const scorecard = raw.scorecard as Record<string, unknown>;
    delete scorecard.retentionFlow;

    expect(() => assertContentAnalysis(raw)).toThrow(AnalysisValidationError);
    expect(() => assertContentAnalysis(raw)).toThrow(/scorecard\.retentionFlow/);
  });

  it("throws on a scorecard score of 7 — never clamps", () => {
    const raw = validRawPayload();
    (raw.scorecard as Record<string, unknown>).hookStrength = 7;

    expect(() => assertContentAnalysis(raw)).toThrow(AnalysisValidationError);
    expect(() => assertContentAnalysis(raw)).toThrow(/scorecard\.hookStrength/);
  });

  it("throws when ctaType is an empty array", () => {
    const raw = validRawPayload();
    (raw.style as Record<string, unknown>).ctaType = [];

    expect(() => assertContentAnalysis(raw)).toThrow(AnalysisValidationError);
    expect(() => assertContentAnalysis(raw)).toThrow(/style\.ctaType/);
  });

  it('throws when ctaType is ["NONE","FOLLOW"] — NONE must be sole element', () => {
    const raw = validRawPayload();
    (raw.style as Record<string, unknown>).ctaType = ["NONE", "FOLLOW"];
    (raw.style as Record<string, unknown>).ctaTiming = "END";

    expect(() => assertContentAnalysis(raw)).toThrow(AnalysisValidationError);
  });

  it('throws when ctaType is ["FOLLOW"] but ctaTiming is "NONE" — biconditional violation', () => {
    const raw = validRawPayload();
    (raw.style as Record<string, unknown>).ctaType = ["FOLLOW"];
    (raw.style as Record<string, unknown>).ctaTiming = "NONE";

    expect(() => assertContentAnalysis(raw)).toThrow(AnalysisValidationError);
  });

  it('throws when ctaType is ["NONE"] but ctaTiming is "END" — biconditional violation', () => {
    const raw = validRawPayload();
    (raw.style as Record<string, unknown>).ctaType = ["NONE"];
    (raw.style as Record<string, unknown>).ctaTiming = "END";

    expect(() => assertContentAnalysis(raw)).toThrow(AnalysisValidationError);
  });

  it("throws on an unknown taxonomy enum value, naming the offending value", () => {
    const raw = validRawPayload();
    (raw.style as Record<string, unknown>).topicNiche = "SPACE_EXPLORATION";

    expect(() => assertContentAnalysis(raw)).toThrow(AnalysisValidationError);
    expect(() => assertContentAnalysis(raw)).toThrow(/SPACE_EXPLORATION/);
  });

  it("throws when overallScore is out of range", () => {
    const raw = validRawPayload();
    raw.overallScore = 0;

    expect(() => assertContentAnalysis(raw)).toThrow(AnalysisValidationError);
    expect(() => assertContentAnalysis(raw)).toThrow(/overallScore/);
  });

  it("throws when hasAudienceCallout is truthy but not a boolean", () => {
    const raw = validRawPayload();
    (raw.style as Record<string, unknown>).hasAudienceCallout = 1;

    expect(() => assertContentAnalysis(raw)).toThrow(AnalysisValidationError);
  });

  it("throws when a structureBeatMap entry has an empty description", () => {
    const raw = validRawPayload();
    (raw.style as Record<string, unknown>).structureBeatMap = [
      { timestampSec: 0, beatType: "HOOK", description: "" },
    ];

    expect(() => assertContentAnalysis(raw)).toThrow(AnalysisValidationError);
  });

  it("throws when a structureBeatMap entry has an invalid beatType", () => {
    const raw = validRawPayload();
    (raw.style as Record<string, unknown>).structureBeatMap = [
      { timestampSec: 0, beatType: "CLIMAX", description: "not a real beat" },
    ];

    expect(() => assertContentAnalysis(raw)).toThrow(AnalysisValidationError);
  });

  it("throws when a prose array container is missing entirely", () => {
    const raw = validRawPayload();
    delete raw.strengths;

    expect(() => assertContentAnalysis(raw)).toThrow(AnalysisValidationError);
    expect(() => assertContentAnalysis(raw)).toThrow(/strengths/);
  });

  it("allows an empty prose array — empty is legal, only a missing container throws", () => {
    const raw = validRawPayload();
    raw.strengths = [];

    expect(() => assertContentAnalysis(raw)).not.toThrow();
  });

  it("throws when the whole style object is missing", () => {
    const raw = validRawPayload();
    delete raw.style;

    expect(() => assertContentAnalysis(raw)).toThrow(AnalysisValidationError);
    expect(() => assertContentAnalysis(raw)).toThrow(/style/);
  });
});
