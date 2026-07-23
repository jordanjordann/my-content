import { Type, type Schema } from "@google/genai";

import {
  BEAT_TYPES,
  CTA_TIMINGS,
  CTA_TYPES,
  FORMAT_ARCHETYPES,
  HOOK_TYPES,
  PACING_VALUES,
  TOPIC_NICHES,
} from "@/lib/analysis/taxonomy/constants";

/**
 * Gemini `responseSchema` for the Tier 1 + Tier 2 analysis contract
 * (TDD §3.2, §4.1–§4.3; PRD §5.1, §5.2, §5.4).
 *
 * HARD RULE (TDD §2.2): every enum's value list is SPREAD from
 * `lib/analysis/taxonomy/constants.ts`. No literal enum list is permitted in
 * this file — that is exactly the drift `defineTaxonomy()` exists to prevent.
 *
 * `schemaVersion` is deliberately NOT a property here. It is stamped
 * server-side by the parser (TDD §4.4 step 3), never requested from the
 * model — the model has no business asserting which contract it was run
 * under.
 *
 * Known, accepted schema-level limitations (do not "fix" these here):
 * - `Type.INTEGER` has no `minimum`/`maximum` on this SDK. The 1-5 range for
 *   `overallScore` and every scorecard dimension is enforced in the
 *   validation layer (#68), not here.
 * - The `ctaType`/`ctaTiming` biconditional (`ctaType` is `["NONE"]` iff
 *   `ctaTiming` is `"NONE"`) cannot be expressed in JSON Schema. It is
 *   enforced in the prompt (#67) and in validation (#68) only.
 */

/**
 * `hookTypeSecondary` wire representation (TDD §4.3): a REQUIRED,
 * NON-NULLABLE enum with an extra `"NONE"` member, normalised to `null` by
 * the parser (#68). `"NONE"` is a wire-only value — it is never a `HookType`
 * and never reaches the domain type or the fingerprint. This mirrors the
 * PRD's own §4.3.6 rationale for `ctaType`'s `["NONE"]`: "the model found
 * nothing" and "the field didn't get filled" must not be the same value on
 * the wire.
 */
const HOOK_TYPE_SECONDARY_WIRE_VALUES = [...HOOK_TYPES, "NONE"] as const;

const structureBeatSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    timestampSec: { type: Type.NUMBER },
    beatType: { type: Type.STRING, format: "enum", enum: [...BEAT_TYPES] },
    description: { type: Type.STRING, description: "Indonesian" },
  },
  required: ["timestampSec", "beatType", "description"],
  propertyOrdering: ["timestampSec", "beatType", "description"],
};

/** Tier 1 — style attributes (TDD §3.2 `StyleAttributes`). */
const styleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topicNiche: { type: Type.STRING, format: "enum", enum: [...TOPIC_NICHES] },
    topicSubtopic: { type: Type.STRING, description: "Indonesian free text" },
    formatArchetype: { type: Type.STRING, format: "enum", enum: [...FORMAT_ARCHETYPES] },
    hookType: { type: Type.STRING, format: "enum", enum: [...HOOK_TYPES] },
    // See HOOK_TYPE_SECONDARY_WIRE_VALUES comment above — required,
    // non-nullable, "NONE" is a wire-only sentinel normalised by the parser.
    hookTypeSecondary: {
      type: Type.STRING,
      format: "enum",
      enum: [...HOOK_TYPE_SECONDARY_WIRE_VALUES],
    },
    hasAudienceCallout: { type: Type.BOOLEAN },
    hookText: { type: Type.STRING, description: "Indonesian, verbatim" },
    structureBeatMap: {
      type: Type.ARRAY,
      items: structureBeatSchema,
    },
    pacing: { type: Type.STRING, format: "enum", enum: [...PACING_VALUES] },
    // Genuine nullable number (TDD §4.3): "not derivable from this footage"
    // is a real state and there is no honest sentinel.
    estimatedCutsPerMinute: { type: Type.NUMBER, nullable: true },
    // Array of enum (TDD §3.2): never empty on the wire; ["NONE"] means no
    // CTA. Non-emptiness and the NONE-must-be-sole-element rule are enforced
    // in validation (#68), not expressible here.
    ctaType: {
      type: Type.ARRAY,
      items: { type: Type.STRING, format: "enum", enum: [...CTA_TYPES] },
    },
    ctaTiming: { type: Type.STRING, format: "enum", enum: [...CTA_TIMINGS] },
    onScreenText: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Indonesian, verbatim, in order",
    },
    captionStyleNotes: { type: Type.STRING, description: "Indonesian prose" },
    verbalTonePatterns: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Indonesian short tags",
    },
  },
  required: [
    "topicNiche",
    "topicSubtopic",
    "formatArchetype",
    "hookType",
    "hookTypeSecondary",
    "hasAudienceCallout",
    "hookText",
    "structureBeatMap",
    "pacing",
    "estimatedCutsPerMinute",
    "ctaType",
    "ctaTiming",
    "onScreenText",
    "captionStyleNotes",
    "verbalTonePatterns",
  ],
  propertyOrdering: [
    "topicNiche",
    "topicSubtopic",
    "formatArchetype",
    "hookType",
    "hookTypeSecondary",
    "hasAudienceCallout",
    "hookText",
    "structureBeatMap",
    "pacing",
    "estimatedCutsPerMinute",
    "ctaType",
    "ctaTiming",
    "onScreenText",
    "captionStyleNotes",
    "verbalTonePatterns",
  ],
};

/** Tier 2 — 7 dimensions, each 1-5 (TDD §3.2 `Scorecard`). No min/max at the schema level — see the module doc comment. */
const SCORECARD_KEYS = [
  "hookStrength",
  "retentionFlow",
  "visualPolish",
  "ctaEffectiveness",
  "messageClarity",
  "originality",
  "emotionalResonance",
] as const;

const scorecardSchema: Schema = {
  type: Type.OBJECT,
  properties: Object.fromEntries(
    SCORECARD_KEYS.map((key) => [key, { type: Type.INTEGER, description: "1-5" }]),
  ),
  required: [...SCORECARD_KEYS],
  propertyOrdering: [...SCORECARD_KEYS],
};

/**
 * Full request/response contract (TDD §3.2 `ContentAnalysis`, minus
 * `schemaVersion` — see the module doc comment).
 */
export const ANALYSIS_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    style: styleSchema,
    overallScore: { type: Type.INTEGER, description: "1-5" },
    scorecard: scorecardSchema,
    summary: { type: Type.STRING, description: "Indonesian" },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
    keyMoments: { type: Type.ARRAY, items: { type: Type.STRING } },
    redFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "style",
    "overallScore",
    "scorecard",
    "summary",
    "strengths",
    "weaknesses",
    "keyMoments",
    "redFlags",
    "suggestions",
  ],
  propertyOrdering: [
    "style",
    "overallScore",
    "scorecard",
    "summary",
    "strengths",
    "weaknesses",
    "keyMoments",
    "redFlags",
    "suggestions",
  ],
};
