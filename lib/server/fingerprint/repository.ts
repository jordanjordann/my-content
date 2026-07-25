import { randomUUID } from "node:crypto";
import { db } from "@/lib/server/db";
import type { ContentAnalysis } from "@/lib/server/analysis/types";
import type { ComputedFingerprint, FingerprintSourceAnalysis, StyleFingerprint } from "./types";

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
        source_analysis_ids, computed, consistency_index, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(profile_id) DO UPDATE SET
        fingerprint_version  = excluded.fingerprint_version,
        schema_version       = excluded.schema_version,
        sample_size          = excluded.sample_size,
        source_analysis_ids  = excluded.source_analysis_ids,
        computed             = excluded.computed,
        consistency_index    = excluded.consistency_index,
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
 */
export async function setFingerprintOverrides(
  profileId: string,
  overrides: Record<string, unknown> | null,
): Promise<void> {
  await db.execute({
    sql: `
      UPDATE profile_style_fingerprints
      SET overrides = ?, updated_at = datetime('now')
      WHERE profile_id = ?
    `,
    args: [overrides == null ? null : JSON.stringify(overrides), profileId],
  });
}
