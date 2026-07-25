import { ANALYSIS_SCHEMA_VERSION } from "@/lib/server/analysis/schema";
import { aggregateStyleFingerprint } from "./aggregate";
import { MIN_ANALYSES_FOR_FINGERPRINT, FINGERPRINT_VERSION, PROVENANCE_FIELDS } from "./constants";
import { getCompletedV2Analyses, getFingerprintRow, upsertFingerprint } from "./repository";
import type { FingerprintView, StyleFingerprint } from "./types";

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
 * provenance fields so it only ever lists a key whose override actually
 * took effect (see `PROVENANCE_FIELDS`; `setFingerprintOverrides` also
 * rejects writes to these keys, so this filter is belt-and-suspenders for
 * any override written before that guard existed).
 */
export async function getFingerprint(profileId: string): Promise<FingerprintView | null> {
  const row = await getFingerprintRow(profileId);
  if (!row) {
    return null;
  }

  const overrides = row.overrides ?? {};
  const overriddenKeys = Object.keys(overrides).filter(
    (key) => !(PROVENANCE_FIELDS as readonly string[]).includes(key),
  );

  return {
    ...row.computed,
    consistencyIndex: row.consistencyIndex,
    ...overrides,
    profileId: row.profileId,
    fingerprintVersion: row.fingerprintVersion,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    overriddenKeys,
  } as FingerprintView;
}
