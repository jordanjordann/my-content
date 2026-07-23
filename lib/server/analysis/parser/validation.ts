import {
  isBeatType,
  isCtaTiming,
  isCtaTimingConsistent,
  isCtaType,
  isFormatArchetype,
  isHookType,
  isPacing,
  isTopicNiche,
  type BeatType,
  type CtaTiming,
  type CtaType,
  type FormatArchetype,
  type HookType,
  type Pacing,
  type TopicNiche,
} from "@/lib/analysis/taxonomy";
import { SCORECARD_KEYS, type ContentAnalysis, type Scorecard, type StructureBeat, type StyleAttributes } from "@/lib/server/analysis/types/analysis";

/**
 * Loud, not inventive (TDD §4.5, ticket #68).
 *
 * Every `assertX` function returns a typed value or throws
 * `AnalysisValidationError` carrying the offending field path. **No
 * defaults, no clamping-into-range, no `?? 5`, no `createDefaultScorecard()`.**
 * The previous file's behaviour (silently fabricating a perfect `5` for any
 * missing/invalid field) is exactly the bug this ticket deletes — on the
 * confirmed 1-5 scale a fabricated `5` reads as a PERFECT score, and #71
 * aggregates completed analyses into a creator's style fingerprint, so a
 * single silent parse failure does not stay local.
 */

export class AnalysisValidationError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`[${path}] ${message}`);
    this.name = "AnalysisValidationError";
    this.path = path;
  }
}

function fail(path: string, message: string): never {
  throw new AnalysisValidationError(path, message);
}

function describe(value: unknown): string {
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function assertRecord(raw: unknown, path: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    fail(path, `expected an object, got ${describe(raw)}`);
  }
  return raw as Record<string, unknown>;
}

function assertNumber(raw: unknown, path: string): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) {
    fail(path, `expected a number, got ${describe(raw)}`);
  }
  return raw;
}

/** Integer in [1,5]. Never clamped — an out-of-range value means the whole run is untrustworthy. */
function assertInteger1to5(raw: unknown, path: string): number {
  const value = assertNumber(raw, path);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    fail(path, `expected an integer in [1,5], got ${describe(raw)}`);
  }
  return value;
}

function assertNullableNumber(raw: unknown, path: string): number | null {
  if (raw === null) return null;
  return assertNumber(raw, path);
}

function assertBoolean(raw: unknown, path: string): boolean {
  if (typeof raw !== "boolean") {
    fail(path, `expected a boolean, got ${describe(raw)}`);
  }
  return raw;
}

function assertString(raw: unknown, path: string): string {
  if (typeof raw !== "string") {
    fail(path, `expected a string, got ${describe(raw)}`);
  }
  return raw;
}

function assertNonEmptyString(raw: unknown, path: string): string {
  const value = assertString(raw, path);
  if (value.length === 0) {
    fail(path, "expected a non-empty string");
  }
  return value;
}

function assertStringArray(raw: unknown, path: string): string[] {
  if (!Array.isArray(raw)) {
    fail(path, `expected an array, got ${describe(raw)}`);
  }
  return raw.map((item, index) => assertString(item, `${path}[${index}]`));
}

function assertEnumMember<T extends string>(
  raw: unknown,
  path: string,
  guard: (value: unknown) => value is T,
  taxonomyName: string,
): T {
  if (!guard(raw)) {
    fail(path, `not a valid ${taxonomyName}: ${describe(raw)}`);
  }
  return raw;
}

/**
 * `hookTypeSecondary` wire representation (TDD §4.3): a required,
 * non-nullable enum with an extra `"NONE"` sentinel member. `"NONE"` is
 * normalised to domain `null` here; any other value must be a real
 * `HookType`.
 */
function assertHookTypeSecondary(raw: unknown, path: string): HookType | null {
  if (raw === "NONE") return null;
  return assertEnumMember<HookType>(raw, path, isHookType, "HookType");
}

function assertStructureBeatMap(raw: unknown, path: string): StructureBeat[] {
  if (!Array.isArray(raw)) {
    fail(path, `expected an array, got ${describe(raw)}`);
  }
  return raw.map((entry, index) => {
    const entryPath = `${path}[${index}]`;
    const obj = assertRecord(entry, entryPath);
    return {
      timestampSec: assertNumber(obj.timestampSec, `${entryPath}.timestampSec`),
      beatType: assertEnumMember<BeatType>(obj.beatType, `${entryPath}.beatType`, isBeatType, "BeatType"),
      description: assertNonEmptyString(obj.description, `${entryPath}.description`),
    };
  });
}

/**
 * Non-empty, every member a known `CtaType`, no duplicates, and `NONE` only
 * ever as the sole element (PRD §4.3.6). An empty array is invalid.
 */
function assertCtaTypeArray(raw: unknown, path: string): CtaType[] {
  if (!Array.isArray(raw)) {
    fail(path, `expected an array, got ${describe(raw)}`);
  }
  if (raw.length === 0) {
    fail(path, "must not be empty");
  }

  const values = raw.map((item, index) => assertEnumMember<CtaType>(item, `${path}[${index}]`, isCtaType, "CtaType"));

  if (new Set(values).size !== values.length) {
    fail(path, `must not contain duplicates, got ${describe(values)}`);
  }
  if (values.includes("NONE") && values.length > 1) {
    fail(path, `"NONE" must be the sole element when present, got ${describe(values)}`);
  }

  return values;
}

function assertScorecard(raw: unknown, path: string): Scorecard {
  const obj = assertRecord(raw, path);
  const result = {} as Scorecard;
  for (const key of SCORECARD_KEYS) {
    result[key] = assertInteger1to5(obj[key], `${path}.${key}`);
  }
  return result;
}

function assertStyle(raw: unknown, path: string): StyleAttributes {
  const obj = assertRecord(raw, path);

  const topicNiche = assertEnumMember<TopicNiche>(obj.topicNiche, `${path}.topicNiche`, isTopicNiche, "TopicNiche");
  const topicSubtopic = assertString(obj.topicSubtopic, `${path}.topicSubtopic`);
  const formatArchetype = assertEnumMember<FormatArchetype>(
    obj.formatArchetype,
    `${path}.formatArchetype`,
    isFormatArchetype,
    "FormatArchetype",
  );
  const hookType = assertEnumMember<HookType>(obj.hookType, `${path}.hookType`, isHookType, "HookType");
  const hookTypeSecondary = assertHookTypeSecondary(obj.hookTypeSecondary, `${path}.hookTypeSecondary`);
  const hasAudienceCallout = assertBoolean(obj.hasAudienceCallout, `${path}.hasAudienceCallout`);
  const hookText = assertString(obj.hookText, `${path}.hookText`);
  const structureBeatMap = assertStructureBeatMap(obj.structureBeatMap, `${path}.structureBeatMap`);
  const pacing = assertEnumMember<Pacing>(obj.pacing, `${path}.pacing`, isPacing, "Pacing");
  const estimatedCutsPerMinute = assertNullableNumber(obj.estimatedCutsPerMinute, `${path}.estimatedCutsPerMinute`);
  const ctaType = assertCtaTypeArray(obj.ctaType, `${path}.ctaType`);
  const ctaTiming = assertEnumMember<CtaTiming>(obj.ctaTiming, `${path}.ctaTiming`, isCtaTiming, "CtaTiming");

  // Biconditional (PRD §4.3.6, never coerced or repaired — fail loudly):
  // ctaType is ["NONE"] iff ctaTiming === "NONE".
  if (!isCtaTimingConsistent(ctaType, ctaTiming)) {
    fail(
      `${path}.ctaType/${path}.ctaTiming`,
      `ctaType (${describe(ctaType)}) and ctaTiming (${describe(ctaTiming)}) violate the NONE biconditional`,
    );
  }

  const onScreenText = assertStringArray(obj.onScreenText, `${path}.onScreenText`);
  const captionStyleNotes = assertString(obj.captionStyleNotes, `${path}.captionStyleNotes`);
  const verbalTonePatterns = assertStringArray(obj.verbalTonePatterns, `${path}.verbalTonePatterns`);

  return {
    topicNiche,
    topicSubtopic,
    formatArchetype,
    hookType,
    hookTypeSecondary,
    hasAudienceCallout,
    hookText,
    structureBeatMap,
    pacing,
    estimatedCutsPerMinute,
    ctaType,
    ctaTiming,
    onScreenText,
    captionStyleNotes,
    verbalTonePatterns,
  };
}

/**
 * Validates a raw, `JSON.parse`d Gemini response body against the full
 * `ContentAnalysis` contract, minus `schemaVersion` — that is stamped
 * server-side by `parser/analysis.ts`, never trusted from the model.
 */
export function assertContentAnalysis(raw: unknown): Omit<ContentAnalysis, "schemaVersion"> {
  const obj = assertRecord(raw, "$");

  const style = assertStyle(obj.style, "style");
  const overallScore = assertInteger1to5(obj.overallScore, "overallScore");
  const scorecard = assertScorecard(obj.scorecard, "scorecard");
  const summary = assertString(obj.summary, "summary");
  const strengths = assertStringArray(obj.strengths, "strengths");
  const weaknesses = assertStringArray(obj.weaknesses, "weaknesses");
  const keyMoments = assertStringArray(obj.keyMoments, "keyMoments");
  const redFlags = assertStringArray(obj.redFlags, "redFlags");
  const suggestions = assertStringArray(obj.suggestions, "suggestions");

  return {
    style,
    overallScore,
    scorecard,
    summary,
    strengths,
    weaknesses,
    keyMoments,
    redFlags,
    suggestions,
  };
}
