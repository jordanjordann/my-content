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
