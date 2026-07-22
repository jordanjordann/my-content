/**
 * Analysis taxonomy — machine-stable English enum identifiers.
 *
 * ISOMORPHIC: this module is imported by both server and client code. It must
 * never import a Node-only API, a server SDK type, or carry a "use server" /
 * "use client" directive.
 *
 * Enum *values* are stable English identifiers (PRD §4.2). Human-facing text is
 * Indonesian and lives in `labels.ts`.
 *
 * Sources: PRD §4.1, §4.3.1, §4.3.2, §4.3.6 — all four taxonomies are
 * owner-confirmed and closed. TDD §3.1.
 */

/** PRD §4.3.1 — 18 values (17 + `OTHER`). Hybrid enum: pairs with free-text `topicSubtopic`. */
export type TopicNiche =
  | "FOOD_CULINARY"
  | "BEAUTY_SKINCARE"
  | "FASHION_STYLE"
  | "HEALTH_FITNESS"
  | "FINANCE_INVESTING"
  | "BUSINESS_ENTREPRENEURSHIP"
  | "EDUCATION_SKILLS"
  | "TECH_GADGETS"
  | "PARENTING_FAMILY"
  | "RELIGION_SPIRITUALITY"
  | "TRAVEL"
  | "COMEDY_ENTERTAINMENT"
  | "LIFESTYLE_DAILY"
  | "HOME_INTERIOR"
  | "AUTOMOTIVE"
  | "GAMING"
  | "RELATIONSHIPS"
  | "OTHER";

/** PRD §4.3.2 — 17 values + `OTHER`. Rhetorical strategy of the opening. */
export type HookType =
  | "DIRECT_VALUE_PROMISE"
  | "NUMBERED_LIST"
  | "CURIOSITY_QUESTION"
  | "SIDE_BY_SIDE_COMPARISON"
  | "MYTH_CORRECTION"
  | "WARNING_MISTAKE"
  | "CONTRARIAN_OPINION"
  | "SECRET_INSIDER_REVEAL"
  | "RESULT_PROOF"
  | "PERSONAL_STORY_OPENER"
  | "PROCESS_JOURNEY_SERIES"
  | "VISUAL_DEMONSTRATION"
  | "SHOCK_STATEMENT"
  | "RELATABLE_PAIN_POINT"
  | "EXPERIMENT_CHALLENGE"
  | "TEXT_OVERLAY_ONLY"
  | "COLD_OPEN_ACTION"
  | "OTHER";

/** PRD §4.3.6 — 14 values + `OTHER`. Production form: how the video is made. */
export type FormatArchetype =
  | "TALKING_HEAD"
  | "VOICEOVER_BROLL"
  | "POV_SKIT"
  | "TUTORIAL_DEMO"
  | "PRODUCT_REVIEW"
  | "TRANSFORMATION_REVEAL"
  | "GREEN_SCREEN_COMMENTARY"
  | "REACTION_STITCH"
  | "INTERVIEW_STREET"
  | "TEXT_SLIDESHOW"
  | "VLOG_DAILY"
  | "PROCESS_ASMR"
  | "PERFORMANCE"
  | "CAROUSEL_STATIC"
  | "OTHER";

/**
 * PRD §4.3.6 — 11 values + `NONE` + `OTHER`.
 * Carried on the wire as an ARRAY: `NONE` must be the sole element when
 * present, and an empty array is invalid. See `isValidCtaTypeArray`.
 */
export type CtaType =
  | "FOLLOW"
  | "COMMENT_PROMPT"
  | "SAVE_PROMPT"
  | "SHARE_PROMPT"
  | "LINK_IN_BIO"
  | "SHOP_PURCHASE"
  | "DM_INQUIRY"
  | "JOIN_COMMUNITY"
  | "SIGN_UP_REGISTER"
  | "WATCH_NEXT"
  | "DISCOUNT_CODE"
  | "NONE"
  | "OTHER";

/**
 * PRD §4.3.6 — where the primary ask lands.
 * Biconditional with `ctaType`: `NONE` here if and only if `ctaType` is `["NONE"]`.
 */
export type CtaTiming = "EARLY" | "MID" | "END" | "NONE";

/**
 * PRD §4.1 — beat labels for `structureBeatMap`.
 * Uppercased per TDD §3.1: the PRD writes these lowercase in descriptive prose
 * only; the confirmed wire rule (§4.2) is stable English machine identifiers.
 */
export type BeatType =
  | "HOOK"
  | "SETUP"
  | "BODY_PROOF"
  | "TWIST"
  | "RESOLUTION"
  | "CTA";

/** PRD §4.1 — machine-comparable pacing signal. Uppercased per TDD §3.1. */
export type Pacing = "SLOW" | "MEDIUM" | "FAST" | "MIXED";
