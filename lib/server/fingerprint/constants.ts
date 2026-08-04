/**
 * Cold-start threshold (ticket #72, PRD §6.1). Below this many completed,
 * current-schema analyses for a profile, no fingerprint row is written at
 * all — not a row carrying a low-confidence flag. Absence is unambiguous;
 * a flag is a second thing that could drift from the data it describes.
 *
 * Deliberately a named constant with no governance process attached
 * (PRD §6.1, explicit) — a named constant makes changing it one edit.
 */
export const MIN_ANALYSES_FOR_FINGERPRINT = 5;

/**
 * Aggregation algorithm version. Versioned independently from the source
 * analysis contract's `schema_version` (see
 * lib/server/analysis/schema/constants.ts) — the two change for different
 * reasons, and conflating them would force a full recompute of every
 * fingerprint whenever either one moves.
 *
 * Increment on every future change to `aggregate.ts`'s output shape or
 * computation rules.
 */
export const FINGERPRINT_VERSION = 1;

/**
 * Row-level identity/provenance fields. Never legitimately human-overridable
 * — overriding `profileId`/`fingerprintVersion`/`schemaVersion`/`createdAt`/
 * `updatedAt` would let a human corrupt what row this even is or when it was
 * written, which is a different kind of thing than correcting a computed
 * content field like `consistencyIndex` or a style distribution.
 *
 * Used both to reject these keys at write time (`setFingerprintOverrides`)
 * and to keep `getFingerprint`'s `overriddenKeys` honest — a key that can
 * never take effect must never be reported as overridden.
 */
export const PROVENANCE_FIELDS = [
  "profileId",
  "fingerprintVersion",
  "schemaVersion",
  "createdAt",
  "updatedAt",
] as const;

/**
 * Ticket #73 sub-ticket A (TDD §3 D1). `sampleSize` and `sourceAnalysisIds`
 * are the provenance of the "based on N videos" confidence indicator
 * (PRD §6.1) — a count of rows and the ids behind it, not a "read of the
 * creator" a human could plausibly correct. They currently live inside
 * `ComputedFingerprint`, so they are spread BEFORE `...overrides` in
 * `getFingerprint`'s read-time merge — an override on either of them would
 * otherwise win at read time, which is the exact bug class already fixed
 * for `consistencyIndex` (`service.test.ts:192`), pointed the other way.
 *
 * `NON_OVERRIDABLE_FIELDS` is used in all three places that guard override
 * safety: write-time rejection (`patchFingerprintOverrides`/
 * `setFingerprintOverrides`), `getFingerprint`'s `overriddenKeys` filter, and
 * a defensive strip of these keys from `overrides` before the read-time
 * merge spread (belt-and-suspenders for any legacy blob written before this
 * guard existed). `consistencyIndex` deliberately stays OUT of this list —
 * #72's decision that it remains overridable is unchanged.
 */
export const NON_OVERRIDABLE_FIELDS = [...PROVENANCE_FIELDS, "sampleSize", "sourceAnalysisIds"] as const;
