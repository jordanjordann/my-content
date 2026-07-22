import type {
  BeatType,
  CtaTiming,
  CtaType,
  FormatArchetype,
  HookType,
  Pacing,
  TopicNiche,
} from "./types";

/**
 * The canonical value arrays for every analysis taxonomy.
 *
 * HARD RULE (TDD §2.2): these arrays are the ONLY literal enum lists permitted
 * anywhere in the codebase. The Gemini `responseSchema`, the prompt's taxonomy
 * block, the parser validators and the frontend label lookups must all derive
 * from here. A second literal list anywhere is drift by construction.
 */

/**
 * Reported by the compiler when a taxonomy array is missing one or more values
 * of its union. The missing members are named in `__missingTaxonomyValues`.
 */
type ExhaustivenessError<Missing extends string> = {
  readonly __missingTaxonomyValues: Missing;
};

/**
 * Builds a taxonomy array that is checked in BOTH directions at compile time:
 *
 * - an unknown or misspelled value fails the `readonly Union[]` constraint;
 * - a MISSING value makes the second parameter required, so the call site
 *   fails with `ExhaustivenessError<"THE_MISSING_VALUE">`.
 *
 * `satisfies readonly Union[]` alone only catches the first direction, and the
 * missing-value case is the one that actually bites (a value silently absent
 * from the response schema can never be emitted by the model).
 */
const defineTaxonomy =
  <Union extends string>() =>
  <const List extends readonly Union[]>(
    values: List,
    ...exhaustive: [Exclude<Union, List[number]>] extends [never]
      ? []
      : [error: ExhaustivenessError<Exclude<Union, List[number]>>]
  ): List => {
    void exhaustive;
    return values;
  };

/** PRD §4.3.1 — 18 values. */
export const TOPIC_NICHES = defineTaxonomy<TopicNiche>()([
  "FOOD_CULINARY",
  "BEAUTY_SKINCARE",
  "FASHION_STYLE",
  "HEALTH_FITNESS",
  "FINANCE_INVESTING",
  "BUSINESS_ENTREPRENEURSHIP",
  "EDUCATION_SKILLS",
  "TECH_GADGETS",
  "PARENTING_FAMILY",
  "RELIGION_SPIRITUALITY",
  "TRAVEL",
  "COMEDY_ENTERTAINMENT",
  "LIFESTYLE_DAILY",
  "HOME_INTERIOR",
  "AUTOMOTIVE",
  "GAMING",
  "RELATIONSHIPS",
  "OTHER",
]);

/** PRD §4.3.2 — 17 values + `OTHER`. */
export const HOOK_TYPES = defineTaxonomy<HookType>()([
  "DIRECT_VALUE_PROMISE",
  "NUMBERED_LIST",
  "CURIOSITY_QUESTION",
  "SIDE_BY_SIDE_COMPARISON",
  "MYTH_CORRECTION",
  "WARNING_MISTAKE",
  "CONTRARIAN_OPINION",
  "SECRET_INSIDER_REVEAL",
  "RESULT_PROOF",
  "PERSONAL_STORY_OPENER",
  "PROCESS_JOURNEY_SERIES",
  "VISUAL_DEMONSTRATION",
  "SHOCK_STATEMENT",
  "RELATABLE_PAIN_POINT",
  "EXPERIMENT_CHALLENGE",
  "TEXT_OVERLAY_ONLY",
  "COLD_OPEN_ACTION",
  "OTHER",
]);

/** PRD §4.3.6 — 14 values + `OTHER`. */
export const FORMAT_ARCHETYPES = defineTaxonomy<FormatArchetype>()([
  "TALKING_HEAD",
  "VOICEOVER_BROLL",
  "POV_SKIT",
  "TUTORIAL_DEMO",
  "PRODUCT_REVIEW",
  "TRANSFORMATION_REVEAL",
  "GREEN_SCREEN_COMMENTARY",
  "REACTION_STITCH",
  "INTERVIEW_STREET",
  "TEXT_SLIDESHOW",
  "VLOG_DAILY",
  "PROCESS_ASMR",
  "PERFORMANCE",
  "CAROUSEL_STATIC",
  "OTHER",
]);

/** PRD §4.3.6 — 11 values + `NONE` + `OTHER`. */
export const CTA_TYPES = defineTaxonomy<CtaType>()([
  "FOLLOW",
  "COMMENT_PROMPT",
  "SAVE_PROMPT",
  "SHARE_PROMPT",
  "LINK_IN_BIO",
  "SHOP_PURCHASE",
  "DM_INQUIRY",
  "JOIN_COMMUNITY",
  "SIGN_UP_REGISTER",
  "WATCH_NEXT",
  "DISCOUNT_CODE",
  "NONE",
  "OTHER",
]);

/** PRD §4.3.6. */
export const CTA_TIMINGS = defineTaxonomy<CtaTiming>()([
  "EARLY",
  "MID",
  "END",
  "NONE",
]);

/** PRD §4.1, uppercased per TDD §3.1. */
export const BEAT_TYPES = defineTaxonomy<BeatType>()([
  "HOOK",
  "SETUP",
  "BODY_PROOF",
  "TWIST",
  "RESOLUTION",
  "CTA",
]);

/** PRD §4.1, uppercased per TDD §3.1. */
export const PACING_VALUES = defineTaxonomy<Pacing>()([
  "SLOW",
  "MEDIUM",
  "FAST",
  "MIXED",
]);

/**
 * The single representation of "this video has no call to action" (PRD §4.3.6).
 * Chosen over an empty array so that "the model found no CTA" and "the model
 * failed to populate the field" are distinguishable on the wire.
 */
export const CTA_TYPE_NONE = ["NONE"] as const satisfies readonly CtaType[];
