import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  // PR #305 review, P2 -- previously this left a half-wrapped file
  // untouched and let it die downstream inside the driver with an
  // unactionable "cannot start a transaction within a transaction" error.
  // It now throws immediately, naming the file and the cause.
  it("MUTATION: throws a file-named error for a half-wrapped file (BEGIN with no matching COMMIT), instead of silently leaving it untouched", () => {
    const sql = "BEGIN TRANSACTION;\nCREATE TABLE t (id INTEGER);\n";
    expect(() => stripOuterTransaction(sql, "999_half_wrapped.sql")).toThrow(
      /999_half_wrapped\.sql[\s\S]*BEGIN TRANSACTION or COMMIT/,
    );
  });

  // PR #305 review, P2 (the headline case) -- a second transaction block in
  // the same file. Without this check, `stripOuterTransaction` would strip
  // only the outer wrapper and leave an interior `COMMIT;` in the body,
  // which libsql accepts without error: it commits `migrate.ts`'s own
  // outer transaction early and runs the remainder as an implicit second
  // transaction, silently reopening the applied-but-untracked window #277
  // exists to close.
  it("MUTATION: throws a file-named error for a file with two transaction blocks (residual interior COMMIT/BEGIN)", () => {
    const sql =
      "BEGIN TRANSACTION;\nCREATE TABLE t3 (id INTEGER);\nCOMMIT;\nBEGIN TRANSACTION;\nCREATE TABLE t4 (id INTEGER);\nCOMMIT;\n";
    expect(() => stripOuterTransaction(sql, "998_two_blocks.sql")).toThrow(
      /998_two_blocks\.sql[\s\S]*BEGIN TRANSACTION or COMMIT/,
    );
  });

  // PR #305 review, P2 -- every uncovered shape the reviewer probed against
  // the real regexes: each one previously skipped stripping silently and
  // died downstream with an unactionable driver error. Each must now throw
  // here instead, before the SQL ever reaches the driver.
  it.each([
    ["header comment before BEGIN TRANSACTION;", "-- a header comment\nBEGIN TRANSACTION;\nCREATE TABLE t (id INTEGER);\nCOMMIT;\n"],
    ["BEGIN; short form", "BEGIN;\nCREATE TABLE t (id INTEGER);\nCOMMIT;\n"],
    ["COMMIT TRANSACTION; instead of COMMIT;", "BEGIN TRANSACTION;\nCREATE TABLE t (id INTEGER);\nCOMMIT TRANSACTION;\n"],
    ["END; instead of COMMIT;", "BEGIN TRANSACTION;\nCREATE TABLE t (id INTEGER);\nEND;\n"],
    ["BEGIN IMMEDIATE TRANSACTION;", "BEGIN IMMEDIATE TRANSACTION;\nCREATE TABLE t (id INTEGER);\nCOMMIT;\n"],
    ["trailing comment after COMMIT;", "BEGIN TRANSACTION;\nCREATE TABLE t (id INTEGER);\nCOMMIT;\n-- done\n"],
  ])("MUTATION: throws for the uncovered wrapper shape: %s", (_label, sql) => {
    expect(() => stripOuterTransaction(sql, "997_uncovered_shape.sql")).toThrow(/997_uncovered_shape\.sql/);
  });

  // PR #305 review round 2, P2 -- the original `/\bBEGIN\s+TRANSACTION\b|\bCOMMIT\b/i`
  // scanned raw text, so it false-positived on the bare word inside a
  // comment, a string literal, or an identifier. Each row below is a case
  // from the review that must NOT throw. MUTATION: reverting
  // `hasResidualTransactionControl` to the old raw-text `\bCOMMIT\b` scan
  // turns every one of these red (they'd all throw).
  it.each([
    ["a bare COMMIT token inside a line comment", "BEGIN TRANSACTION;\n-- do not COMMIT here\nCREATE TABLE t (id INTEGER);\nCOMMIT;\n"],
    ["a bare COMMIT token inside a string literal", "BEGIN TRANSACTION;\nINSERT INTO t (label) VALUES ('COMMIT');\nCOMMIT;\n"],
    ["commit used as a bare column identifier", "BEGIN TRANSACTION;\nCREATE TABLE t (id INTEGER, commit TEXT);\nCOMMIT;\n"],
    [
      "COMMIT appearing as the first line inside a block comment",
      "BEGIN TRANSACTION;\n/*\nCOMMIT\n*/\nCREATE TABLE t (id INTEGER);\nCOMMIT;\n",
    ],
  ])("MUTATION: does NOT throw a false positive for %s", (_label, sql) => {
    expect(() => stripOuterTransaction(sql)).not.toThrow();
  });

  // 012's own real comment ("...durably committing this DELETE...") used to
  // survive the old scan only by luck ("committing" doesn't match
  // `\bCOMMIT\b` as a whole word). Prove the new scan is robust on purpose,
  // not by accident: a comment that DOES contain the bare word must still
  // be tolerated.
  it("MUTATION: does not throw when a migration's own comment discusses committing, including the bare word COMMIT", () => {
    const sql =
      "BEGIN TRANSACTION;\n-- durably COMMIT this DELETE before the rebuild runs\nDELETE FROM t;\nCOMMIT;\n";
    expect(() => stripOuterTransaction(sql)).not.toThrow();
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

describe("scripts/migrate.ts — orphan _migrations row warning (PR #305 review, P3)", () => {
  it("MUTATION: warns (does not throw) when a tracked row's file no longer exists on disk", async () => {
    const db = makeDbClient();
    const dir = makeMigrationsDir({ "001_first.sql": "CREATE TABLE a (id INTEGER PRIMARY KEY);\n" });
    await runMigrations(db, dir);

    // The file that was applied is gone; a new one takes its place, as in
    // a rename or a deleted migration file.
    unlinkSync(join(dir, "001_first.sql"));
    writeFileSync(join(dir, "002_second.sql"), "CREATE TABLE b (id INTEGER PRIMARY KEY);\n", "utf8");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await runMigrations(db, dir);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("001_first.sql"));
    warnSpy.mockRestore();
    db.close();
  });
});

describe("scripts/migrate.ts — ensureMigrationsTable ALTER guard (PR #305 review, P2)", () => {
  it("MUTATION: swallows a duplicate-column-name error from ALTER TABLE if PRAGMA table_info misreports hasChecksum as false", async () => {
    const db = makeDbClient();
    await ensureMigrationsTable(db); // the checksum column now really exists

    // Force `PRAGMA table_info` to lie and omit `checksum`, simulating the
    // untested Turso-remote-protocol divergence the review flagged.
    // `ensureMigrationsTable` must not propagate the resulting
    // `duplicate column name` error from the ALTER it then (wrongly)
    // attempts.
    const lyingClient = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === "execute") {
          return async (stmt: InStatement) => {
            const sql = typeof stmt === "string" ? stmt : stmt.sql;
            if (typeof sql === "string" && sql.includes("PRAGMA table_info")) {
              const real = await target.execute(stmt);
              return { ...real, rows: real.rows.filter((row) => row.name !== "checksum") };
            }
            return target.execute(stmt);
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    await expect(ensureMigrationsTable(lyingClient as unknown as Client)).resolves.toBeUndefined();
    db.close();
  });

  it("still throws a real (non-duplicate-column) error from ALTER TABLE", async () => {
    const db = makeDbClient();
    // A client whose ALTER always fails with an unrelated error -- proves
    // the try/catch is scoped to "duplicate column name" only, not a
    // blanket swallow of every ALTER failure.
    const failingClient = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === "execute") {
          return async (stmt: InStatement) => {
            const sql = typeof stmt === "string" ? stmt : stmt.sql;
            if (typeof sql === "string" && sql.includes("ALTER TABLE _migrations")) {
              throw new Error("SQLITE_ERROR: disk I/O error");
            }
            return target.execute(stmt);
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    await db.execute(`
      CREATE TABLE _migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await expect(ensureMigrationsTable(failingClient as unknown as Client)).rejects.toThrow(/disk I\/O error/);
    db.close();
  });
});

describe("scripts/migrate.ts — rollback failure does not swallow the original error (PR #305 review, P3)", () => {
  it("MUTATION: the original migration error propagates even if tx.rollback() itself throws", async () => {
    const db = makeDbClient();
    const dir = makeMigrationsDir({
      "001_bad.sql": "BEGIN TRANSACTION;\nTHIS IS NOT VALID SQL;\nCOMMIT;\n",
    });

    const brokenRollbackClient = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === "transaction") {
          return async (mode?: TransactionMode) => {
            const tx = await target.transaction(mode);
            return new Proxy(tx, {
              get(txTarget, txProp, txReceiver) {
                if (txProp === "rollback") {
                  return async () => {
                    throw new Error("ROLLBACK ALSO FAILED");
                  };
                }
                const value = Reflect.get(txTarget, txProp, txReceiver);
                return typeof value === "function" ? value.bind(txTarget) : value;
              },
            });
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let caught: unknown;
    try {
      await runMigrations(brokenRollbackClient as unknown as Client, dir);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).not.toMatch(/ROLLBACK ALSO FAILED/);
    errorSpy.mockRestore();
    db.close();
  });
});

describe("scripts/migrate.ts — always prints a summary line, even for a full no-op run (PR #305 review, P3)", () => {
  it("MUTATION: logs a migrations summary line on a second, fully-unchanged run", async () => {
    const db = makeDbClient();
    const dir = makeMigrationsDir({ "001_first.sql": "CREATE TABLE a (id INTEGER PRIMARY KEY);\n" });
    await runMigrations(db, dir);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await runMigrations(db, dir);
    expect(logSpy).toHaveBeenCalledWith(
      "migrations: 1 total, 0 applied, 1 unchanged, 0 adopted-legacy-checksum",
    );
    logSpy.mockRestore();
    db.close();
  });
});

describe("scripts/migrate.ts — lazy db import (PR #305 review, P2)", () => {
  it("does not statically import ../lib/server/db at module top level -- only lazily inside main(), so importing this module for tests never constructs a client from TURSO_DATABASE_URL", () => {
    const source = readFileSync(join(process.cwd(), "scripts/migrate.ts"), "utf8");
    expect(source).not.toMatch(/^import\s*\{\s*db\s*\}\s*from\s*["']\.\.\/lib\/server\/db["'];?/m);
    expect(source).toMatch(/await import\(\s*["']\.\.\/lib\/server\/db["']\s*\)/);
  });
});
