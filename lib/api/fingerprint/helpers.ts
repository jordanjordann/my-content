import type { FingerprintAbsence, FingerprintResult, FingerprintView, FrequencyDistributionEntry } from "./types";

/**
 * Discriminates a `fetchFingerprint`/`patchFingerprintOverrides` result. A `404` body
 * always carries a `reason` field (`PROFILE_NOT_FOUND`/`NO_FINGERPRINT`); a `200`
 * `FingerprintView` never does — that's the real discriminant the route already sends,
 * not a synthesized one.
 */
export function isFingerprintAbsence(result: FingerprintResult): result is FingerprintAbsence {
  return "reason" in result;
}

/** `overriddenKeys` (a plain string array over the wire) as a `Set` for O(1) lookups. */
export function toOverriddenKeySet(view: FingerprintView): Set<string> {
  return new Set(view.overriddenKeys);
}

/**
 * Highest-`share` entry's `value` in a frequency distribution. Ties keep the
 * first-encountered entry (matching the server aggregator's own tie-break convention
 * for `typicalBeatSequence`, TDD §4). `null` for an empty distribution — a
 * still-cold dimension, not an error.
 */
export function topDistributionValue(distribution: FrequencyDistributionEntry[]): string | null {
  if (distribution.length === 0) {
    return null;
  }

  let top = distribution[0];
  for (const entry of distribution.slice(1)) {
    if (entry.share > top.share) {
      top = entry;
    }
  }

  return top.value;
}
