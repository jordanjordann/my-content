import {
  isBeatType,
  isCtaTiming,
  isCtaType,
  isFormatArchetype,
  isHookType,
  isPacing,
  isTopicNiche,
} from "@/lib/analysis/taxonomy/helpers";
import type { ComputedFingerprint, FingerprintValidationResult, FrequencyDistributionEntry } from "./types";

/**
 * Ticket #73 sub-ticket A (TDD `docs/TDD-fingerprint-read-override-api.md`
 * §3 D4/D5). An allow-list validator over a `PATCH` body's top-level keys —
 * never throws, never mutates `patch`/`computed`. An unknown key is always
 * reported invalid (never silently dropped, D4). A top-level `null` value is
 * always valid regardless of key: D3 makes `null` mean "delete this
 * override", and D4's "null trap" resolves the collision with
 * `medianCutsPerMinute`/`medianBeatCount` legitimately being `null`-valued
 * in `computed` by making `null` mean delete for every key, no exceptions —
 * so a `null` value never needs a per-key shape check.
 */

const SHARE_SUM_TOLERANCE = 0.01;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isUnitInterval(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isIsoParseable(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value));
}

/**
 * Validates a `{value,count,share}` entry array (D4): every `value` must
 * pass the taxonomy guard supplied by the caller, `count` a non-negative
 * integer, `share` in `[0,1]`, no duplicate `value`, and — if the array is
 * non-empty — the shares sum to `1 ± 0.01` (`types.ts:24`'s documented
 * invariant).
 */
function isValidDistribution(
  value: unknown,
  isValidValue: (v: unknown) => boolean,
): value is FrequencyDistributionEntry[] {
  if (!Array.isArray(value)) return false;

  const seenValues = new Set<string>();
  let shareSum = 0;

  for (const entry of value) {
    if (!isPlainObject(entry)) return false;
    const { value: entryValue, count, share } = entry;

    if (!isValidValue(entryValue) || typeof entryValue !== "string") return false;
    if (seenValues.has(entryValue)) return false;
    seenValues.add(entryValue);

    if (!isNonNegativeInteger(count)) return false;
    if (!isUnitInterval(share)) return false;
    shareSum += share;
  }

  if (value.length > 0 && Math.abs(shareSum - 1) > SHARE_SUM_TOLERANCE) return false;
  return true;
}

/** `verbalTonePatterns` uses the same entry shape, but `value` is a free-text tone tag (D4). */
function isValidVerbalTonePatterns(value: unknown): boolean {
  return isValidDistribution(value, (v) => typeof v === "string" && v.trim().length > 0);
}

function isValidTypicalBeatSequence(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => isBeatType(entry));
}

/** `dateRange` (D4): `{earliest, latest}`, each ISO-parseable or `null`, `earliest <= latest` when both present. */
function isValidDateRange(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes("earliest") || !keys.includes("latest")) return false;

  const { earliest, latest } = value;
  if (earliest !== null && !isIsoParseable(earliest)) return false;
  if (latest !== null && !isIsoParseable(latest)) return false;
  if (typeof earliest === "string" && typeof latest === "string" && Date.parse(earliest) > Date.parse(latest)) {
    return false;
  }
  return true;
}

/**
 * Exemplar overrides (D5): every element must already be present in the
 * corresponding `computed` array — pruning/reordering allowed, authoring
 * brand-new verbatim-creator-text is rejected.
 */
function isValidExemplarSubset(value: unknown, computedList: readonly string[]): boolean {
  if (!Array.isArray(value)) return false;
  const allowed = new Set(computedList);
  return value.every((entry) => typeof entry === "string" && allowed.has(entry));
}

type KeyValidator = (value: unknown, computed: ComputedFingerprint) => boolean;

/** The full overridable-key allow-list (D4). A patch key not present here is always invalid. */
const KEY_VALIDATORS: Record<string, KeyValidator> = {
  topicNicheDistribution: (value) => isValidDistribution(value, isTopicNiche),
  formatArchetypeDistribution: (value) => isValidDistribution(value, isFormatArchetype),
  hookTypeDistribution: (value) => isValidDistribution(value, isHookType),
  ctaTypeDistribution: (value) => isValidDistribution(value, isCtaType),
  ctaTimingDistribution: (value) => isValidDistribution(value, isCtaTiming),
  pacingDistribution: (value) => isValidDistribution(value, isPacing),
  verbalTonePatterns: (value) => isValidVerbalTonePatterns(value),
  typicalBeatSequence: (value) => isValidTypicalBeatSequence(value),
  audienceCalloutRate: (value) => isUnitInterval(value),
  medianCutsPerMinute: (value) => isPositiveNumber(value),
  medianBeatCount: (value) => isPositiveNumber(value),
  dateRange: (value) => isValidDateRange(value),
  captionStyleExemplars: (value, computed) => isValidExemplarSubset(value, computed.captionStyleExemplars),
  hookTextExemplars: (value, computed) => isValidExemplarSubset(value, computed.hookTextExemplars),
  onScreenTextExemplars: (value, computed) => isValidExemplarSubset(value, computed.onScreenTextExemplars),
  consistencyIndex: (value) => isUnitInterval(value),
};

export function validateOverridePatch(
  patch: Record<string, unknown>,
  computed: ComputedFingerprint,
): FingerprintValidationResult {
  const invalidKeys: string[] = [];

  for (const key of Object.keys(patch)) {
    const validator = KEY_VALIDATORS[key];
    if (!validator) {
      invalidKeys.push(key);
      continue;
    }

    const value = patch[key];
    if (value === null) continue; // D3/D4: null always means "delete", valid for every known key.

    if (!validator(value, computed)) {
      invalidKeys.push(key);
    }
  }

  return invalidKeys.length > 0 ? { ok: false, invalidKeys } : { ok: true };
}
