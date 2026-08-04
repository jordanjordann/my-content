import { ANALYSIS_SCHEMA_VERSION } from "@/lib/server/analysis/schema";
import { aggregateStyleFingerprint } from "./aggregate";
import { MIN_ANALYSES_FOR_FINGERPRINT, FINGERPRINT_VERSION, NON_OVERRIDABLE_FIELDS } from "./constants";
import {
  getCompletedV2Analyses,
  getFingerprintRow,
  patchFingerprintOverrides,
  upsertFingerprint,
} from "./repository";
import { validateOverridePatch } from "./validation";
import type { ApplyOverridePatchResult, FingerprintView, StyleFingerprint } from "./types";

/**
 * Recomputes a profile's style fingerprint from its current corpus of
 * completed, `schema_version = 2` analyses (Step 8, and the co-authored
 * owner decision — no `coauthor_producers` filter).
 *
 * Cold start (Step 6): below `MIN_ANALYSES_FOR_FINGERPRINT`, no row is
 * written and this returns `null`. An existing row from a prior recompute
 * (when the corpus was at/above the threshold) is left as-is if the corpus
 * later drops below it again — the ticket only specifies "write no row" for
 * the write path; deleting/degrading an existing row on a corpus shrink is
 * a separate, unaddressed question this implementation does not infer an
 * answer to (flagged, not silently decided).
 *
 * Override-safe by construction: `upsertFingerprint` never touches the
 * `overrides` column (see repository.ts), so a human correction written via
 * `setFingerprintOverrides` survives any number of subsequent recomputes.
 */
export async function recomputeFingerprint(profileId: string): Promise<StyleFingerprint | null> {
  const sources = await getCompletedV2Analyses(profileId, ANALYSIS_SCHEMA_VERSION);

  if (sources.length < MIN_ANALYSES_FOR_FINGERPRINT) {
    return null;
  }

  const { computed, consistencyIndex } = aggregateStyleFingerprint(sources);

  return upsertFingerprint({
    profileId,
    fingerprintVersion: FINGERPRINT_VERSION,
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    sampleSize: sources.length,
    sourceAnalysisIds: sources.map((source) => source.id),
    computed,
    consistencyIndex,
  });
}

/**
 * Read-time merge (Step 2): `{...computed, consistencyIndex, ...overrides}`
 * per top-level key, plus `overriddenKeys` so a UI can mark which fields are
 * human-set. A later recompute cannot destroy an override because it never
 * writes to the `overrides` column in the first place (repository.ts) —
 * this merge is what makes that survival visible to a reader.
 *
 * Overrides are applied LAST, after `computed` and `consistencyIndex`, so
 * an override on any content field — including `consistencyIndex` —
 * genuinely wins. Row-level provenance (`profileId`/`fingerprintVersion`/
 * `schemaVersion`/`createdAt`/`updatedAt`) is spread in after that and is
 * never overridable — those are this row's identity, not a computed value a
 * human could plausibly correct. `overriddenKeys` is filtered to exclude
 * `NON_OVERRIDABLE_FIELDS` so it only ever lists a key whose override
 * actually took effect.
 *
 * `sampleSize`/`sourceAnalysisIds` (TDD §3 D1) get the SAME belt-and-
 * suspenders treatment as provenance: `NON_OVERRIDABLE_FIELDS` keys are
 * stripped from a local copy of `overrides` BEFORE the read-merge spread —
 * they live inside `ComputedFingerprint`, so without this strip a legacy
 * override on either of them would win at read time despite being spread
 * before `computed`/`consistencyIndex`'s dedicated post-spread fields
 * below, this is the exact bug class already fixed for `consistencyIndex`
 * (`service.test.ts:192`), pointed the other way. `setFingerprintOverrides`
 * / `patchFingerprintOverrides` also reject writes to these keys, so this
 * strip only matters for a blob written before those guards existed.
 */
export async function getFingerprint(profileId: string): Promise<FingerprintView | null> {
  const row = await getFingerprintRow(profileId);
  if (!row) {
    return null;
  }

  const overrides = { ...(row.overrides ?? {}) };
  for (const key of NON_OVERRIDABLE_FIELDS) {
    delete overrides[key];
  }
  const overriddenKeys = Object.keys(overrides);

  return {
    ...row.computed,
    consistencyIndex: row.consistencyIndex,
    ...overrides,
    profileId: row.profileId,
    fingerprintVersion: row.fingerprintVersion,
    schemaVersion: row.schemaVersion,
    sampleSize: row.sampleSize,
    sourceAnalysisIds: row.sourceAnalysisIds,
    computedAt: row.computedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    overriddenKeys,
  } as FingerprintView;
}

/**
 * Ticket #73 sub-ticket A orchestrator (TDD §3 D4-D6, §5). Validates the
 * whole patch against the CURRENT `computed` before writing anything
 * (`INVALID` → nothing is written), delegates the actual merge to
 * `patchFingerprintOverrides`, then re-reads the merged view so a caller
 * (the route ticket, #116) needs no second round-trip.
 */
export async function applyFingerprintOverridePatch(
  profileId: string,
  patch: Record<string, unknown>,
): Promise<ApplyOverridePatchResult> {
  const row = await getFingerprintRow(profileId);
  if (!row) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  const validation = validateOverridePatch(patch, row.computed);
  if (!validation.ok) {
    return { ok: false, reason: "INVALID", invalidKeys: validation.invalidKeys };
  }

  const result = await patchFingerprintOverrides(profileId, patch);
  if (!result.ok) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  const view = await getFingerprint(profileId);
  if (!view) {
    throw new Error(`applyFingerprintOverridePatch: failed to re-read profile ${profileId} after patch`);
  }

  return { ok: true, view };
}
