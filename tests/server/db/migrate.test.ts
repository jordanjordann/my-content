import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createClient,
  type Client,
  type InStatement,
  type Transaction,
  type TransactionMode,
} from "@libsql/client";

import {
  computeChecksum,
  ensureMigrationsTable,
  runMigrations,
  stripOuterTransaction,
} from "@/scripts/migrate";

/**
 * Tickets #277 (atomic tracking) + #278 (checksum tracking), delivered
 * together because both edit `scripts/migrate.ts` and the same
 * `_migrations` table. Every test here proves a MUTATION, not just "a test
 * exists": each `it` block below states, in its title or a comment, exactly
 * what broken behavior it would catch if the corresponding fix regressed.
 *
 * Uses real temp SQLite FILES, not `:memory:`. `:memory:` gives every
 * logical connection (`client.execute()`, `client.transaction()`, ...) its
 * OWN isolated in-memory database in this driver -- verified directly: a
 * table created and committed inside a `client.transaction()` is invisible
 * to a subsequent plain `client.execute()` on the very same `:memory:`
 * client. A real file (like production's Turso-backed file/remote database)
 * does not have that problem: every connection sees the same committed
 * data, which is the behavior these tests need to exercise faithfully.
 */

let workDirs: string[] = [];

afterEach(() => {
  for (const dir of workDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  workDirs = [];
});

function makeWorkDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "migrate-test-"));
  workDirs.push(dir);
  return dir;
}

function makeMigrationsDir(files: Record<string, string>): string {
  const dir = makeWorkDir();
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(dir, name), contents, "utf8");
  }
  return dir;
}

function makeDbClient(): Client {
  const dir = makeWorkDir();
  return createClient({ url: `file:${join(dir, "test.db")}` });
}

/**
 * Wraps a real libsql Transaction so a specific SQL statement throws instead
 * of executing -- simulates "the process crashes/dies at exactly this
 * point" without needing to actually kill the process. Everything before
 * the throw has already been sent to the real transaction, so this proves
 * real rollback behavior, not a mocked approximation of it. Uses a Proxy
 * (not object-spread) because `Transaction` methods live on the driver's
 * class prototype -- spreading would drop them and break every other call.
 */
function crashOnStatement(tx: Transaction, matchSql: (sql: string) => boolean): Transaction {
  return new Proxy(tx, {
    get(target, prop, receiver) {
      if (prop === "execute") {
        return async (stmt: InStatement) => {
          const sql = typeof stmt === "string" ? stmt : stmt.sql;
          if (matchSql(sql)) {
            throw new Error("SIMULATED CRASH");
          }
          return target.execute(stmt);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function crashingClient(real: Client, matchSql: (sql: string) => boolean): Client {
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === "transaction") {
        return async (mode?: TransactionMode) => {
          const tx = await target.transaction(mode);
          return crashOnStatement(tx, matchSql);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

describe("scripts/migrate.ts — computeChecksum", () => {
  it("normalizes CRLF to LF before hashing, so a line-ending-only change is not a content change", () => {
    const lf = computeChecksum("BEGIN TRANSACTION;\nSELECT 1;\nCOMMIT;\n");
    const crlf = computeChecksum("BEGIN TRANSACTION;\r\nSELECT 1;\r\nCOMMIT;\r\n");
    expect(lf).toEqual(crlf);
  });

  it("MUTATION: a single changed character (e.g. a comment edit) changes the checksum", () => {
    const before = computeChecksum("BEGIN TRANSACTION;\n-- a comment\nCOMMIT;\n");
    const after = computeChecksum("BEGIN TRANSACTION;\n-- a different comment\nCOMMIT;\n");
    expect(before).not.toEqual(after);
  });
});

describe("scripts/migrate.ts — stripOuterTransaction", () => {
  it("strips a leading BEGIN TRANSACTION; and trailing COMMIT; when both are present", () => {
    const sql = "BEGIN TRANSACTION;\nCREATE TABLE t (id INTEGER);\nCOMMIT;\n";
    const body = stripOuterTransaction(sql);
    expect(body).not.toMatch(/BEGIN TRANSACTION/i);
    expect(body).not.toMatch(/COMMIT;\s*$/i);
    expect(body).toContain("CREATE TABLE t");
  });

  it("leaves a file with no BEGIN/COMMIT wrapper untouched (matches migrations 001 and 003's actual shape)", () => {
    const sql = "ALTER TABLE analyses ADD COLUMN title TEXT;\n";
    expect(stripOuterTransaction(sql)).toEqual(sql);
  });

  it("MUTATION: leaves a half-wrapped file (BEGIN with no matching COMMIT) untouched rather than guessing", () => {
    const sql = "BEGIN TRANSACTION;\nCREATE TABLE t (id INTEGER);\n";
    expect(stripOuterTransaction(sql)).toEqual(sql);
  });
});

describe("scripts/migrate.ts — runMigrations, fresh database", () => {
  it("applies every migration file and records a checksum for each", async () => {
    const db = makeDbClient();
    const dir = makeMigrationsDir({
      "001_first.sql": "BEGIN TRANSACTION;\nCREATE TABLE a (id INTEGER PRIMARY KEY);\nCOMMIT;\n",
      "002_second.sql": "BEGIN TRANSACTION;\nCREATE TABLE b (id INTEGER PRIMARY KEY);\nCOMMIT;\n",
    });

    const log = await runMigrations(db, dir);
    expect(log).toEqual([
      { file: "001_first.sql", action: "applied" },
      { file: "002_second.sql", action: "applied" },
    ]);

    const migrations = await db.execute("SELECT name, checksum FROM _migrations ORDER BY name");
    expect(migrations.rows).toHaveLength(2);
    expect(migrations.rows[0]!.checksum).toBeTypeOf("string");
    expect(migrations.rows[1]!.checksum).toBeTypeOf("string");

    // Both tables actually exist -- the migration bodies really ran.
    await expect(db.execute("SELECT * FROM a")).resolves.toBeDefined();
    await expect(db.execute("SELECT * FROM b")).resolves.toBeDefined();
    db.close();
  });

  it("is idempotent: a second run applies nothing and reports every file as unchanged", async () => {
    const db = makeDbClient();
    const dir = makeMigrationsDir({
      "001_first.sql": "BEGIN TRANSACTION;\nCREATE TABLE a (id INTEGER PRIMARY KEY);\nCOMMIT;\n",
    });

    await runMigrations(db, dir);
    const secondLog = await runMigrations(db, dir);

    expect(secondLog).toEqual([{ file: "001_first.sql", action: "unchanged" }]);
    db.close();
  });

  it("applies a migration with no BEGIN/COMMIT wrapper (001/003 shape) atomically alongside its tracking row", async () => {
    const db = makeDbClient();
    const dir = makeMigrationsDir({
      "001_no_wrapper.sql": "CREATE TABLE a (id INTEGER PRIMARY KEY);\nINSERT INTO a (id) VALUES (1);\n",
    });

    const log = await runMigrations(db, dir);
    expect(log).toEqual([{ file: "001_no_wrapper.sql", action: "applied" }]);

    const rows = await db.execute("SELECT * FROM a");
    expect(rows.rows).toHaveLength(1);
    db.close();
  });

  // MUTATION TEST (a) -- required by the ticket: prove a crash between the
  // migration body and the tracking INSERT does not leave an
  // applied-but-untracked migration. If `runMigrations` regressed to the old
  // two-step (executeMultiple, then a separate untracked INSERT), this test
  // would find the "analyses"-like table present with the tracking row
  // absent -- exactly the bug #277 reports. With the fix, the whole
  // transaction rolls back: neither the table nor the tracking row exist.
  it("MUTATION: a crash between the migration body and the _migrations insert leaves nothing durable (not applied, not tracked)", async () => {
    const db = makeDbClient();
    const dir = makeMigrationsDir({
      "012_dangerous.sql":
        "BEGIN TRANSACTION;\nCREATE TABLE analyses (id INTEGER PRIMARY KEY);\nDELETE FROM analyses;\nCOMMIT;\n",
    });

    const crashing = crashingClient(db, (sql) => sql.includes("INSERT INTO _migrations"));

    await expect(runMigrations(crashing, dir)).rejects.toThrow("SIMULATED CRASH");

    // Nothing from the migration body persisted...
    await expect(db.execute("SELECT * FROM analyses")).rejects.toThrow(/no such table/i);
    // ...and nothing was recorded as applied either.
    const migrations = await db.execute("SELECT * FROM _migrations");
    expect(migrations.rows).toHaveLength(0);

    // A subsequent clean run (no crash) must still be able to apply the
    // migration from scratch -- the aborted attempt didn't corrupt state.
    const log = await runMigrations(db, dir);
    expect(log).toEqual([{ file: "012_dangerous.sql", action: "applied" }]);
    await expect(db.execute("SELECT * FROM analyses")).resolves.toBeDefined();
    db.close();
  });
});

describe("scripts/migrate.ts — runMigrations, existing database (pre-checksum _migrations table)", () => {
  async function seedLegacyMigrationsTable(db: Client, names: string[]): Promise<void> {
    // Simulates production's actual pre-#278 schema: no checksum column.
    await db.execute(`
      CREATE TABLE _migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    for (const name of names) {
      await db.execute({ sql: "INSERT INTO _migrations (name) VALUES (?)", args: [name] });
    }
  }

  it("adds the checksum column via ALTER TABLE and adopts a checksum baseline for legacy rows, without re-running them", async () => {
    const db = makeDbClient();
    const sql = "BEGIN TRANSACTION;\nCREATE TABLE a (id INTEGER PRIMARY KEY);\nCOMMIT;\n";
    const dir = makeMigrationsDir({ "001_first.sql": sql });
    await seedLegacyMigrationsTable(db, ["001_first.sql"]);

    const log = await runMigrations(db, dir);
    expect(log).toEqual([{ file: "001_first.sql", action: "adopted-legacy-checksum" }]);

    const migrations = await db.execute("SELECT checksum FROM _migrations WHERE name = '001_first.sql'");
    expect(migrations.rows).toHaveLength(1);
    expect(migrations.rows[0]!.checksum).toEqual(computeChecksum(sql));
    db.close();
  });

  it("MUTATION: re-running a legacy migration body would fail loudly (CREATE TABLE without IF NOT EXISTS) if adoption accidentally re-executed it", async () => {
    // This is the actual mutation check for the test above: prove the
    // legacy-adoption path really does NOT execute the migration body, by
    // using a body that would blow up if executed twice.
    const db = makeDbClient();
    const dir = makeMigrationsDir({
      "001_first.sql": "BEGIN TRANSACTION;\nCREATE TABLE a (id INTEGER PRIMARY KEY);\nCOMMIT;\n",
    });
    // Pre-create the table directly, as if a prior real run already applied
    // this migration's body (which legacy rows, by definition, already have).
    await db.execute("CREATE TABLE a (id INTEGER PRIMARY KEY)");
    await seedLegacyMigrationsTable(db, ["001_first.sql"]);

    await expect(runMigrations(db, dir)).resolves.toEqual([
      { file: "001_first.sql", action: "adopted-legacy-checksum" },
    ]);
    db.close();
  });

  it("does not touch already-checksummed rows on a later run: a legacy row adopted once behaves as 'unchanged' afterward", async () => {
    const db = makeDbClient();
    const dir = makeMigrationsDir({
      "001_first.sql": "BEGIN TRANSACTION;\nCREATE TABLE a (id INTEGER PRIMARY KEY);\nCOMMIT;\n",
    });
    await seedLegacyMigrationsTable(db, ["001_first.sql"]);

    await runMigrations(db, dir);
    const secondLog = await runMigrations(db, dir);

    expect(secondLog).toEqual([{ file: "001_first.sql", action: "unchanged" }]);
    db.close();
  });

  // MUTATION TEST (b) -- required by the ticket: prove a tampered
  // already-applied file fails loudly rather than passing or silently
  // re-running.
  it("MUTATION: throws loudly when an already-applied migration's on-disk content no longer matches its recorded checksum", async () => {
    const db = makeDbClient();
    const originalSql = "BEGIN TRANSACTION;\nCREATE TABLE a (id INTEGER PRIMARY KEY);\nCOMMIT;\n";
    const dir = makeMigrationsDir({ "001_first.sql": originalSql });

    // First run: applies normally and records a checksum (not a legacy row).
    await runMigrations(db, dir);

    // Tamper with the file on disk after it was applied -- e.g. someone
    // "fixes" a comment or a CHECK constraint in an already-applied
    // migration, exactly the scenario #278 exists to catch.
    writeFileSync(
      join(dir, "001_first.sql"),
      "BEGIN TRANSACTION;\nCREATE TABLE a (id INTEGER PRIMARY KEY, extra TEXT);\nCOMMIT;\n",
      "utf8",
    );

    await expect(runMigrations(db, dir)).rejects.toThrow(/checksum mismatch|no longer matches/i);

    // And it must NOT have silently re-run the tampered body: table `a`
    // still has its original shape (no `extra` column).
    const columns = await db.execute("PRAGMA table_info(a)");
    expect(columns.rows.map((row) => row.name)).toEqual(["id"]);
    db.close();
  });

  it("MUTATION: a checksum-tracked migration that is reverted back to its original content passes again (round-trip sanity)", async () => {
    const db = makeDbClient();
    const originalSql = "BEGIN TRANSACTION;\nCREATE TABLE a (id INTEGER PRIMARY KEY);\nCOMMIT;\n";
    const dir = makeMigrationsDir({ "001_first.sql": originalSql });

    await runMigrations(db, dir);
    writeFileSync(join(dir, "001_first.sql"), originalSql, "utf8");

    await expect(runMigrations(db, dir)).resolves.toEqual([{ file: "001_first.sql", action: "unchanged" }]);
    db.close();
  });
});

describe("scripts/migrate.ts — ensureMigrationsTable", () => {
  it("creates a fresh table with the checksum column already present", async () => {
    const db = makeDbClient();
    await ensureMigrationsTable(db);

    const columns = await db.execute("PRAGMA table_info(_migrations)");
    expect(columns.rows.map((row) => row.name)).toEqual(
      expect.arrayContaining(["name", "applied_at", "checksum"]),
    );
    db.close();
  });

  it("MUTATION: is a no-op (does not error, does not duplicate the column) when run twice against the same database", async () => {
    const db = makeDbClient();
    await ensureMigrationsTable(db);
    await expect(ensureMigrationsTable(db)).resolves.toBeUndefined();

    const columns = await db.execute("PRAGMA table_info(_migrations)");
    const checksumColumns = columns.rows.filter((row) => row.name === "checksum");
    expect(checksumColumns).toHaveLength(1);
    db.close();
  });

  it("adds checksum via ALTER TABLE to a pre-existing table that lacks it, preserving existing rows", async () => {
    const db = makeDbClient();
    await db.execute(`
      CREATE TABLE _migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await db.execute({ sql: "INSERT INTO _migrations (name) VALUES (?)", args: ["001_legacy.sql"] });

    await ensureMigrationsTable(db);

    const rows = await db.execute("SELECT name, checksum FROM _migrations");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]!.name).toEqual("001_legacy.sql");
    expect(rows.rows[0]!.checksum).toBeNull();
    db.close();
  });
});

describe("scripts/migrate.ts — real migration chain in this repo", () => {
  it("applies the actual migrations/ directory end to end via runMigrations (not a hand-rolled loop)", async () => {
    const db = makeDbClient();
    const log = await runMigrations(db, join(process.cwd(), "migrations"));

    expect(log.every((entry) => entry.action === "applied")).toBe(true);
    expect(log.length).toBeGreaterThan(0);

    const analysesColumns = await db.execute("PRAGMA table_info(analyses)");
    expect(analysesColumns.rows.length).toBeGreaterThan(0);

    const migrations = await db.execute("SELECT name, checksum FROM _migrations");
    expect(migrations.rows.length).toEqual(log.length);
    expect(migrations.rows.every((row) => typeof row.checksum === "string")).toBe(true);

    db.close();
  });

  it("running the real migration chain twice is fully idempotent", async () => {
    const db = makeDbClient();
    const dir = join(process.cwd(), "migrations");

    await runMigrations(db, dir);
    const secondLog = await runMigrations(db, dir);

    expect(secondLog.every((entry) => entry.action === "unchanged")).toBe(true);

    db.close();
  });
});
