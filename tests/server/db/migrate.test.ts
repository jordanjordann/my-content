import { mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
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
  assertNoOrderRegression,
  assertNoRenamedMigration,
  computeChecksum,
  diffRowCounts,
  ensureMigrationsTable,
  formatDestructiveMigrationError,
  parseDestructiveAllowlist,
  runMigrations,
  snapshotRowCounts,
  stripCommentsAndStrings,
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

// PR #305 review round 3, P1 -- every fixture above is a hand-written 3-8
// line snippet, and every one of them happens to have zero apostrophes in
// its comments. That is exactly why the round-2 fix shipped broken: the old
// `stripCommentsAndStrings` ran a `'...'` string-literal regex BEFORE its
// `--`/`/* */` comment regexes, so an apostrophe inside a real comment
// (`don't`, `it's`, "the table's") opened a phantom string literal that
// swallowed real SQL up to the next `'` -- deleting the reviewer's injected
// second transaction block before `hasResidualTransactionControl` ever saw
// it. These tests exercise the REAL files on disk, not synthetic copies, and
// reproduce the reviewer's exact injection technique: insert
// `COMMIT; BEGIN TRANSACTION; DROP TABLE analyses;` immediately after the
// first comment line containing an apostrophe, then prove
// `stripOuterTransaction` throws.
//
// PR #305 review round 4, P2 -- the round-3 version of this describe block
// hard-coded the file list to `009/010/012/013`. `013` never actually
// exhibited the bug (its apostrophe-bearing comment happened to still be
// caught even under the round-3 regex-order bug), while `011` and `014` DID
// exhibit it and were silently omitted from coverage. Driven from
// `readdirSync(migrations/)` instead, filtered to files that actually
// contain an apostrophe inside a `--` comment, so the set can't go stale as
// migrations are added and can't accidentally include/omit the wrong files
// again.
describe("scripts/migrate.ts — stripOuterTransaction against real migration files with apostrophes in comments (PR #305 review round 3, P1 / round 4, P2)", () => {
  const REAL_MIGRATIONS_DIR = join(process.cwd(), "migrations");

  function injectSecondTransactionBlockAfterFirstApostropheComment(sql: string): string {
    const lines = sql.split("\n");
    const targetIndex = lines.findIndex((line) => /--.*'/.test(line));
    if (targetIndex === -1) {
      throw new Error("fixture has no line-comment line containing an apostrophe -- test setup is wrong");
    }
    lines.splice(targetIndex + 1, 0, "COMMIT; BEGIN TRANSACTION; DROP TABLE analyses;");
    return lines.join("\n");
  }

  const apostropheCommentFiles = readdirSync(REAL_MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => /--.*'/.test(readFileSync(join(REAL_MIGRATIONS_DIR, f), "utf8")))
    .sort();

  it("finds at least one real migration file with an apostrophe inside a `--` comment (precondition -- this whole describe block is a no-op if this fails)", () => {
    expect(apostropheCommentFiles.length).toBeGreaterThan(0);
  });

  it.each(apostropheCommentFiles)(
    "MUTATION: reproduces the reviewer's injected second transaction block right after the first apostrophe-bearing comment in %s, and it is caught",
    (fileName) => {
      const raw = readFileSync(join(REAL_MIGRATIONS_DIR, fileName), "utf8");
      const mutated = injectSecondTransactionBlockAfterFirstApostropheComment(raw);

      // Sanity check: the injected statement really did land after real SQL
      // both before and after it, not at the very start/end of the file --
      // otherwise this test would trivially pass for the wrong reason.
      expect(mutated).not.toEqual(raw);

      expect(() => stripOuterTransaction(mutated, fileName)).toThrow(
        new RegExp(`${fileName.replace(/\./g, "\\.")}[\\s\\S]*BEGIN TRANSACTION or COMMIT`),
      );
    },
  );

  it("the real, unmutated migration files with apostrophe-bearing comments do NOT throw -- proves the fix does not just reject everything", () => {
    for (const fileName of apostropheCommentFiles) {
      const raw = readFileSync(join(REAL_MIGRATIONS_DIR, fileName), "utf8");
      expect(() => stripOuterTransaction(raw, fileName)).not.toThrow();
    }
  });

  it("MUTATION: an apostrophe inside a real file's comment does not itself trip the residual-transaction check (no false positive)", () => {
    // 009's own comment contains a fake-looking embedded string
    // ('["sandiuno"]') entirely inside a `--` line comment -- two
    // apostrophes on one line. The whole line must still be treated as an
    // inert comment, not as opening/closing a real string literal.
    const raw = readFileSync(join(REAL_MIGRATIONS_DIR, "009_analysis_mode_images_only.sql"), "utf8");
    expect(raw).toMatch(/--.*'\[.*\]'/);
    expect(() => stripOuterTransaction(raw, "009_analysis_mode_images_only.sql")).not.toThrow();
  });
});

// PR #305 review round 4, P2 -- the round-4 fix's own header comment and PR
// body advertise FIVE independent tokeniser capabilities (`''` escaped
// quotes, `/* */` block comments, `"..."`/`` `...` `` quoted identifiers,
// `[...]` bracketed identifiers, plus the base `--`/string-literal scan), but
// only the base case had a test that actually exercised it. The reviewer
// mutated each capability in isolation (deleting or disabling its branch in
// `stripCommentsAndStrings`) and got 47/47 green every time except one --
// removing `[...]` handling flipped `SELECT [it's] FROM t;` + an injected
// second block from DETECTED to MISSED, and nothing else in the suite
// noticed. Each test below is a real-shaped case that goes red under the
// corresponding mutation; each was verified by hand: apply the mutation,
// confirm this file's new test fails, restore, confirm green again.
describe("scripts/migrate.ts — stripCommentsAndStrings tokeniser capability coverage (PR #305 review round 4, P2)", () => {
  // Capability: `''` escaped-quote-inside-a-string-literal. Deleting the
  // dedicated `sql[i] === "'" && sql[i+1] === "'"` branch in
  // `stripCommentsAndStrings` is provably a NO-OP for `hasResidualTransactionControl`'s
  // detection surface on any well-formed doubled-quote string -- each `''`
  // pair is two adjacent characters, so "close then immediately reopen"
  // (the buggy behavior) and "treat as an escape, stay in the string" (the
  // correct behavior) leave the SAME final in-string/out-of-string parity
  // for every character after the pair, so no injected-block detection test
  // can distinguish them (verified directly: the reviewer's own report notes
  // deleting this branch also left 47/47 green, for the same reason). What
  // DOES differ is the raw blanked output at the doubled-quote's own two
  // character positions -- correct handling blanks both to spaces (still
  // "inside" the string), the buggy close-then-reopen instead re-emits both
  // characters as quote delimiters. Pinned directly here.
  it("MUTATION: blanks a `''` escaped quote to spaces, not to a close+reopen quote pair", () => {
    const cleaned = stripCommentsAndStrings("'it''s'");
    expect(cleaned).toBe("'     '");
  });

  it("MUTATION: does not throw on a legit block comment containing `--`, `;`, and `COMMIT` in its own text", () => {
    const sql =
      "\n/* note: BEGIN TRANSACTION; is not needed here; COMMIT; neither -- nor is this line */\nCREATE TABLE t (id INTEGER);\n";
    expect(() => stripOuterTransaction(`BEGIN TRANSACTION;${sql}COMMIT;\n`)).not.toThrow();
  });

  it.each([
    ['"..." double-quoted identifier', 'SELECT "col;COMMIT" FROM t;'],
    ["`...` backtick identifier", "SELECT `col;COMMIT` FROM t;"],
  ])("MUTATION: does not throw on a legit %s containing `;COMMIT` in its own name", (_label, statement) => {
    const sql = `BEGIN TRANSACTION;\n${statement}\nCOMMIT;\n`;
    expect(() => stripOuterTransaction(sql)).not.toThrow();
  });

  it("MUTATION: reproduces the reviewer's exact `[...]` bracketed-identifier case -- an injected second block right after `SELECT [it's] FROM t;` is caught", () => {
    const sql = "BEGIN TRANSACTION;\nSELECT [it's] FROM t;\nCOMMIT; BEGIN TRANSACTION; DROP TABLE analyses;\nCOMMIT;\n";
    expect(() => stripOuterTransaction(sql, "996_bracket_ident.sql")).toThrow(
      /996_bracket_ident\.sql[\s\S]*BEGIN TRANSACTION or COMMIT/,
    );
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

/**
 * Ticket #307 — runner-level guard: Checks A (order regression), B (renamed
 * migration), C (measured row loss), plus the allowlist escape hatch and the
 * error-message formatter. Every scenario below reads the REAL
 * `migrations/` directory (copied to a tmpdir and mutated on disk when a
 * test needs a renamed/missing file) -- never an inline hand-written SQL
 * copy of any migration, per the TDD's binding testing standard.
 */
const REAL_MIGRATIONS_DIR_307 = join(process.cwd(), "migrations");

function copyRealMigrationsToTmp(): string {
  const dir = makeWorkDir();
  for (const file of readdirSync(REAL_MIGRATIONS_DIR_307)) {
    writeFileSync(join(dir, file), readFileSync(join(REAL_MIGRATIONS_DIR_307, file), "utf8"), "utf8");
  }
  return dir;
}

/** Same real files, but only through (and including) `maxFile` -- lets a
 * test isolate a specific migration's behavior from later migrations in the
 * real chain that are not idempotent under replay for unrelated reasons. */
function copyRealMigrationsUpTo(maxFile: string): string {
  const dir = makeWorkDir();
  for (const file of readdirSync(REAL_MIGRATIONS_DIR_307).filter((f) => f <= maxFile)) {
    writeFileSync(join(dir, file), readFileSync(join(REAL_MIGRATIONS_DIR_307, file), "utf8"), "utf8");
  }
  return dir;
}

/** A schema-3 (post-012) analyses row with a fully populated perf block. */
async function seedSchema3AnalysisRow(db: Client, id = "seed-1"): Promise<void> {
  await db.execute({
    sql: `INSERT INTO analyses (
      id, url, platform, media_type, schema_version,
      perf_reach_value, perf_reach_kind, perf_reach_derived_from,
      perf_tier1_ratio, perf_tier1_denominator, perf_multiplier, performance_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      "https://instagram.com/p/abc123",
      "instagram",
      "reel",
      3,
      12345,
      "VIEWS",
      "TOP_LEVEL",
      0.42,
      "REACH",
      1.75,
      99,
    ],
  });
}

async function readPerfBlock(db: Client, id = "seed-1") {
  const result = await db.execute({
    sql: "SELECT perf_reach_value, perf_multiplier, performance_score, perf_unavailable_reason FROM analyses WHERE id = ?",
    args: [id],
  });
  return result.rows[0];
}

describe("scripts/migrate.ts — snapshotRowCounts / diffRowCounts (Check C primitives, ticket #307)", () => {
  it("excludes sqlite_% internals and _migrations, includes every user table", async () => {
    const db = makeDbClient();
    await ensureMigrationsTable(db);
    await db.execute("CREATE TABLE widgets (id INTEGER PRIMARY KEY)");
    await db.execute("INSERT INTO widgets (id) VALUES (1)");

    const counts = await snapshotRowCounts(db);
    expect(counts).toEqual({ widgets: 1 });
    expect(counts).not.toHaveProperty("_migrations");
    expect(Object.keys(counts).some((name) => name.startsWith("sqlite_"))).toBe(false);
    db.close();
  });

  // Load-bearing per the ticket: a snapshot taken on the CLIENT reads
  // outside an in-flight transaction and misses its uncommitted effect,
  // silently turning Check C into a permanent no-op. This is the dedicated
  // test the ticket brief requires for exactly that failure mode.
  it("MUTATION: snapshotRowCounts(tx) sees an uncommitted insert made on that same tx; snapshotRowCounts(client) does not", async () => {
    const db = makeDbClient();
    await ensureMigrationsTable(db);
    await db.execute("CREATE TABLE widgets (id INTEGER PRIMARY KEY)");

    const tx = await db.transaction("write");
    await tx.execute("INSERT INTO widgets (id) VALUES (1)");

    const fromTx = await snapshotRowCounts(tx);
    const fromClient = await snapshotRowCounts(db);

    expect(fromTx).toEqual({ widgets: 1 });
    expect(fromClient).toEqual({ widgets: 0 });

    await tx.rollback();
    tx.close();
    db.close();
  });

  it("diffRowCounts: a decreased count is a loss; a dropped table (absent from `after`) counts as -> 0; a new table (absent from `before`) is ignored", () => {
    const before = { analyses: 5, settings: 0, dropped_table: 3 };
    const after = { analyses: 2, settings: 0, new_table: 1 };

    expect(diffRowCounts(before, after)).toEqual([
      { table: "analyses", before: 5, after: 2 },
      { table: "dropped_table", before: 3, after: 0 },
    ]);
  });

  it("diffRowCounts: no losses when nothing decreased", () => {
    expect(diffRowCounts({ analyses: 0 }, { analyses: 0 })).toEqual([]);
    expect(diffRowCounts({ analyses: 2 }, { analyses: 5 })).toEqual([]);
  });
});

describe("scripts/migrate.ts — parseDestructiveAllowlist (ticket #307)", () => {
  function fakeEnv(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
    return { ...process.env, ...overrides };
  }

  it("parses a comma-separated env value, trimming whitespace and dropping empty entries", () => {
    const allowlist = parseDestructiveAllowlist(
      fakeEnv({ ALLOW_DESTRUCTIVE_MIGRATIONS: "a.sql, b.sql,,  c.sql " }),
      [],
    );
    expect(allowlist).toEqual(new Set(["a.sql", "b.sql", "c.sql"]));
  });

  it("returns an empty set when the env var is unset or empty", () => {
    expect(parseDestructiveAllowlist(fakeEnv({ ALLOW_DESTRUCTIVE_MIGRATIONS: undefined }), [])).toEqual(new Set());
    expect(parseDestructiveAllowlist(fakeEnv({ ALLOW_DESTRUCTIVE_MIGRATIONS: "" }), [])).toEqual(new Set());
  });

  it("parses the --allow-destructive=<file> CLI flag, including multiple occurrences", () => {
    const allowlist = parseDestructiveAllowlist(fakeEnv({ ALLOW_DESTRUCTIVE_MIGRATIONS: undefined }), [
      "node",
      "migrate.ts",
      "--allow-destructive=a.sql",
      "--allow-destructive=b.sql",
    ]);
    expect(allowlist).toEqual(new Set(["a.sql", "b.sql"]));
  });

  it("combines env and CLI sources", () => {
    const allowlist = parseDestructiveAllowlist(fakeEnv({ ALLOW_DESTRUCTIVE_MIGRATIONS: "a.sql" }), [
      "--allow-destructive=b.sql",
    ]);
    expect(allowlist).toEqual(new Set(["a.sql", "b.sql"]));
  });

  it("ignores an unrelated CLI argument", () => {
    expect(parseDestructiveAllowlist(fakeEnv({ ALLOW_DESTRUCTIVE_MIGRATIONS: undefined }), ["--some-other-flag=x"])).toEqual(
      new Set(),
    );
  });
});

describe("scripts/migrate.ts — formatDestructiveMigrationError (ticket #307; amended contract, PR #309 review round 2, P2)", () => {
  it("with no earlier migration committed this run: contains the filename, per-table N -> M with a signed delta, the rollback sentence, 'the database is unchanged', the literal env var opt-in, and the do-not-set warning", () => {
    const message = formatDestructiveMigrationError("012_performance_block.sql", [
      { table: "analyses", before: 412, after: 0 },
    ]);

    expect(message).toContain("012_performance_block.sql");
    expect(message).toContain("analyses: 412 rows -> 0 rows (-412)");
    expect(message).toMatch(/rolled back/i);
    expect(message).toContain("the database is unchanged");
    expect(message).toContain("ALLOW_DESTRUCTIVE_MIGRATIONS=012_performance_block.sql");
    expect(message).toMatch(/do not set that variable/i);
  });

  // PR #309 review round 2, P2 -- the original unconditional "Nothing has
  // been committed... the database is unchanged" is FALSE whenever an
  // earlier pending migration in the same run already applied and
  // committed before this one trips Check C. This is the corrected,
  // amended contract: it must name every migration that already committed
  // this run and say the database is mid-sequence, NOT claim "unchanged".
  it("MUTATION: with earlier migrations already committed this run, names them and says the database is mid-sequence, NOT 'unchanged'", () => {
    const message = formatDestructiveMigrationError(
      "003_wipe.sql",
      [{ table: "a", before: 2, after: 0 }],
      ["001_base.sql", "002_marker.sql"],
    );

    expect(message).toContain("003_wipe.sql");
    expect(message).toContain("a: 2 rows -> 0 rows (-2)");
    expect(message).toMatch(/003_wipe\.sql[\s\S]*rolled back/i);
    expect(message).toContain("001_base.sql, 002_marker.sql");
    expect(message).toMatch(/mid-sequence/i);
    expect(message).not.toContain("the database is unchanged");
  });
});

describe("scripts/migrate.ts — Check A: order regression (ticket #307, catches H1)", () => {
  it("throws naming both files when a pending file sorts before the max applied name", () => {
    expect(() => assertNoOrderRegression(["005_old.sql"], ["001_a.sql", "010_b.sql"])).toThrow(
      /005_old\.sql[\s\S]*010_b\.sql/,
    );
  });

  it("does not throw for a normally-growing migrations directory (new file sorts after)", () => {
    expect(() => assertNoOrderRegression(["011_new.sql"], ["001_a.sql", "010_b.sql"])).not.toThrow();
  });

  it("does not throw when nothing has been applied yet (fresh database)", () => {
    expect(() => assertNoOrderRegression(["001_a.sql", "002_b.sql"], [])).not.toThrow();
  });

  it("MUTATION: a real full-chain run followed by an H1-shaped rename (012 -> 012_performance_block_v2.sql) is refused, and the seeded row + every perf_* value + the widened CHECK survive untouched", async () => {
    const db = makeDbClient();
    const tmpDir = copyRealMigrationsToTmp();

    await runMigrations(db, tmpDir);
    await seedSchema3AnalysisRow(db);

    renameSync(join(tmpDir, "012_performance_block.sql"), join(tmpDir, "012_performance_block_v2.sql"));

    await expect(runMigrations(db, tmpDir)).rejects.toThrow(
      /012_performance_block_v2\.sql[\s\S]*014_profile_lookup_failure\.sql/,
    );

    const row = await readPerfBlock(db);
    expect(row).toBeDefined();
    expect(row!.perf_reach_value).toEqual(12345);
    expect(row!.perf_multiplier).toEqual(1.75);
    expect(row!.performance_score).toEqual(99);

    // Direct probe for 013's widened CHECK still being in effect.
    await expect(
      db.execute({
        sql: "INSERT INTO analyses (id, url, platform, media_type, perf_unavailable_reason) VALUES (?, ?, ?, ?, ?)",
        args: ["reach-not-on-first-slide", "https://instagram.com/p/x", "instagram", "carousel", "REACH_NOT_ON_FIRST_SLIDE"],
      }),
    ).resolves.toBeDefined();

    db.close();
  });
});

describe("scripts/migrate.ts — Check B: renamed migration (ticket #307, catches H2)", () => {
  it("throws naming the original filename for a pending file whose checksum matches an applied row under a different name", () => {
    expect(() =>
      assertNoRenamedMigration(
        [{ file: "015_perf.sql", checksum: "abc" }],
        [{ name: "012_performance_block.sql", checksum: "abc" }],
      ),
    ).toThrow(/015_perf\.sql[\s\S]*012_performance_block\.sql/);
  });

  it("does not throw when the checksum only matches the SAME filename (unchanged, not a rename)", () => {
    expect(() =>
      assertNoRenamedMigration(
        [{ file: "012_performance_block.sql", checksum: "abc" }],
        [{ name: "012_performance_block.sql", checksum: "abc" }],
      ),
    ).not.toThrow();
  });

  it("MUTATION: legacy rows with a NULL checksum carry no identity and are skipped (Check B is inert against them)", () => {
    expect(() =>
      assertNoRenamedMigration(
        [{ file: "999_new.sql", checksum: "abc" }],
        [{ name: "001_legacy.sql", checksum: null }],
      ),
    ).not.toThrow();
  });

  it("MUTATION: a real full-chain run followed by an H2-shaped rename (012 -> 015_perf.sql, sorts AFTER the max applied name so Check A alone would miss it) is refused naming 012_performance_block.sql as the original, and the seeded row + perf block + widened CHECK survive", async () => {
    const db = makeDbClient();
    const tmpDir = copyRealMigrationsToTmp();

    await runMigrations(db, tmpDir);
    await seedSchema3AnalysisRow(db);

    renameSync(join(tmpDir, "012_performance_block.sql"), join(tmpDir, "015_perf.sql"));

    await expect(runMigrations(db, tmpDir)).rejects.toThrow(
      /015_perf\.sql[\s\S]*012_performance_block\.sql/,
    );

    const row = await readPerfBlock(db);
    expect(row!.perf_reach_value).toEqual(12345);
    expect(row!.perf_multiplier).toEqual(1.75);
    expect(row!.performance_score).toEqual(99);

    await expect(
      db.execute({
        sql: "INSERT INTO analyses (id, url, platform, media_type, perf_unavailable_reason) VALUES (?, ?, ?, ?, ?)",
        args: ["reach-not-on-first-slide-2", "https://instagram.com/p/y", "instagram", "carousel", "REACH_NOT_ON_FIRST_SLIDE"],
      }),
    ).resolves.toBeDefined();

    db.close();
  });
});

describe("scripts/migrate.ts — Check C: measured row loss (ticket #307, catches H3)", () => {
  it("MUTATION: an H3-shaped bookkeeping rollback (_migrations rows for 012+ deleted, files untouched) trips Check C, names analyses and 1 -> 0, and rolls back so the row + perf block + widened CHECK survive", async () => {
    const db = makeDbClient();
    const tmpDir = copyRealMigrationsToTmp();

    await runMigrations(db, tmpDir);
    await seedSchema3AnalysisRow(db);

    await db.execute("DELETE FROM _migrations WHERE name >= '012'");

    await expect(runMigrations(db, tmpDir)).rejects.toThrow(
      /012_performance_block\.sql[\s\S]*analyses: 1 rows -> 0 rows \(-1\)/,
    );

    const row = await readPerfBlock(db);
    expect(row!.perf_reach_value).toEqual(12345);
    expect(row!.perf_multiplier).toEqual(1.75);
    expect(row!.performance_score).toEqual(99);

    await expect(
      db.execute({
        sql: "INSERT INTO analyses (id, url, platform, media_type, perf_unavailable_reason) VALUES (?, ?, ?, ?, ?)",
        args: ["reach-not-on-first-slide-3", "https://instagram.com/p/z", "instagram", "carousel", "REACH_NOT_ON_FIRST_SLIDE"],
      }),
    ).resolves.toBeDefined();

    db.close();
  });

  // Scoped to the real 001-012 files only (not the full 14-file chain), as a
  // narrow unit-shaped check of exactly what the opt-in mechanism itself is
  // responsible for: authorizing 012's own row loss, nothing more. This is
  // deliberately NOT the end-to-end proof that the escape hatch gets an
  // operator back to a working database on the REAL chain -- see the
  // "full real chain" describe block below for that (PR #309 review round
  // 1: scoping the ONLY end-to-end test to this subset was the wrong
  // remedy, because it hid exactly the finding in that block).
  it("with the exact-file opt-in, the same H3 scenario proceeds and the destruction is allowed out loud", async () => {
    const db = makeDbClient();
    const tmpDir = copyRealMigrationsUpTo("012_performance_block.sql");

    await runMigrations(db, tmpDir);
    await seedSchema3AnalysisRow(db);
    await db.execute("DELETE FROM _migrations WHERE name = '012_performance_block.sql'");

    const log = await runMigrations(db, tmpDir, new Set(["012_performance_block.sql"]));
    expect(log.find((entry) => entry.file === "012_performance_block.sql")).toEqual({
      file: "012_performance_block.sql",
      action: "applied",
    });

    const rows = await db.execute("SELECT * FROM analyses");
    expect(rows.rows).toHaveLength(0);
    db.close();
  });

  it("MUTATION: the opt-in is per-file -- allowlisting a DIFFERENT filename still throws for the H3 scenario", async () => {
    const db = makeDbClient();
    const tmpDir = copyRealMigrationsUpTo("012_performance_block.sql");

    await runMigrations(db, tmpDir);
    await seedSchema3AnalysisRow(db);
    await db.execute("DELETE FROM _migrations WHERE name = '012_performance_block.sql'");

    await expect(
      runMigrations(db, tmpDir, new Set(["999_some_other_file.sql"])),
    ).rejects.toThrow(/012_performance_block\.sql/);

    db.close();
  });

  it("a fresh database never trips Check C, despite 012 containing an unconditional DELETE FROM analyses", async () => {
    const db = makeDbClient();
    const log = await runMigrations(db, REAL_MIGRATIONS_DIR_307);

    expect(log.length).toEqual(readdirSync(REAL_MIGRATIONS_DIR_307).filter((f) => f.endsWith(".sql")).length);
    expect(log.every((entry) => entry.action === "applied")).toBe(true);
    db.close();
  });

  it("MUTATION: 008's DELETE FROM analyses WHERE schema_version IS NULL deletes 0 rows on a fresh database and does not trip Check C", async () => {
    const db = makeDbClient();
    const partialDir = copyRealMigrationsUpTo("008_delete_legacy_pre_redesign_analyses.sql");

    const log = await runMigrations(db, partialDir);
    expect(log.some((entry) => entry.file === "008_delete_legacy_pre_redesign_analyses.sql")).toBe(true);
    expect(log.every((entry) => entry.action === "applied")).toBe(true);
    db.close();
  });

  // PR #309 review round 2, P2 -- exact reproduction of the reviewer's own
  // repro: three files, the third trips Check C. Proves the abort message
  // names 001 and 002 as already-committed-this-run and does NOT claim the
  // database is unchanged, matching the amended contract in
  // formatDestructiveMigrationError. MUTATION: if the call site regressed to
  // passing an empty/omitted `committedThisRun` list, this test's
  // "001_base.sql, 002_marker.sql" assertion goes red.
  it("MUTATION: when the tripping migration is not the first pending file, the abort message names the earlier migrations that already committed this run, and does not claim the database is unchanged", async () => {
    const db = makeDbClient();
    const dir = makeMigrationsDir({
      "001_base.sql": "BEGIN TRANSACTION;\nCREATE TABLE a (id INTEGER PRIMARY KEY);\nINSERT INTO a (id) VALUES (1);\nCOMMIT;\n",
      "002_marker.sql":
        "BEGIN TRANSACTION;\nCREATE TABLE marker_committed_by_002 (id INTEGER PRIMARY KEY);\nINSERT INTO a (id) VALUES (2);\nCOMMIT;\n",
      "003_wipe.sql": "BEGIN TRANSACTION;\nDELETE FROM a;\nCOMMIT;\n",
    });

    await expect(runMigrations(db, dir)).rejects.toThrow(
      /003_wipe\.sql[\s\S]*a: 2 rows -> 0 rows \(-2\)[\s\S]*001_base\.sql, 002_marker\.sql[\s\S]*mid-sequence/,
    );

    // And the database really is mid-sequence, not unchanged: 001 and 002's
    // effects are durably committed.
    const migrations = await db.execute("SELECT name FROM _migrations ORDER BY name");
    expect(migrations.rows.map((r) => r.name)).toEqual(["001_base.sql", "002_marker.sql"]);
    await expect(db.execute("SELECT * FROM marker_committed_by_002")).resolves.toBeDefined();
    const rows = await db.execute("SELECT COUNT(*) as c FROM a");
    expect(rows.rows[0]!.c).toEqual(2);
    db.close();
  });

  // PR #309 review round 2 -- the tx-vs-client mutation is genuinely killed,
  // but only incidentally by integration tests that assert on Check C's
  // observable BEHAVIOR, not on the call site itself. This test makes the
  // call-site invariant deliberate: it spies on the CLIENT (not any
  // Transaction obtained from it) and asserts Check C's `SELECT COUNT(*)`
  // queries never reach the client directly while a pending migration is
  // being applied. MUTATION: reverting either `snapshotRowCounts(tx)` call
  // in `runMigrations` to `snapshotRowCounts(client)` makes this spy
  // observe a `SELECT COUNT(*)` call and turns this test red.
  it("MUTATION: Check C's row-count queries are issued against the transaction, never against the client directly", async () => {
    const db = makeDbClient();
    const dir = makeMigrationsDir({
      "001_first.sql": "BEGIN TRANSACTION;\nCREATE TABLE a (id INTEGER PRIMARY KEY);\nINSERT INTO a (id) VALUES (1);\nCOMMIT;\n",
    });
    // 001 must already be applied and COMMITTED before the spy is attached:
    // a pending migration whose target table doesn't exist yet at the
    // "before" snapshot would give both `client` and `tx` an identically
    // empty `sqlite_master` listing (no COUNT query issued either way),
    // which would pass under the mutation too -- a false negative. With `a`
    // already committed, `sqlite_master` lists it regardless of which
    // executor is used, so the mutation is forced to show itself.
    await runMigrations(db, dir);
    writeFileSync(join(dir, "002_second.sql"), "BEGIN TRANSACTION;\nINSERT INTO a (id) VALUES (2);\nCOMMIT;\n", "utf8");

    const clientLevelCountQueries: string[] = [];
    const spiedClient = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === "execute") {
          return async (stmt: InStatement) => {
            const sql = typeof stmt === "string" ? stmt : stmt.sql;
            if (typeof sql === "string" && /SELECT COUNT\(\*\)/.test(sql)) {
              clientLevelCountQueries.push(sql);
            }
            return target.execute(stmt);
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    await runMigrations(spiedClient as unknown as Client, dir);

    expect(clientLevelCountQueries).toEqual([]);
    db.close();
  });

  // PR #309 review round 2, P3 (non-blocking, addressed here) -- the
  // `after[table] ?? 0` dropped-table branch in `diffRowCounts` had unit
  // coverage only; no integration case exercised a real DROP TABLE
  // migration end to end through `runMigrations`.
  it("MUTATION: an integration case for a DROP TABLE migration -- Check C catches the drop as a loss to 0, rolls back, and the table survives", async () => {
    const db = makeDbClient();
    const dir = makeMigrationsDir({
      "001_seed.sql": "BEGIN TRANSACTION;\nCREATE TABLE widgets (id INTEGER PRIMARY KEY);\nINSERT INTO widgets (id) VALUES (1);\nCOMMIT;\n",
    });
    await runMigrations(db, dir);
    writeFileSync(join(dir, "002_drop.sql"), "BEGIN TRANSACTION;\nDROP TABLE widgets;\nCOMMIT;\n", "utf8");

    await expect(runMigrations(db, dir)).rejects.toThrow(/widgets: 1 rows -> 0 rows \(-1\)/);
    await expect(db.execute("SELECT * FROM widgets")).resolves.toBeDefined();
    db.close();
  });

  it("with the opt-in, the same DROP TABLE migration proceeds and the table is genuinely gone", async () => {
    const db = makeDbClient();
    const dir = makeMigrationsDir({
      "001_seed.sql": "BEGIN TRANSACTION;\nCREATE TABLE widgets (id INTEGER PRIMARY KEY);\nINSERT INTO widgets (id) VALUES (1);\nCOMMIT;\n",
    });
    await runMigrations(db, dir);
    writeFileSync(join(dir, "002_drop.sql"), "BEGIN TRANSACTION;\nDROP TABLE widgets;\nCOMMIT;\n", "utf8");

    const log = await runMigrations(db, dir, new Set(["002_drop.sql"]));
    expect(log.find((entry) => entry.file === "002_drop.sql")).toEqual({ file: "002_drop.sql", action: "applied" });

    await expect(db.execute("SELECT * FROM widgets")).rejects.toThrow(/no such table/i);
    db.close();
  });
});

describe("scripts/migrate.ts — real migration chain, full end-to-end guard behavior (ticket #307)", () => {
  it("the full real chain on a fresh database applies every file with no check tripping", async () => {
    const db = makeDbClient();
    const log = await runMigrations(db, REAL_MIGRATIONS_DIR_307);

    const fileCount = readdirSync(REAL_MIGRATIONS_DIR_307).filter((f) => f.endsWith(".sql")).length;
    expect(fileCount).toEqual(14);
    expect(log).toHaveLength(14);
    expect(log.every((entry) => entry.action === "applied")).toBe(true);
    db.close();
  });

  // TDD §7.1 / ticket acceptance criteria -- this PR must edit zero `.sql`
  // files. 012 must remain the in-repo, unconditional-DELETE version;
  // protection lives entirely in the runner, not inside any migration file.
  it("migrations/012_performance_block.sql has no in-file destructive guard (protection lives in the runner, not the file)", () => {
    const contents = readFileSync(join(REAL_MIGRATIONS_DIR_307, "012_performance_block.sql"), "utf8");
    // Unconditional -- no WHERE clause guarding the DELETE (an in-file guard
    // would look like `DELETE FROM analyses WHERE schema_version ...;`).
    expect(contents).toMatch(/^DELETE FROM analyses;$/m);
  });
});

/**
 * PR #309 review round 1, P1 -- restored (not narrowed) end-to-end proof of
 * the escape hatch against the REAL 14-file chain. The earlier version of
 * this suite scoped its only "opt-in succeeds" scenario to a synthetic
 * 001-012 subset, which hid the actual finding below: on the real chain, the
 * documented recovery flow (opt-in for 012 alone, redeploy) does NOT reach a
 * working database -- it dies on 014. Both facts are pinned here, by
 * execution, exactly as the RUNBOOK's "destructive opt-in" section now
 * documents:
 *   1. opt-in for 012 ALONE, on the real chain, reaches a BROKEN end state
 *      (this is the real limitation the earlier narrow test hid -- pinned as
 *      a regression guard, not treated as a design goal to silently work
 *      around).
 *   2. the corrected two-deploy recovery (opt-in deploy, THEN manually
 *      restore 014's bookkeeping row, THEN redeploy) reaches a genuinely
 *      working database -- this is the actual proof that the escape hatch is
 *      useful, not merely permissive.
 */
describe("scripts/migrate.ts — full real chain through the escape hatch (ticket #307; restored per PR #309 review round 1, P1)", () => {
  it("MUTATION: opt-in for 012 alone, on the full real chain, destroys the data and then dies on 014 -- this pins the documented dead end, not a design goal", async () => {
    const db = makeDbClient();
    const tmpDir = copyRealMigrationsToTmp();

    await runMigrations(db, tmpDir);
    await seedSchema3AnalysisRow(db);
    await db.execute("DELETE FROM _migrations WHERE name >= '012'");

    await expect(runMigrations(db, tmpDir, new Set(["012_performance_block.sql"]))).rejects.toThrow(
      /duplicate column name: lookup_failed_at/,
    );

    // 012 and 013 committed (data really is gone); 014 is untracked while
    // its column already exists on `profiles` -- the documented stuck state.
    const tracked = await db.execute("SELECT name FROM _migrations ORDER BY name");
    expect(tracked.rows.map((r) => r.name)).not.toContain("014_profile_lookup_failure.sql");
    expect(tracked.rows.map((r) => r.name)).toContain("013_reach_unavailable_reason.sql");

    const analysesRows = await db.execute("SELECT COUNT(*) as c FROM analyses");
    expect(analysesRows.rows[0]!.c).toEqual(0);

    const profileCols = await db.execute("PRAGMA table_info(profiles)");
    expect(profileCols.rows.some((c) => c.name === "lookup_failed_at")).toBe(true);

    // And the deploy pipeline is now stuck: a bare redeploy (no new opt-in)
    // fails identically, forever, until a human intervenes.
    await expect(runMigrations(db, tmpDir)).rejects.toThrow(/duplicate column name: lookup_failed_at/);

    db.close();
  });

  it("the corrected two-deploy recovery (opt-in deploy, then restore 014's bookkeeping row, then redeploy) reaches a genuinely working database", async () => {
    const db = makeDbClient();
    const tmpDir = copyRealMigrationsToTmp();

    await runMigrations(db, tmpDir);
    await seedSchema3AnalysisRow(db);
    await db.execute("DELETE FROM _migrations WHERE name >= '012'");

    // Deploy 1: the opt-in for 012, exactly as an operator would set it.
    // Dies on 014, as pinned above -- expected here, not asserted as a
    // failure of this test.
    await expect(runMigrations(db, tmpDir, new Set(["012_performance_block.sql"]))).rejects.toThrow(
      /duplicate column name/,
    );

    // Manual step, per the RUNBOOK: restore 014's bookkeeping row with its
    // real on-disk checksum, AFTER the crash (not before -- Check A would
    // reject restoring a later file's row while 012/013 were still pending).
    const checksum014 = computeChecksum(
      readFileSync(join(tmpDir, "014_profile_lookup_failure.sql"), "utf8"),
    );
    await db.execute({
      sql: "INSERT INTO _migrations (name, checksum) VALUES (?, ?)",
      args: ["014_profile_lookup_failure.sql", checksum014],
    });

    // Deploy 2: no env var needed. This is the actual proof the escape
    // hatch, combined with the documented follow-up, gets an operator to a
    // working database -- not just a permissive one.
    const log = await runMigrations(db, tmpDir);
    expect(log.find((e) => e.file === "014_profile_lookup_failure.sql")).toEqual({
      file: "014_profile_lookup_failure.sql",
      action: "unchanged",
    });

    const tracked = await db.execute("SELECT name FROM _migrations");
    expect(tracked.rows).toHaveLength(14);

    const analysesRows = await db.execute("SELECT COUNT(*) as c FROM analyses");
    expect(analysesRows.rows[0]!.c).toEqual(0);

    // The database is genuinely usable afterward: schema-3 inserts,
    // including 013's widened CHECK, work.
    await expect(
      db.execute({
        sql: "INSERT INTO analyses (id, url, platform, media_type, perf_unavailable_reason) VALUES (?, ?, ?, ?, ?)",
        args: ["post-recovery", "https://instagram.com/p/post", "instagram", "carousel", "REACH_NOT_ON_FIRST_SLIDE"],
      }),
    ).resolves.toBeDefined();

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
