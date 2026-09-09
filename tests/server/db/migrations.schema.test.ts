import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";

/**
 * PR #95 review item 5: a `PRAGMA table_info`/`index_list` assertion test
 * over the FULL migration chain (001 -> latest), run against a fresh
 * in-memory database — not a hand-verification of one migration's diff.
 * This class of full-table-rebuild migration (004, 005, 009, ...) will
 * recur, and hand-verification doesn't scale; this test re-derives the
 * expected schema from actually running every migration file in order, so
 * a future migration that silently drops a column or index fails a real
 * assertion instead of relying on a reviewer re-deriving the column algebra
 * by hand every time.
 */

// Migration 009's own column list — kept separate from
// EXPECTED_ANALYSES_COLUMNS below because 009's INSERT...SELECT alignment
// test (below) checks a historical migration file's *own* column count
// (39), which migration 012 does not retroactively change.
const EXPECTED_ANALYSES_COLUMNS_AFTER_009 = [
  "id",
  "prompt",
  "raw_gemini",
  "status",
  "created_at",
  "updated_at",
  "title",
  "url",
  "platform",
  "media_type",
  "username",
  "thumbnail_url",
  "video_url",
  "duration_sec",
  "view_count",
  "post_date",
  "caption",
  "gemini_file_uri",
  "gemini_file_expires_at",
  "result_content",
  "result_created_at",
  "like_count",
  "comment_count",
  "has_audio",
  "audio_title",
  "audio_artist",
  "audio_id",
  "audio_is_original",
  "original_width",
  "original_height",
  "carousel_item_count",
  "profile_id",
  "follower_count",
  "engagement_rate",
  "analysis_mode",
  "schema_version",
  "play_count",
  "coauthor_producers",
  "like_and_view_counts_disabled",
];

// Migration 012 (ticket #139, TDD §5.2): drops `engagement_rate` (38 of the
// 39 above survive) and adds the performance-block columns. NOTE: the TDD
// header and the ticket both say "39 -> 52 (add 14)"; the actual §5.2
// per-column table lists 17 distinct new columns, referenced by name
// throughout the rest of the TDD (§4, §6, §7, §9). This test follows the
// per-column table (38 + 17 = 55), not the summary arithmetic — flagged in
// the ticket #139 PR description rather than silently reconciled.
const EXPECTED_ANALYSES_COLUMNS = [
  "id",
  "prompt",
  "raw_gemini",
  "status",
  "created_at",
  "updated_at",
  "title",
  "url",
  "platform",
  "media_type",
  "username",
  "thumbnail_url",
  "video_url",
  "duration_sec",
  "view_count",
  "post_date",
  "caption",
  "gemini_file_uri",
  "gemini_file_expires_at",
  "result_content",
  "result_created_at",
  "like_count",
  "comment_count",
  "has_audio",
  "audio_title",
  "audio_artist",
  "audio_id",
  "audio_is_original",
  "original_width",
  "original_height",
  "carousel_item_count",
  "profile_id",
  "follower_count",
  "analysis_mode",
  "schema_version",
  "play_count",
  "coauthor_producers",
  "like_and_view_counts_disabled",
  "perf_reach_value",
  "perf_reach_kind",
  "perf_reach_derived_from",
  "perf_tier1_ratio",
  "perf_tier1_denominator",
  "perf_bucket_key",
  "perf_baseline_median",
  "perf_baseline_sample_size",
  "perf_multiplier",
  "perf_post_age_hours",
  "audience_source_fetched_at",
  "perf_tier_used",
  "perf_confidence",
  "perf_confidence_reason",
  "perf_provisional",
  "perf_unavailable_reason",
  "performance_score",
];

const EXPECTED_ANALYSES_INDEXES = [
  "idx_analyses_updated_at",
  "idx_analyses_title",
  "idx_analyses_username",
  "idx_analyses_platform",
  "idx_analyses_profile_id",
  "idx_analyses_schema_version",
  "idx_analyses_profile_bucket",
  "idx_analyses_performance_score",
];

// Migration 010 (11 cols) + migration 011's `+ computed_at` (ticket #115,
// TDD §3 D2) = 12 columns.
const EXPECTED_FINGERPRINT_COLUMNS = [
  "id",
  "profile_id",
  "fingerprint_version",
  "schema_version",
  "sample_size",
  "source_analysis_ids",
  "computed",
  "overrides",
  "consistency_index",
  "created_at",
  "updated_at",
  "computed_at",
];

const EXPECTED_FINGERPRINT_INDEXES = ["idx_profile_style_fingerprints_profile_id"];

// Migration 015 (ticket #351, 3A-M1a): the jobs table.
const EXPECTED_JOBS_COLUMNS = [
  "id",
  "kind",
  "status",
  "payload",
  "dedupe_key",
  "attempts",
  "max_attempts",
  "claimed_at",
  "claimed_by",
  "heartbeat_at",
  "last_error",
  "analysis_id",
  "progress_step",
  "progress_message",
  "created_at",
  "updated_at",
];

const EXPECTED_JOBS_INDEXES = ["idx_jobs_dedupe", "idx_jobs_status_created", "idx_jobs_heartbeat"];

async function runMigrations(db: Client): Promise<void> {
  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await db.executeMultiple(sql);
  }
}

describe("migration chain (001 -> latest) — analyses schema assertion", () => {
  let db: Client | undefined;

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it("produces exactly the expected named columns on `analyses`, in order, with no drops", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    const result = await db.execute("PRAGMA table_info(analyses)");
    const columns = result.rows.map((row) => row.name as string);

    expect(columns).toEqual(EXPECTED_ANALYSES_COLUMNS);
  });

  it("produces exactly the expected indexes on `analyses`, with no drops", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    const result = await db.execute("PRAGMA index_list(analyses)");
    const indexes = result.rows
      .map((row) => row.name as string)
      // SQLite auto-generates unnamed indexes for UNIQUE/PK constraints
      // (named `sqlite_autoindex_...`) — this test only asserts the
      // explicitly-created `idx_*` indexes, which are what a migration
      // could actually silently drop.
      .filter((name) => name.startsWith("idx_"));

    expect(indexes.sort()).toEqual([...EXPECTED_ANALYSES_INDEXES].sort());
  });

  it("keeps the analyses table's INSERT...SELECT column lists in 009 positionally aligned (39 columns each)", () => {
    const sql = readFileSync(join(process.cwd(), "migrations/009_analysis_mode_images_only.sql"), "utf8");

    const insertMatch = sql.match(/INSERT INTO analyses_new \(([\s\S]*?)\)\s*SELECT/);
    const selectMatch = sql.match(/SELECT\s+([\s\S]*?)\s*FROM analyses;/);
    expect(insertMatch).not.toBeNull();
    expect(selectMatch).not.toBeNull();

    const insertCols = insertMatch![1]
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const selectVals = selectMatch![1]
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    expect(insertCols).toHaveLength(39);
    expect(selectVals).toHaveLength(39);
    expect(insertCols).toEqual(EXPECTED_ANALYSES_COLUMNS_AFTER_009);
  });

  it("keeps the analyses table's INSERT...SELECT column lists in 012 positionally aligned (55 columns each)", () => {
    const sql = readFileSync(join(process.cwd(), "migrations/012_performance_block.sql"), "utf8");

    const insertMatch = sql.match(/INSERT INTO analyses_new \(([\s\S]*?)\)\s*SELECT/);
    const selectMatch = sql.match(/SELECT\s+([\s\S]*?)\s*FROM analyses;/);
    expect(insertMatch).not.toBeNull();
    expect(selectMatch).not.toBeNull();

    const insertCols = insertMatch![1]
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const selectVals = selectMatch![1]
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    expect(insertCols).toHaveLength(55);
    expect(selectVals).toHaveLength(55);
    expect(insertCols).toEqual(EXPECTED_ANALYSES_COLUMNS);
  });

  // Ticket 3B-7 / #155 (OR-26): 013 is a full rebuild solely to widen the
  // perf_unavailable_reason CHECK. No column is added or dropped, so the
  // positional column list stays 55/55 and identical to 012's.
  it("keeps the analyses table's INSERT...SELECT column lists in 013 positionally aligned (55 columns each)", () => {
    const sql = readFileSync(join(process.cwd(), "migrations/013_reach_unavailable_reason.sql"), "utf8");

    const insertMatch = sql.match(/INSERT INTO analyses_new \(([\s\S]*?)\)\s*SELECT/);
    const selectMatch = sql.match(/SELECT\s+([\s\S]*?)\s*FROM analyses;/);
    expect(insertMatch).not.toBeNull();
    expect(selectMatch).not.toBeNull();

    const insertCols = insertMatch![1]
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const selectVals = selectMatch![1]
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    expect(insertCols).toHaveLength(55);
    expect(selectVals).toHaveLength(55);
    expect(insertCols).toEqual(EXPECTED_ANALYSES_COLUMNS);
  });

  // Ticket 3B-7 / #155 (OR-26): 013 must differ from 012's `analyses` schema
  // in EXACTLY one CHECK constraint (perf_unavailable_reason) and nothing
  // else — proven by running the chain up to 012, snapshotting
  // sqlite_master.sql for `analyses`, running 013, and diffing.
  it("013 changes exactly one CHECK on `analyses` relative to 012 — perf_unavailable_reason, and nothing else", async () => {
    db = createClient({ url: ":memory:" });

    const migrationsDir = join(process.cwd(), "migrations");
    const files = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    const before013 = files.filter((file) => !file.startsWith("013_"));
    const migration013 = files.find((file) => file.startsWith("013_"));
    expect(migration013).toBeDefined();

    for (const file of before013) {
      await db.executeMultiple(readFileSync(join(migrationsDir, file), "utf8"));
    }

    const beforeResult = await db.execute(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'analyses'",
    );
    const schemaBefore = beforeResult.rows[0]!.sql as string;

    await db.executeMultiple(readFileSync(join(migrationsDir, migration013!), "utf8"));

    const afterResult = await db.execute(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'analyses'",
    );
    const schemaAfter = afterResult.rows[0]!.sql as string;

    expect(schemaBefore).not.toEqual(schemaAfter);

    // Isolate the delta to the perf_unavailable_reason column (its
    // explanatory comment block plus its CHECK clause) by stripping that
    // whole span out of both schemas and asserting what remains — every
    // other column, CHECK, comment and index — is byte-identical.
    const stripUnavailableReasonCheck = (schema: string): string =>
      schema.replace(
        /-- Enum per TDD §5\.3[\s\S]*?perf_unavailable_reason TEXT CHECK\([^;]*?\)\),/,
        "<stripped perf_unavailable_reason column>,",
      );

    const beforeStripped = stripUnavailableReasonCheck(schemaBefore);
    const afterStripped = stripUnavailableReasonCheck(schemaAfter);

    expect(beforeStripped).toEqual(afterStripped);
    expect(schemaAfter).toContain("REACH_NOT_ON_FIRST_SLIDE");
    expect(schemaBefore).not.toContain("REACH_NOT_ON_FIRST_SLIDE");
  });

  it("accepts a direct insert of perf_unavailable_reason = 'REACH_NOT_ON_FIRST_SLIDE' (OR-26, ticket #155)", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_unavailable_reason)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", "REACH_NOT_ON_FIRST_SLIDE"],
      }),
    ).resolves.toBeDefined();
  });

  it("rejects a direct insert of perf_reach_derived_from = 'REACH_NOT_ON_FIRST_SLIDE' — regression guard that the OR-26 fix landed in perf_unavailable_reason, not perf_reach_derived_from", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_reach_derived_from)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", "REACH_NOT_ON_FIRST_SLIDE"],
      }),
    ).rejects.toThrow();
  });

  it("rejects a row with perf_tier1_ratio set and perf_tier1_denominator NULL (R-12.2.2, ticket #139)", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_tier1_ratio, perf_tier1_denominator)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", 0.042, null],
      }),
    ).rejects.toThrow();
  });

  it("accepts a row with perf_tier1_ratio set and a valid perf_tier1_denominator", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_tier1_ratio, perf_tier1_denominator)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", 0.042, "FOLLOWERS"],
      }),
    ).resolves.toBeDefined();
  });

  it("accepts a row with perf_tier1_ratio NULL and a valid perf_tier1_denominator (image-only content has no Tier 1 ratio but may still carry a denominator)", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_tier1_ratio, perf_tier1_denominator)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", null, "REACH"],
      }),
    ).resolves.toBeDefined();
  });

  it("rejects a row with perf_tier1_ratio NULL and a bogus perf_tier1_denominator (a NULL ratio must not waive enum enforcement on the denominator — the common path for image-only content, PR #151 review)", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_tier1_ratio, perf_tier1_denominator)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", null, "BOGUS"],
      }),
    ).rejects.toThrow();
  });

  it("rejects a perf_reach_kind value outside the PLAYS/VIEWS/UNKNOWN enum", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_reach_kind)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", "BOGUS"],
      }),
    ).rejects.toThrow();
  });

  // PR #151 review, non-blocking item 1: CHECK constraints for the five
  // remaining perf enum columns, owner-approved. Value sets are TDD §5.2
  // (`perf_reach_derived_from`, `perf_tier_used`, `perf_confidence`,
  // `perf_confidence_reason`) and TDD §5.3 (`perf_unavailable_reason`),
  // corroborated by PRD §5.2 / §13.5.1.

  it("accepts a valid perf_reach_derived_from value", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_reach_derived_from)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", "CAROUSEL_FIRST_SLIDE"],
      }),
    ).resolves.toBeDefined();
  });

  it("rejects a perf_reach_derived_from value outside the TOP_LEVEL/CAROUSEL_FIRST_SLIDE/NONE enum", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_reach_derived_from)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", "BOGUS"],
      }),
    ).rejects.toThrow();
  });

  it("accepts a NULL perf_reach_derived_from", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_reach_derived_from)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", null],
      }),
    ).resolves.toBeDefined();
  });

  it("accepts a valid perf_tier_used value", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_tier_used)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", "CREATOR_BASELINE"],
      }),
    ).resolves.toBeDefined();
  });

  it("rejects a perf_tier_used value outside the CREATOR_BASELINE/REACH_ONLY/AUDIENCE_FALLBACK/UNAVAILABLE enum", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_tier_used)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", "BOGUS"],
      }),
    ).rejects.toThrow();
  });

  it("accepts a NULL perf_tier_used", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_tier_used)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", null],
      }),
    ).resolves.toBeDefined();
  });

  it("accepts a valid perf_confidence value", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_confidence)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", "HIGH"],
      }),
    ).resolves.toBeDefined();
  });

  it("rejects a perf_confidence value outside the HIGH/MEDIUM/LOW/NONE enum", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_confidence)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", "BOGUS"],
      }),
    ).rejects.toThrow();
  });

  it("accepts a NULL perf_confidence", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_confidence)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", null],
      }),
    ).resolves.toBeDefined();
  });

  it("accepts a valid perf_confidence_reason value", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_confidence_reason)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", "THIN_SAMPLE"],
      }),
    ).resolves.toBeDefined();
  });

  it("rejects a perf_confidence_reason value outside the CACHED_FOLLOWER_DENOMINATOR/CAROUSEL_FIRST_SLIDE/THIN_SAMPLE enum", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_confidence_reason)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", "BOGUS"],
      }),
    ).rejects.toThrow();
  });

  it("accepts a NULL perf_confidence_reason", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_confidence_reason)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", null],
      }),
    ).resolves.toBeDefined();
  });

  it("accepts a valid perf_unavailable_reason value", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_unavailable_reason)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", "CAUSE_NOT_DETERMINABLE"],
      }),
    ).resolves.toBeDefined();
  });

  it("rejects a perf_unavailable_reason value outside the seven-value enum (TDD §5.3, widened to 7 by OR-26/#155's REACH_NOT_ON_FIRST_SLIDE)", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_unavailable_reason)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", "BOGUS"],
      }),
    ).rejects.toThrow();
  });

  it("accepts a NULL perf_unavailable_reason", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `
          INSERT INTO analyses (id, url, platform, media_type, perf_unavailable_reason)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: ["test-id", "https://example.com", "instagram", "reel", null],
      }),
    ).resolves.toBeDefined();
  });
});

describe("migration chain (001 -> latest) — profile_style_fingerprints schema assertion (ticket #115)", () => {
  let db: Client | undefined;

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it("produces exactly the expected named columns on `profile_style_fingerprints`, 11 -> 12 with migration 011's computed_at", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    const result = await db.execute("PRAGMA table_info(profile_style_fingerprints)");
    const columns = result.rows.map((row) => row.name as string);

    expect(columns).toEqual(EXPECTED_FINGERPRINT_COLUMNS);
  });

  it("produces exactly the expected indexes on `profile_style_fingerprints`, with no drops", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    const result = await db.execute("PRAGMA index_list(profile_style_fingerprints)");
    const indexes = result.rows.map((row) => row.name as string).filter((name) => name.startsWith("idx_"));

    expect(indexes.sort()).toEqual([...EXPECTED_FINGERPRINT_INDEXES].sort());
  });
});

describe("migration chain (001 -> latest) — jobs schema assertion (ticket #351, 3A-M1a)", () => {
  let db: Client | undefined;

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it("produces exactly the expected named columns on `jobs`, in order", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    const result = await db.execute("PRAGMA table_info(jobs)");
    const columns = result.rows.map((row) => row.name as string);

    expect(columns).toEqual(EXPECTED_JOBS_COLUMNS);
  });

  it("produces exactly the expected indexes on `jobs`, with no drops", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    const result = await db.execute("PRAGMA index_list(jobs)");
    const indexes = result.rows.map((row) => row.name as string).filter((name) => name.startsWith("idx_"));

    expect(indexes.sort()).toEqual([...EXPECTED_JOBS_INDEXES].sort());
  });

  // Plan §4.4 decision 2 / R9: a real FK here would either block the
  // pipeline's `DELETE FROM analyses` on the new-analysis failure path, or
  // (with ON DELETE SET NULL) erase the only forensic link. This test pins
  // that `analysis_id` carries no FK — re-adding
  // `REFERENCES analyses(id)` to the migration must fail this test.
  it("carries no foreign key on analysis_id — PRAGMA foreign_key_list(jobs) is empty", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    const result = await db.execute("PRAGMA foreign_key_list(jobs)");

    expect(result.rows).toHaveLength(0);
  });

  // max_attempts DEFAULT must be 1 (owner ruling, plan Q1/R3) — proven by
  // inserting WITHOUT the column and reading back what SQLite filled in,
  // not by inserting the value and reading it back (which would prove
  // nothing about the default).
  it("defaults max_attempts to 1 on insert, without the caller supplying it", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await db.execute({
      sql: `INSERT INTO jobs (id, kind, status, payload) VALUES (?, ?, ?, ?)`,
      args: ["job-1", "analysis", "queued", "{}"],
    });

    const result = await db.execute({
      sql: `SELECT max_attempts FROM jobs WHERE id = ?`,
      args: ["job-1"],
    });

    expect(result.rows[0]!.max_attempts).toBe(1);
  });

  it("defaults attempts to 0 on insert", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await db.execute({
      sql: `INSERT INTO jobs (id, kind, status, payload) VALUES (?, ?, ?, ?)`,
      args: ["job-1", "analysis", "queued", "{}"],
    });

    const result = await db.execute({
      sql: `SELECT attempts FROM jobs WHERE id = ?`,
      args: ["job-1"],
    });

    expect(result.rows[0]!.attempts).toBe(0);
  });

  it("rejects a status value outside the queued/claimed/running/succeeded/failed/dead enum", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `INSERT INTO jobs (id, kind, status, payload) VALUES (?, ?, ?, ?)`,
        args: ["job-1", "analysis", "bogus", "{}"],
      }),
    ).rejects.toThrow();
  });

  it("accepts every value in the status enum", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    const statuses = ["queued", "claimed", "running", "succeeded", "failed", "dead"];

    for (const [index, status] of statuses.entries()) {
      await expect(
        db.execute({
          sql: `INSERT INTO jobs (id, kind, status, payload) VALUES (?, ?, ?, ?)`,
          args: [`job-${index}`, "analysis", status, "{}"],
        }),
      ).resolves.toBeDefined();
    }
  });

  it("rejects a kind value outside the analysis enum", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await expect(
      db.execute({
        sql: `INSERT INTO jobs (id, kind, status, payload) VALUES (?, ?, ?, ?)`,
        args: ["job-1", "bogus", "queued", "{}"],
      }),
    ).rejects.toThrow();
  });

  // idx_jobs_dedupe: rejects a second live row sharing a dedupe_key while
  // the first is still queued/claimed/running, but allows it once the
  // first reaches a terminal state. Both directions, by execution.
  it("rejects a second queued row with the same dedupe_key while the first is still queued", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await db.execute({
      sql: `INSERT INTO jobs (id, kind, status, payload, dedupe_key) VALUES (?, ?, ?, ?, ?)`,
      args: ["job-1", "analysis", "queued", "{}", "dedupe-key-a"],
    });

    await expect(
      db.execute({
        sql: `INSERT INTO jobs (id, kind, status, payload, dedupe_key) VALUES (?, ?, ?, ?, ?)`,
        args: ["job-2", "analysis", "queued", "{}", "dedupe-key-a"],
      }),
    ).rejects.toThrow();
  });

  it.each(["claimed", "running"] as const)(
    "rejects a second %s row with the same dedupe_key while the first is queued",
    async (status) => {
      db = createClient({ url: ":memory:" });
      await runMigrations(db);

      await db.execute({
        sql: `INSERT INTO jobs (id, kind, status, payload, dedupe_key) VALUES (?, ?, ?, ?, ?)`,
        args: ["job-1", "analysis", "queued", "{}", "dedupe-key-a"],
      });

      await expect(
        db.execute({
          sql: `INSERT INTO jobs (id, kind, status, payload, dedupe_key) VALUES (?, ?, ?, ?, ?)`,
          args: ["job-2", "analysis", status, "{}", "dedupe-key-a"],
        }),
      ).rejects.toThrow();
    },
  );

  it.each(["succeeded", "failed", "dead"] as const)(
    "allows a second row with the same dedupe_key once the first is %s",
    async (status) => {
      db = createClient({ url: ":memory:" });
      await runMigrations(db);

      await db.execute({
        sql: `INSERT INTO jobs (id, kind, status, payload, dedupe_key) VALUES (?, ?, ?, ?, ?)`,
        args: ["job-1", "analysis", status, "{}", "dedupe-key-a"],
      });

      await expect(
        db.execute({
          sql: `INSERT INTO jobs (id, kind, status, payload, dedupe_key) VALUES (?, ?, ?, ?, ?)`,
          args: ["job-2", "analysis", "queued", "{}", "dedupe-key-a"],
        }),
      ).resolves.toBeDefined();
    },
  );

  it("allows multiple rows with a NULL dedupe_key (partial unique index does not constrain NULLs)", async () => {
    db = createClient({ url: ":memory:" });
    await runMigrations(db);

    await db.execute({
      sql: `INSERT INTO jobs (id, kind, status, payload) VALUES (?, ?, ?, ?)`,
      args: ["job-1", "analysis", "queued", "{}"],
    });

    await expect(
      db.execute({
        sql: `INSERT INTO jobs (id, kind, status, payload) VALUES (?, ?, ?, ?)`,
        args: ["job-2", "analysis", "queued", "{}"],
      }),
    ).resolves.toBeDefined();
  });
});
