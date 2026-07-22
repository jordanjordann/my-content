import {
  BEAT_TYPES,
  CTA_TIMINGS,
  CTA_TYPES,
  FORMAT_ARCHETYPES,
  HOOK_TYPES,
  PACING_VALUES,
  TOPIC_NICHES,
} from "./constants";
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
 * Pure type guards over the taxonomies. No I/O, no imports outside this module,
 * safe on both server and client.
 */

const isMemberOf = (values: readonly string[], value: unknown): boolean =>
  typeof value === "string" && values.includes(value);

export const isTopicNiche = (value: unknown): value is TopicNiche =>
  isMemberOf(TOPIC_NICHES, value);

export const isHookType = (value: unknown): value is HookType =>
  isMemberOf(HOOK_TYPES, value);

export const isFormatArchetype = (value: unknown): value is FormatArchetype =>
  isMemberOf(FORMAT_ARCHETYPES, value);

export const isCtaType = (value: unknown): value is CtaType =>
  isMemberOf(CTA_TYPES, value);

export const isCtaTiming = (value: unknown): value is CtaTiming =>
  isMemberOf(CTA_TIMINGS, value);

export const isBeatType = (value: unknown): value is BeatType =>
  isMemberOf(BEAT_TYPES, value);

export const isPacing = (value: unknown): value is Pacing =>
  isMemberOf(PACING_VALUES, value);

/**
 * `ctaType` is an array with hard validity rules (PRD §4.3.6):
 * non-empty, every member a known `CtaType`, no duplicates, and `NONE` only
 * ever as the sole element.
 *
 * This is the shape predicate only. Turning a `false` into a loud, typed
 * parse error belongs to the validator (ticket #69) — this module never throws.
 */
export const isValidCtaTypeArray = (value: unknown): value is CtaType[] => {
  if (!Array.isArray(value) || value.length === 0) return false;
  if (!value.every(isCtaType)) return false;
  if (new Set(value).size !== value.length) return false;
  return !value.includes("NONE") || value.length === 1;
};

/**
 * The `NONE` biconditional (PRD §4.3.6): `ctaTiming` is `NONE` if and only if
 * `ctaType` is exactly `["NONE"]`. Any other combination is invalid and must
 * fail validation loudly rather than be coerced.
 */
export const isCtaTimingConsistent = (
  ctaTypes: readonly CtaType[],
  ctaTiming: CtaTiming,
): boolean => {
  const hasNoCta = ctaTypes.length === 1 && ctaTypes[0] === "NONE";
  return hasNoCta === (ctaTiming === "NONE");
};
