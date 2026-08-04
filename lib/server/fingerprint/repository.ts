import { randomUUID } from "node:crypto";
import { db } from "@/lib/server/db";
import type { ContentAnalysis } from "@/lib/server/analysis/types";
import { NON_OVERRIDABLE_FIELDS } from "./constants";
import type {
  ComputedFingerprint,
  FingerprintSourceAnalysis,
  PatchOverridesResult,
  StyleFingerprint,
} from "./types";

/**
 * Source-analysis selection (Step 8, and the 2026-07-24 owner decision):
 * `status = 'completed' AND schema_version = 2` — the fingerprint must
 * never mix contract versions. Deliberately NO `coauthor_producers`
 * predicate: a co-authored post is a source row like any other, counted at
 * equal weight, no special-casing.
 *
 * `result_content` is parsed in application code rather than pulled apart
 * with `json_extract` per field (Step 9) — the corpus is dozens of rows per
 * profile, and a full JSON.parse per row is entirely adequate at that
 * volume. No Tier 1 value is promoted to an `analyses` column here.
 */
export async function getCompletedV2Analyses(
  profileId: string,
  schemaVersion: number,
): Promise<FingerprintSourceAnalysis[]> {
  const result = await db.execute({
    sql: `
      SELECT id, post_date, result_content
      FROM analyses
      WHERE profile_id = ? AND status = 'completed' AND schema_version = ?
      ORDER BY created_at ASC
    `,
    args: [profileId, schemaVersion],
  });

  return result.rows
    .map((row): FingerprintSourceAnalysis | null => {
      const resultContent = row.result_content as string | null;
      if (!resultContent) {
        return null;
      }
      const parsed = JSON.parse(resultContent) as ContentAnalysis;
      return {
        id: row.id as string,
        postDate: (row.post_date as string) ?? null,
        style: parsed.style,
      };
    })
    .filter((source): source is FingerprintSourceAnalysis => source !== null);
}

/**
 * Ticket #73 sub-ticket A (TDD §3 D7). Same `status = 'completed' AND
 * schema_version = ?` predicate as `getCompletedV2Analyses`, as a
 * `COUNT(*)` instead of a row-returning query — this is the corpus count
 * the D7 404 body ("how many more videos do I need") reports honestly
 * rather than inferring.
 */
export async function countCompletedV2Analyses(profileId: string, schemaVersion: number): Promise<number> {
  const result = await db.execute({
    sql: `
      SELECT COUNT(*) AS count
      FROM analyses
      WHERE profile_id = ? AND status = 'completed' AND schema_version = ?
    `,
    args: [profileId, schemaVersion],
  });

  return Number(result.rows[0]?.count ?? 0);
}

function mapRow(row: Record<string, unknown>): StyleFingerprint {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    fingerprintVersion: Number(row.fingerprint_version),
    schemaVersion: Number(row.schema_version),
    sampleSize: Number(row.sample_size),
    sourceAnalysisIds: JSON.parse(row.source_analysis_ids as string) as string[],
    computed: JSON.parse(row.computed as string) as ComputedFingerprint,
    overrides: row.overrides == null ? null : (JSON.parse(row.overrides as string) as Record<string, unknown>),
    consistencyIndex: Number(row.consistency_index),
    // Migration 011 (D2): fall back to `updated_at` for any row written
    // before `computed_at` existed, so this field can never surface `null`.
    computedAt: (row.computed_at as string | null) ?? (row.updated_at as string),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getFingerprintRow(profileId: string): Promise<StyleFingerprint | null> {
  const result = await db.execute({
    sql: "SELECT * FROM profile_style_fingerprints WHERE profile_id = ? LIMIT 1",
    args: [profileId],
  });

  const row = result.rows[0];
  return row ? mapRow(row as unknown as Record<string, unknown>) : null;
}

export interface UpsertFingerprintInput {
  profileId: string;
  fingerprintVersion: number;
  schemaVersion: number;
  sampleSize: number;
  sourceAnalysisIds: string[];
  computed: ComputedFingerprint;
  consistencyIndex: number;
}

/**
 * Override-safe recompute (Step 2). The `ON CONFLICT` clause's `SET` list
 * deliberately never mentions `overrides` — a recompute overwrites
 * `computed`/`fingerprint_version`/`schema_version`/`sample_size`/
 * `source_analysis_ids`/`consistency_index` in place, but the `overrides`
 * column is left completely untouched at the SQL level, whatever it held
 * before this call. This is the mechanism, not a convention layered on top
 * of it — there is no code path in this function that can write to
 * `overrides`.
 */
export async function upsertFingerprint(input: UpsertFingerprintInput): Promise<StyleFingerprint> {
  const id = randomUUID();

  const result = await db.execute({
    sql: `
      INSERT INTO profile_style_fingerprints (
        id, profile_id, fingerprint_version, schema_version, sample_size,
        source_analysis_ids, computed, consistency_index, computed_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
      ON CONFLICT(profile_id) DO UPDATE SET
        fingerprint_version  = excluded.fingerprint_version,
        schema_version       = excluded.schema_version,
        sample_size          = excluded.sample_size,
        source_analysis_ids  = excluded.source_analysis_ids,
        computed             = excluded.computed,
        consistency_index    = excluded.consistency_index,
        computed_at          = datetime('now'),
        updated_at           = datetime('now')
      RETURNING *
    `,
    args: [
      id,
      input.profileId,
      input.fingerprintVersion,
      input.schemaVersion,
      input.sampleSize,
      JSON.stringify(input.sourceAnalysisIds),
      JSON.stringify(input.computed),
      input.consistencyIndex,
    ],
  });

  const row = result.rows[0];
  if (!row) {
    const fallback = await getFingerprintRow(input.profileId);
    if (!fallback) {
      throw new Error(`upsertFingerprint: failed to read back profile ${input.profileId}`);
    }
    return fallback;
  }

  return mapRow(row as unknown as Record<string, unknown>);
}

/**
 * Sets (or clears, with `null`) the human-override blob for a profile's
 * fingerprint. Not wired to an API route by this ticket (Files Affected
 * lists no route) — exposed here as the primitive a future ticket's
 * endpoint and this ticket's own override-safety tests both call directly.
 *
 * Rejects an attempt to override a row-identity/provenance field, or
 * `sampleSize`/`sourceAnalysisIds` (see `NON_OVERRIDABLE_FIELDS`, TDD §3 D1)
 * — none of those are a computed value a human could plausibly correct, and
 * `getFingerprint`'s read-time merge never lets them win regardless, so
 * silently accepting the write would just be a write that can never
 * actually take effect.
 */
export async function setFingerprintOverrides(
  profileId: string,
  overrides: Record<string, unknown> | null,
): Promise<void> {
  if (overrides) {
    const rejected = Object.keys(overrides).filter((key) =>
      (NON_OVERRIDABLE_FIELDS as readonly string[]).includes(key),
    );
    if (rejected.length > 0) {
      throw new Error(
        `setFingerprintOverrides: cannot override non-overridable field(s): ${rejected.join(", ")}`,
      );
    }
  }

  await db.execute({
    sql: `
      UPDATE profile_style_fingerprints
      SET overrides = ?, updated_at = datetime('now')
      WHERE profile_id = ?
    `,
    args: [overrides == null ? null : JSON.stringify(overrides), profileId],
  });
}

/**
 * Ticket #73 sub-ticket A (TDD §3 D3/D6). Partial, shallow, top-level-only
 * merge into `overrides`: a patch key with a non-`null` value replaces that
 * top-level key; a `null` value DELETES that key (never stores a literal
 * JSON `null`); keys not mentioned in the patch are untouched. If the merge
 * empties the object, the column is written as SQL `NULL`, not `'{}'`.
 * `computed`/`computed_at` are never read-modified-written by this path —
 * only `overrides`/`updated_at` change.
 *
 * Deliberately NOT `json_patch()` (rejected in the TDD): it recurses into
 * nested objects (wrong for `dateRange`) and leaves `'{}'` rather than SQL
 * `NULL` on full deletion.
 *
 * Read-modify-write inside `db.transaction("write")` — the row's existence
 * is checked *inside* the transaction, and a missing row returns a typed
 * `{ok:false, reason:"NOT_FOUND"}` (D6) rather than the bare-UPDATE-affects-
 * 0-rows silent success `setFingerprintOverrides` has today.
 *
 * Rejects (throws) any patch attempt on a `NON_OVERRIDABLE_FIELDS` key,
 * same as `setFingerprintOverrides` — callers are expected to run
 * `validateOverridePatch` first so this throw path is a backstop, not the
 * primary rejection mechanism.
 */
export async function patchFingerprintOverrides(
  profileId: string,
  patch: Record<string, unknown>,
): Promise<PatchOverridesResult> {
  const rejected = Object.keys(patch).filter((key) => (NON_OVERRIDABLE_FIELDS as readonly string[]).includes(key));
  if (rejected.length > 0) {
    throw new Error(`patchFingerprintOverrides: cannot override non-overridable field(s): ${rejected.join(", ")}`);
  }

  const tx = await db.transaction("write");
  try {
    const existing = await tx.execute({
      sql: "SELECT * FROM profile_style_fingerprints WHERE profile_id = ? LIMIT 1",
      args: [profileId],
    });
    const existingRow = existing.rows[0] as unknown as Record<string, unknown> | undefined;
    if (!existingRow) {
      return { ok: false, reason: "NOT_FOUND" };
    }

    const rawOverrides = existingRow.overrides as string | null;
    const currentOverrides: Record<string, unknown> = rawOverrides == null ? {} : JSON.parse(rawOverrides);

    // Defensive strip (D1c): a legacy blob written before write-time
    // rejection existed must never let a non-overridable key survive a
    // merge into the stored column.
    for (const key of NON_OVERRIDABLE_FIELDS) {
      delete currentOverrides[key];
    }

    const merged: Record<string, unknown> = { ...currentOverrides };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) {
        delete merged[key];
      } else {
        merged[key] = value;
      }
    }

    const nextOverrides = Object.keys(merged).length === 0 ? null : JSON.stringify(merged);

    const updated = await tx.execute({
      sql: `
        UPDATE profile_style_fingerprints
        SET overrides = ?, updated_at = datetime('now')
        WHERE profile_id = ?
        RETURNING *
      `,
      args: [nextOverrides, profileId],
    });

    await tx.commit();

    const updatedRow = updated.rows[0];
    if (!updatedRow) {
      throw new Error(`patchFingerprintOverrides: failed to read back profile ${profileId} after patch`);
    }

    return { ok: true, row: mapRow(updatedRow as unknown as Record<string, unknown>) };
  } finally {
    tx.close();
  }
}
