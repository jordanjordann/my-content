import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import type { StyleAttributes } from "@/lib/server/analysis/types";

/**
 * DB-level tests for the fingerprint module (repository.ts + service.ts).
 * `aggregate.ts` itself is pure and tested with zero I/O in aggregate.test.ts
 * — this file exercises everything that touches `profile_style_fingerprints`
 * and `analyses`: the cold-start write gate, override-safe recompute,
 * schema_version filtering, and co-authored-post inclusion.
 *
 * Runs every migration against a fresh `:memory:` libsql database per test
 * (same technique as tests/server/db/migrations.schema.test.ts) — no live
 * network, no shared state between tests.
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
  opts: {
    profileId: string;
    schemaVersion: number | null;
    status?: string;
    style?: Partial<StyleAttributes>;
    coauthorProducers?: string[] | null;
    postDate?: string | null;
  },
): Promise<string> {
  const id = randomUUID();
  const content = { schemaVersion: opts.schemaVersion ?? 2, style: buildStyle(opts.style) };
  await db.execute({
    sql: `
      INSERT INTO analyses (
        id, prompt, url, platform, media_type, profile_id, status,
        schema_version, result_content, post_date, coauthor_producers
      ) VALUES (?, 'p', 'https://instagram.com/reel/x', 'instagram', 'reel', ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      opts.profileId,
      opts.status ?? "completed",
      opts.schemaVersion,
      JSON.stringify(content),
      opts.postDate ?? null,
      opts.coauthorProducers == null ? null : JSON.stringify(opts.coauthorProducers),
    ],
  });
  return id;
}

let db: Client;

beforeEach(async () => {
  vi.resetModules();
  process.env.TURSO_DATABASE_URL = ":memory:";
  delete process.env.TURSO_AUTH_TOKEN;
  const dbModule = await import("@/lib/server/db");
  db = dbModule.db;
  await runMigrations(db);
});

afterEach(() => {
  db?.close();
  vi.restoreAllMocks();
});

describe("recomputeFingerprint — cold start (Step 6)", () => {
  it("writes no row at 4 completed schema_version=2 analyses", async () => {
    const { recomputeFingerprint, getFingerprintRow } = await import("@/lib/server/fingerprint");
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 4; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }

    const result = await recomputeFingerprint(profileId);
    expect(result).toBeNull();
    expect(await getFingerprintRow(profileId)).toBeNull();
  });

  it("writes a row with sample_size = 5 once the 5th qualifying analysis lands", async () => {
    const { recomputeFingerprint } = await import("@/lib/server/fingerprint");
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }

    const result = await recomputeFingerprint(profileId);
    expect(result).not.toBeNull();
    expect(result!.sampleSize).toBe(5);
  });
});

describe("recomputeFingerprint — schema_version filtering (Step 8)", () => {
  it("counts only schema_version = 2 rows, ignoring other versions", async () => {
    const { recomputeFingerprint } = await import("@/lib/server/fingerprint");
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }
    // Two legacy/other-version rows that must NOT count toward the corpus.
    await insertAnalysis(db, { profileId, schemaVersion: 1 });
    await insertAnalysis(db, { profileId, schemaVersion: null });

    const result = await recomputeFingerprint(profileId);
    expect(result!.sampleSize).toBe(5);
  });

  it("ignores non-completed analyses", async () => {
    const { recomputeFingerprint } = await import("@/lib/server/fingerprint");
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }
    await insertAnalysis(db, { profileId, schemaVersion: 2, status: "pending" });

    const result = await recomputeFingerprint(profileId);
    expect(result!.sampleSize).toBe(5);
  });
});

describe("recomputeFingerprint — override-safe recompute (Step 2)", () => {
  it("survives a recompute: overrides untouched, computed/sampleSize update underneath it", async () => {
    const { recomputeFingerprint, setFingerprintOverrides, getFingerprint, getFingerprintRow } = await import(
      "@/lib/server/fingerprint"
    );
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }

    await recomputeFingerprint(profileId);
    await setFingerprintOverrides(profileId, { audienceCalloutRate: 0.99 });

    // A 6th analysis lands; recompute runs again.
    await insertAnalysis(db, { profileId, schemaVersion: 2 });
    await recomputeFingerprint(profileId);

    const row = await getFingerprintRow(profileId);
    expect(row!.sampleSize).toBe(6); // computed updated underneath the override
    expect(row!.overrides).toEqual({ audienceCalloutRate: 0.99 }); // override survived

    const merged = await getFingerprint(profileId);
    expect(merged!.audienceCalloutRate).toBe(0.99); // override wins at read time
    expect(merged!.overriddenKeys).toEqual(["audienceCalloutRate"]);
  });
});

describe("recomputeFingerprint — co-authored posts count at equal weight (owner decision, 2026-07-24)", () => {
  it("includes a co-authored analysis in the corpus with no coauthor_producers filter", async () => {
    const { recomputeFingerprint } = await import("@/lib/server/fingerprint");
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    for (let i = 0; i < 3; i++) {
      await insertAnalysis(db, { profileId, schemaVersion: 2 });
    }
    // 2 co-authored posts, same as the giorrando sample in the ticket body.
    await insertAnalysis(db, { profileId, schemaVersion: 2, coauthorProducers: ["sandiuno"] });
    await insertAnalysis(db, { profileId, schemaVersion: 2, coauthorProducers: ["someoneElse"] });

    const result = await recomputeFingerprint(profileId);
    expect(result).not.toBeNull();
    expect(result!.sampleSize).toBe(5);
  });
});
