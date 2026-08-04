import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import type { StyleAttributes } from "@/lib/server/analysis/types";

/**
 * Ticket #115 (TDD `docs/TDD-fingerprint-read-override-api.md` §3
 * D1/D3-D7). Exercises: NON_OVERRIDABLE_FIELDS rejection at write time and
 * at read time; the partial-patch primitive's null-deletes / SQL-NULL-on-
 * empty semantics; validateOverridePatch's allow-list + taxonomy guards +
 * exemplar-subset rule; the honest not-found result; and computed_at vs
 * updated_at independence.
 *
 * Uses a per-test TEMP FILE database, not `:memory:` (unlike
 * service.test.ts). `@libsql/client`'s local sqlite3 driver's
 * `db.transaction()` "steals" the client's underlying connection handle and
 * lazily opens a NEW one on the next `.execute()` call
 * (`Sqlite3Client.transaction`, `node_modules/@libsql/client/lib-esm/sqlite3.js`).
 * For a real file path, that new connection reopens the same persisted
 * file and sees the same tables. For `:memory:`, a new connection is a
 * brand-new, empty, unrelated in-memory database — so any test that calls
 * `patchFingerprintOverrides` (which opens a transaction) and then makes
 * ANY further call through the shared `db` client (a raw check, or another
 * repository function) would hit a fresh, migration-less database and fail
 * with "no such table". A temp file sidesteps this entirely.
 */

function buildStyle(overrides: Partial<StyleAttributes> = {}): StyleAttributes {
  return {
    topicNiche: "FOOD_CULINARY",
    topicSubtopic: "resep cepat",
    formatArchetype: "TALKING_HEAD",
    hookType: "DIRECT_VALUE_PROMISE",
    hookTypeSecondary: null,
    hasAudienceCallout: false,
    hookText: "Ini resep favoritku",
    structureBeatMap: [{ timestampSec: 0, beatType: "HOOK", description: "pembuka" }],
    pacing: "MEDIUM",
    estimatedCutsPerMinute: 10,
    ctaType: ["FOLLOW"],
    ctaTiming: "END",
    onScreenText: ["Resep hari ini"],
    captionStyleNotes: "Gaya santai dengan emoji",
    verbalTonePatterns: ["santai"],
    ...overrides,
  };
}

async function runMigrations(db: Client): Promise<void> {
  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.executeMultiple(readFileSync(join(migrationsDir, file), "utf8"));
  }
}

async function insertProfile(db: Client, id: string): Promise<void> {
  await db.execute({
    sql: "INSERT INTO profiles (id, platform, username) VALUES (?, 'instagram', ?)",
    args: [id, `creator-${id}`],
  });
}

async function insertAnalysis(
  db: Client,
  opts: { profileId: string; schemaVersion?: number | null; status?: string; style?: Partial<StyleAttributes> },
): Promise<string> {
  const id = randomUUID();
  const content = { schemaVersion: opts.schemaVersion ?? 2, style: buildStyle(opts.style) };
  await db.execute({
    sql: `
      INSERT INTO analyses (
        id, prompt, url, platform, media_type, profile_id, status, schema_version, result_content
      ) VALUES (?, 'p', 'https://instagram.com/reel/x', 'instagram', 'reel', ?, ?, ?, ?)
    `,
    args: [id, opts.profileId, opts.status ?? "completed", opts.schemaVersion ?? 2, JSON.stringify(content)],
  });
  return id;
}

async function insertQualifyingProfile(db: Client, count = 5): Promise<string> {
  const profileId = randomUUID();
  await insertProfile(db, profileId);
  for (let i = 0; i < count; i++) {
    await insertAnalysis(db, { profileId });
  }
  return profileId;
}

let db: Client;
let dbPath: string;

beforeEach(async () => {
  vi.resetModules();
  dbPath = join(tmpdir(), `fingerprint-overrides-${randomUUID()}.db`);
  process.env.TURSO_DATABASE_URL = `file:${dbPath}`;
  delete process.env.TURSO_AUTH_TOKEN;
  const dbModule = await import("@/lib/server/db");
  db = dbModule.db;
  await runMigrations(db);
});

afterEach(() => {
  db?.close();
  vi.restoreAllMocks();
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = `${dbPath}${suffix}`;
    if (existsSync(file)) {
      rmSync(file);
    }
  }
});

describe("NON_OVERRIDABLE_FIELDS — write-time rejection (D1)", () => {
  it("setFingerprintOverrides rejects an override attempt on sampleSize", async () => {
    const { recomputeFingerprint, setFingerprintOverrides } = await import("@/lib/server/fingerprint");
    const profileId = await insertQualifyingProfile(db);
    await recomputeFingerprint(profileId);

    await expect(setFingerprintOverrides(profileId, { sampleSize: 999 })).rejects.toThrow(
      /non-overridable field/,
    );
  });

  it("setFingerprintOverrides rejects an override attempt on sourceAnalysisIds", async () => {
    const { recomputeFingerprint, setFingerprintOverrides } = await import("@/lib/server/fingerprint");
    const profileId = await insertQualifyingProfile(db);
    await recomputeFingerprint(profileId);

    await expect(setFingerprintOverrides(profileId, { sourceAnalysisIds: ["fake-id"] })).rejects.toThrow(
      /non-overridable field/,
    );
  });

  it("patchFingerprintOverrides rejects an override attempt on sampleSize", async () => {
    const { recomputeFingerprint, patchFingerprintOverrides } = await import("@/lib/server/fingerprint");
    const profileId = await insertQualifyingProfile(db);
    await recomputeFingerprint(profileId);

    await expect(patchFingerprintOverrides(profileId, { sampleSize: 999 })).rejects.toThrow(
      /non-overridable field/,
    );
  });

  it("patchFingerprintOverrides rejects an override attempt on sourceAnalysisIds", async () => {
    const { recomputeFingerprint, patchFingerprintOverrides } = await import("@/lib/server/fingerprint");
    const profileId = await insertQualifyingProfile(db);
    await recomputeFingerprint(profileId);

    await expect(patchFingerprintOverrides(profileId, { sourceAnalysisIds: ["fake-id"] })).rejects.toThrow(
      /non-overridable field/,
    );
  });

  it("validateOverridePatch reports sampleSize as invalid (not silently dropped)", async () => {
    const { recomputeFingerprint, validateOverridePatch, getFingerprintRow } = await import(
      "@/lib/server/fingerprint"
    );
    const profileId = await insertQualifyingProfile(db);
    const row = (await recomputeFingerprint(profileId)) ?? (await getFingerprintRow(profileId))!;

    const result = validateOverridePatch({ sampleSize: 999 }, row.computed);
    expect(result).toEqual({ ok: false, invalidKeys: ["sampleSize"] });
  });

  it("validateOverridePatch reports sourceAnalysisIds as invalid (not silently dropped)", async () => {
    const { recomputeFingerprint, validateOverridePatch, getFingerprintRow } = await import(
      "@/lib/server/fingerprint"
    );
    const profileId = await insertQualifyingProfile(db);
    const row = (await recomputeFingerprint(profileId)) ?? (await getFingerprintRow(profileId))!;

    const result = validateOverridePatch({ sourceAnalysisIds: ["fake-id"] }, row.computed);
    expect(result).toEqual({ ok: false, invalidKeys: ["sourceAnalysisIds"] });
  });
});

describe("NON_OVERRIDABLE_FIELDS — cannot win at read time even in a legacy stored blob (D1)", () => {
  it("a sampleSize key that somehow got into the overrides column is stripped before the read-merge", async () => {
    const { recomputeFingerprint, getFingerprint } = await import("@/lib/server/fingerprint");
    const profileId = await insertQualifyingProfile(db, 5);
    await recomputeFingerprint(profileId);

    // Bypass the application-layer guard entirely — simulate a legacy blob
    // written before write-time rejection existed.
    await db.execute({
      sql: "UPDATE profile_style_fingerprints SET overrides = ? WHERE profile_id = ?",
      args: [JSON.stringify({ sampleSize: 999 }), profileId],
    });

    const merged = await getFingerprint(profileId);
    expect(merged!.sampleSize).toBe(5);
    expect(merged!.overriddenKeys).not.toContain("sampleSize");
  });

  it("a sourceAnalysisIds key that somehow got into the overrides column is stripped before the read-merge", async () => {
    const { recomputeFingerprint, getFingerprint, getFingerprintRow } = await import("@/lib/server/fingerprint");
    const profileId = await insertQualifyingProfile(db, 5);
    await recomputeFingerprint(profileId);
    const originalIds = (await getFingerprintRow(profileId))!.sourceAnalysisIds;

    await db.execute({
      sql: "UPDATE profile_style_fingerprints SET overrides = ? WHERE profile_id = ?",
      args: [JSON.stringify({ sourceAnalysisIds: ["fake-id"] }), profileId],
    });

    const merged = await getFingerprint(profileId);
    expect(merged!.sourceAnalysisIds).toEqual(originalIds);
    expect(merged!.overriddenKeys).not.toContain("sourceAnalysisIds");
  });
});

describe("patchFingerprintOverrides — partial merge semantics (D3)", () => {
  it("{ key: null } removes that override key; the merged read reverts to computed", async () => {
    const { recomputeFingerprint, patchFingerprintOverrides, getFingerprint } = await import(
      "@/lib/server/fingerprint"
    );
    const profileId = await insertQualifyingProfile(db);
    await recomputeFingerprint(profileId);

    await patchFingerprintOverrides(profileId, { audienceCalloutRate: 0.99 });
    let merged = await getFingerprint(profileId);
    expect(merged!.audienceCalloutRate).toBe(0.99);

    const removeResult = await patchFingerprintOverrides(profileId, { audienceCalloutRate: null });
    expect(removeResult.ok).toBe(true);

    merged = await getFingerprint(profileId);
    expect(merged!.audienceCalloutRate).not.toBe(0.99);
    expect(merged!.overriddenKeys).not.toContain("audienceCalloutRate");
  });

  it("removing the last remaining override key leaves the overrides column as SQL NULL", async () => {
    const { recomputeFingerprint, patchFingerprintOverrides } = await import("@/lib/server/fingerprint");
    const profileId = await insertQualifyingProfile(db);
    await recomputeFingerprint(profileId);

    await patchFingerprintOverrides(profileId, { audienceCalloutRate: 0.99 });
    await patchFingerprintOverrides(profileId, { audienceCalloutRate: null });

    const raw = await db.execute({
      sql: "SELECT overrides FROM profile_style_fingerprints WHERE profile_id = ?",
      args: [profileId],
    });
    expect(raw.rows[0]!.overrides).toBeNull();
  });

  it("a patch key not mentioned before is untouched, and a second key can be added alongside it", async () => {
    const { recomputeFingerprint, patchFingerprintOverrides } = await import("@/lib/server/fingerprint");
    const profileId = await insertQualifyingProfile(db);
    await recomputeFingerprint(profileId);

    await patchFingerprintOverrides(profileId, { audienceCalloutRate: 0.99 });
    const result = await patchFingerprintOverrides(profileId, { consistencyIndex: 0.42 });

    expect(result.ok).toBe(true);
    expect(result.ok && result.row.overrides).toEqual({ audienceCalloutRate: 0.99, consistencyIndex: 0.42 });
  });

  it("returns a typed not-found result for a profile with no fingerprint row (D6)", async () => {
    const { patchFingerprintOverrides } = await import("@/lib/server/fingerprint");
    const profileId = randomUUID();
    await insertProfile(db, profileId);

    const result = await patchFingerprintOverrides(profileId, { audienceCalloutRate: 0.5 });
    expect(result).toEqual({ ok: false, reason: "NOT_FOUND" });
  });
});

describe("applyFingerprintOverridePatch — validation gate (D4/D5, nothing written on invalid)", () => {
  it("rejects an invalid enum value, names the offending key, and writes nothing", async () => {
    const { recomputeFingerprint, applyFingerprintOverridePatch, getFingerprintRow } = await import(
      "@/lib/server/fingerprint"
    );
    const profileId = await insertQualifyingProfile(db);
    await recomputeFingerprint(profileId);
    const before = await getFingerprintRow(profileId);

    const result = await applyFingerprintOverridePatch(profileId, {
      pacingDistribution: [{ value: "NOT_A_REAL_PACING", count: 1, share: 1 }],
    });

    expect(result).toEqual({ ok: false, reason: "INVALID", invalidKeys: ["pacingDistribution"] });
    const after = await getFingerprintRow(profileId);
    expect(after!.overrides).toEqual(before!.overrides);
  });

  it("rejects an unknown key and writes nothing", async () => {
    const { recomputeFingerprint, applyFingerprintOverridePatch, getFingerprintRow } = await import(
      "@/lib/server/fingerprint"
    );
    const profileId = await insertQualifyingProfile(db);
    await recomputeFingerprint(profileId);

    const result = await applyFingerprintOverridePatch(profileId, { totallyMadeUpKey: "x" });

    expect(result).toEqual({ ok: false, reason: "INVALID", invalidKeys: ["totallyMadeUpKey"] });
    expect((await getFingerprintRow(profileId))!.overrides).toBeNull();
  });

  it("rejects an exemplar string not present in the corresponding computed array, and writes nothing (D5)", async () => {
    const { recomputeFingerprint, applyFingerprintOverridePatch, getFingerprintRow } = await import(
      "@/lib/server/fingerprint"
    );
    const profileId = await insertQualifyingProfile(db);
    await recomputeFingerprint(profileId);

    const result = await applyFingerprintOverridePatch(profileId, {
      hookTextExemplars: ["something the creator never said"],
    });

    expect(result).toEqual({ ok: false, reason: "INVALID", invalidKeys: ["hookTextExemplars"] });
    expect((await getFingerprintRow(profileId))!.overrides).toBeNull();
  });

  it("accepts an exemplar override that only prunes/reorders the computed array", async () => {
    const { recomputeFingerprint, applyFingerprintOverridePatch, getFingerprintRow } = await import(
      "@/lib/server/fingerprint"
    );
    const profileId = await insertQualifyingProfile(db);
    await recomputeFingerprint(profileId);
    const computed = (await getFingerprintRow(profileId))!.computed;
    expect(computed.hookTextExemplars.length).toBeGreaterThan(0);

    const pruned = [computed.hookTextExemplars[0]!];
    const result = await applyFingerprintOverridePatch(profileId, { hookTextExemplars: pruned });

    expect(result.ok).toBe(true);
    expect(result.ok && result.view.hookTextExemplars).toEqual(pruned);
  });

  it("returns NOT_FOUND for a profile with no fingerprint row before running validation", async () => {
    const { applyFingerprintOverridePatch } = await import("@/lib/server/fingerprint");
    const profileId = randomUUID();
    await insertProfile(db, profileId);

    const result = await applyFingerprintOverridePatch(profileId, { audienceCalloutRate: 0.5 });
    expect(result).toEqual({ ok: false, reason: "NOT_FOUND" });
  });
});

describe("computed_at vs updated_at independence (D2)", () => {
  it("a recompute updates computed_at", async () => {
    const { recomputeFingerprint } = await import("@/lib/server/fingerprint");
    const profileId = await insertQualifyingProfile(db);

    const first = await recomputeFingerprint(profileId);
    const firstComputedAt = first!.computedAt;

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await insertAnalysis(db, { profileId });
    const second = await recomputeFingerprint(profileId);

    expect(second!.computedAt).not.toBe(firstComputedAt);
  });

  it("a PATCH via patchFingerprintOverrides updates updated_at but NOT computed_at", async () => {
    const { recomputeFingerprint, patchFingerprintOverrides, getFingerprintRow } = await import(
      "@/lib/server/fingerprint"
    );
    const profileId = await insertQualifyingProfile(db);
    await recomputeFingerprint(profileId);
    const before = await getFingerprintRow(profileId);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await patchFingerprintOverrides(profileId, { audienceCalloutRate: 0.99 });
    const after = await getFingerprintRow(profileId);

    expect(after!.computedAt).toBe(before!.computedAt);
    expect(after!.updatedAt).not.toBe(before!.updatedAt);
  });
});

describe("countCompletedV2Analyses (D7)", () => {
  it("matches the length of getCompletedV2Analyses for the same predicate", async () => {
    const { countCompletedV2Analyses, getCompletedV2Analyses } = await import("@/lib/server/fingerprint");
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 4; i++) {
      await insertAnalysis(db, { profileId });
    }
    await insertAnalysis(db, { profileId, schemaVersion: 1 }); // must not count
    await insertAnalysis(db, { profileId, status: "pending" }); // must not count

    const rows = await getCompletedV2Analyses(profileId, 2);
    const count = await countCompletedV2Analyses(profileId, 2);

    expect(count).toBe(rows.length);
    expect(count).toBe(4);
  });

  it("returns 0 for a profile with no qualifying analyses", async () => {
    const { countCompletedV2Analyses } = await import("@/lib/server/fingerprint");
    const profileId = randomUUID();
    await insertProfile(db, profileId);

    expect(await countCompletedV2Analyses(profileId, 2)).toBe(0);
  });
});
