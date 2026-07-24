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
  "engagement_rate",
  "analysis_mode",
  "schema_version",
  "play_count",
  "coauthor_producers",
  "like_and_view_counts_disabled",
];

const EXPECTED_ANALYSES_INDEXES = [
  "idx_analyses_updated_at",
  "idx_analyses_title",
  "idx_analyses_username",
  "idx_analyses_platform",
  "idx_analyses_profile_id",
  "idx_analyses_schema_version",
];

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
    expect(insertCols).toEqual(EXPECTED_ANALYSES_COLUMNS);
  });
});
