import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Client } from "@libsql/client";

/**
 * Ticket #278 — a migration is tracked by content hash, not just filename.
 * Normalizes CRLF -> LF before hashing so a checkout-time line-ending change
 * (e.g. a different `core.autocrlf` setting) never counts as a content
 * change. Hashes the FULL raw file exactly as read from disk (including
 * comments) -- a comment-only edit to an already-applied migration must
 * still be caught, per the ticket's own motivating example ("editing a
 * migration's comment is provably inert").
 */
export function computeChecksum(sql: string): string {
  const normalized = sql.replace(/\r\n/g, "\n");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/**
 * Ticket #277 — strips a migration file's own `BEGIN TRANSACTION; ... COMMIT;`
 * wrapper so its body can be executed inside a transaction `migrate.ts`
 * itself owns (see `runMigrations` below). This is a RUNTIME string
 * transform only: the `.sql` files on disk are never edited by this
 * function. That is the deliberate choice over the ticket's other suggested
 * direction (stripping `BEGIN`/`COMMIT` from the files themselves) -- never
 * touching an already-applied migration file's on-disk history keeps that
 * file's checksum meaningful (see #278) for every edit made *after* it is
 * first checksum-tracked, without this script having to special-case which
 * edits are "safe." (On the very first deploy of #278 itself, a NULL stored
 * checksum is adopted from disk rather than compared -- see `runMigrations`
 * -- so an edit landing in that same deploy would not collide either way;
 * that is not the reason for the runtime-strip choice, see the PR
 * description.)
 *
 * Only strips when BOTH a leading `BEGIN TRANSACTION;` and a trailing
 * `COMMIT;` are present (some migrations, e.g. 001 and 003, have no wrapper
 * at all -- historically inconsistent, so this is tolerant of both shapes).
 * Never strips just one side: a lone `BEGIN` with no matching `COMMIT` is
 * left untouched.
 *
 * PR #305 review, P2 -- after attempting the strip, throws if a transaction
 * -control token still remains in the body, instead of silently handing a
 * broken script to the driver:
 *   - A SECOND `BEGIN TRANSACTION;`/`COMMIT;` block in the same file would
 *     otherwise leave an interior `COMMIT` in the stripped body. libsql
 *     accepts it without error -- it just commits `migrate.ts`'s own outer
 *     transaction early and runs the remainder in an implicit second one,
 *     silently reopening the exact applied-but-untracked window #277
 *     exists to close.
 *   - A wrapper shape this function does not recognize (a leading header
 *     comment before `BEGIN TRANSACTION;`, `BEGIN;` short form, `COMMIT
 *     TRANSACTION;`, `END;`, `BEGIN IMMEDIATE TRANSACTION;`, or trailing
 *     content after `COMMIT;`) fails the strip silently and previously died
 *     inside the deploy with SQLite's own "cannot start a transaction
 *     within a transaction," naming neither the file nor the cause.
 * Every current file's wrapper (verified against all 14 files in
 * `migrations/`) is either the single-block shape this strips cleanly, or
 * has no wrapper at all -- so this check cannot fire against any file in
 * the repo today. It exists for the next migration author.
 *
 * PR #305 review round 2, P2 -- the residual-token check scans STATEMENT
 * POSITION, not raw text. The original `/\bBEGIN\s+TRANSACTION\b|\bCOMMIT\b/i`
 * matched the bare word anywhere in the body, including inside line comments,
 * block comments, and string literals, so `-- do not COMMIT here`,
 * `INSERT INTO t VALUES ('COMMIT')`, or `commit` used as a bare column
 * identifier all threw a false positive that misdiagnosed the cause (012's
 * own comment survived only because "committing" doesn't match `\bCOMMIT\b`
 * as a whole word -- pure luck). `stripCommentsAndStrings` blanks out line
 * comments, block comments, and string-literal contents first; the cleaned
 * body is then split on `;` and only a STATEMENT that itself starts with
 * `BEGIN TRANSACTION` or `COMMIT` trips the error -- a bare mention of the
 * word mid-statement (e.g. a `commit` column name) no longer does.
 *
 * PR #305 review round 3, P1 -- the round-2 implementation above ran three
 * independent regex passes in a fixed order (strings, then `--` comments,
 * then `/* *\/` comments), and the FIRST pass (string literals) does not
 * know a `'` can appear inside a comment. Every one of this repo's own
 * migration comments that contains an apostrophe (`don't`, `it's`, "the
 * table's") opens a phantom string literal that the regex then closes at
 * the NEXT `'` anywhere later in the file -- silently deleting everything
 * in between, including real SQL, before the comment-stripping passes ever
 * run. Reversing the pass order does not fix it either: a `'` inside a
 * string that itself contains `--` breaks the same way in the other
 * direction. Any fixed-order, multi-pass regex approach has this problem,
 * because "am I inside a string" and "am I inside a comment" are NOT
 * independent, order-invariant properties of the text -- they are mutually
 * exclusive STATES that can only be resolved by reading the text once,
 * left to right, remembering which state you are currently in.
 *
 * Rewritten as a single left-to-right scan over the raw characters with one
 * mutable "what am I currently inside" state, so a `'` is only ever
 * significant when the scanner is not already inside a `--`/`/* *\/`
 * comment (and a `--`/`/*` is only ever significant when not already inside
 * a string). Recognizes, in one pass:
 *   - `--` line comments (through the next `\n`, or EOF if the file's last
 *     line is a comment).
 *   - `/* ... *\/` block comments, including one left unterminated at EOF
 *     (consumed to EOF rather than looping forever or throwing).
 *   - `'...'` string literals, including SQLite's `''` escaped-quote-inside-
 *     a-string (`'it''s'`) -- the scanner does not exit the string on the
 *     first `'` of a `''` pair.
 *   - `"..."` double-quoted identifiers and `` `...` `` backtick identifiers
 *     (both accepted by SQLite), each with the same `""`/`` `` `` `` doubled-
 *     quote escape, so a `;`, `'`, `--`, or `/*` inside either is inert --
 *     matching the same reasoning as string literals, since SQLite lets an
 *     identifier be quoted with any of `'`, `"`, or `` ` ``.
 *   - `[...]` bracketed identifiers (SQL Server-style, also accepted by
 *     SQLite), so the same applies there.
 * Every character inside one of the above regions is replaced with a space
 * (or kept as `\n` for an embedded newline) rather than deleted, so the
 * cleaned string stays the same length and line/column offsets into it
 * still line up with the original file -- useful if a future caller wants
 * to report *where* a residual token was found, not just that one was.
 * Quote/comment delimiter characters themselves are left in place (`'`,
 * `"`, `` ` ``, `[`, `]`, `--`, `/ *`, `* /`) purely so the output visually
 * still resembles the input; nothing downstream depends on that choice.
 * CRLF files need no special handling: a line comment's terminator is `\n`
 * either way, and a bare `\r` carried along inside a blanked region is
 * itself replaced with a space, same as any other non-newline character.
 */
function stripCommentsAndStrings(sql: string): string {
  const OPEN_TO_CLOSE: Record<string, string> = { '"': '"', "`": "`", "[": "]" };

  let out = "";
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];
    const nextCh = sql[i + 1];

    if (ch === "-" && nextCh === "-") {
      out += "  ";
      i += 2;
      while (i < n && sql[i] !== "\n") {
        out += " ";
        i += 1;
      }
      continue;
    }

    if (ch === "/" && nextCh === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(sql[i] === "*" && sql[i + 1] === "/")) {
        out += sql[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      if (i < n) {
        out += "  ";
        i += 2;
      }
      continue;
    }

    if (ch === "'") {
      out += "'";
      i += 1;
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          out += "  ";
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          out += "'";
          i += 1;
          break;
        }
        out += sql[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      continue;
    }

    if (ch === '"' || ch === "`" || ch === "[") {
      const close = OPEN_TO_CLOSE[ch]!;
      out += ch;
      i += 1;
      while (i < n) {
        if (ch !== "[" && sql[i] === close && sql[i + 1] === close) {
          out += close + close;
          i += 2;
          continue;
        }
        if (sql[i] === close) {
          out += close;
          i += 1;
          break;
        }
        out += sql[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

const RESIDUAL_TRANSACTION_STATEMENT = /^\s*(BEGIN\s+TRANSACTION|COMMIT)\b/i;

function hasResidualTransactionControl(body: string): boolean {
  const cleaned = stripCommentsAndStrings(body);
  return cleaned.split(";").some((statement) => RESIDUAL_TRANSACTION_STATEMENT.test(statement));
}

export function stripOuterTransaction(sql: string, fileName = "<unknown migration file>"): string {
  const beginPattern = /^\s*BEGIN\s+TRANSACTION\s*;/i;
  const commitPattern = /COMMIT\s*;\s*$/i;

  const body =
    beginPattern.test(sql) && commitPattern.test(sql)
      ? sql.replace(beginPattern, "").replace(commitPattern, "")
      : sql;

  if (hasResidualTransactionControl(body)) {
    throw new Error(
      `${fileName}: contains a BEGIN TRANSACTION or COMMIT statement that stripOuterTransaction ` +
        `did not remove. This is either (a) a second transaction block in the same file, which ` +
        `would silently split migrate.ts's outer transaction, or (b) a wrapper shape this function ` +
        `does not recognize -- it only strips a leading "BEGIN TRANSACTION;" paired with a trailing ` +
        `"COMMIT;" as the file's first and last statements, not "BEGIN;", "COMMIT TRANSACTION;", ` +
        `"END;", "BEGIN IMMEDIATE TRANSACTION;", a header comment before BEGIN, or content after ` +
        `COMMIT. Use exactly one "BEGIN TRANSACTION; ... COMMIT;" block, or omit the wrapper ` +
        `entirely (see docs/RUNBOOK.md § Migrations).`,
    );
  }

  return body;
}

export interface MigrationLogEntry {
  file: string;
  action: "applied" | "unchanged" | "adopted-legacy-checksum";
}

/**
 * `checksum` is nullable: rows written before this ticket (#278) have no
 * checksum, and a fresh `CREATE TABLE IF NOT EXISTS` is a no-op against an
 * existing table, so an already-populated `_migrations` table needs an
 * explicit `ALTER TABLE ... ADD COLUMN`. This is additive, in-script
 * bookkeeping-table evolution -- not a migration of application data, and
 * not the standing no-new-migration-file prohibition (owner ruling on both
 * #277 and #278: "this is a script fix, not a schema change").
 *
 * PR #305 review, P2 -- `hasChecksum` is decided from `PRAGMA
 * table_info(_migrations)`, which is only verified locally; its behavior
 * over Turso's remote protocol is untested and untestable here. If it ever
 * misbehaves and reports `hasChecksum: false` on a database that already
 * has the column, the bare `ALTER TABLE ... ADD COLUMN` below would throw
 * `duplicate column name` and block every deploy from then on. The
 * `try/catch` is one-line insurance against exactly that single point of
 * failure: only a "duplicate column name" error is swallowed (the column
 * already existing is not a real failure), anything else still throws.
 */
export async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      checksum TEXT
    )
  `);

  const columns = await client.execute("PRAGMA table_info(_migrations)");
  const hasChecksum = columns.rows.some((row) => row.name === "checksum");

  if (!hasChecksum) {
    try {
      await client.execute("ALTER TABLE _migrations ADD COLUMN checksum TEXT");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/duplicate column name/i.test(message)) {
        throw error;
      }
    }
  }
}

/**
 * Runs every `.sql` file in `migrationsDir` against `client`, in filename
 * order. Ticket #277 + #278 combined:
 *
 * - An unapplied migration is executed AND recorded in one interactive
 *   transaction (`client.transaction("write")`): the migration body
 *   (`tx.executeMultiple`) and the `INSERT INTO _migrations` tracking row
 *   share one commit. There is no longer a round-trip-wide window where a
 *   migration is applied but untracked -- proven by mutation test (see
 *   `tests/server/db/migrate.test.ts`): a thrown error between the body and
 *   the tracking insert leaves NOTHING durable, not even the migration's own
 *   schema changes.
 * - An already-applied migration (a row already exists in `_migrations`) is
 *   checksum-compared instead of blindly skipped:
 *     - stored checksum NULL (a legacy row, from before #278 shipped):
 *       adopt the current on-disk checksum as the trusted baseline and log
 *       it, WITHOUT re-running the migration body. See the PR description
 *       for why this is the deliberate policy, not silent-forever or
 *       fail-loud-on-NULL.
 *     - stored checksum present and mismatched: throw immediately. The
 *       whole script aborts (Railway's `preDeployCommand` fails the deploy)
 *       rather than silently re-running or silently ignoring the edit.
 *       (Note: any migration earlier in this same run/this same array has
 *       already committed by this point -- an abort here does not roll
 *       those back. See the PR description.)
 *     - stored checksum present and matches: skip, no log noise beyond the
 *       returned log entry.
 *
 * PR #305 review, P3 -- a `_migrations` row whose file no longer exists on
 * disk (renamed or deleted after being applied) is warned about, not
 * silently ignored: this is the other half of the rename hazard 012's own
 * guard defends against (see `migrations/012_performance_block.sql`) --
 * warning here gives an operator a chance to notice the rename BEFORE it
 * re-applies as a new file, rather than only defending the one migration
 * (012) whose re-application is known to be destructive.
 *
 * PR #305 review, P3 -- always prints a one-line summary at the end, so a
 * clean no-op run ("nothing to do") is distinguishable in the deploy log
 * from the script silently not running at all (e.g. a future change to
 * `isDirectRun`'s invocation-path assumption).
 */
export async function runMigrations(client: Client, migrationsDir: string): Promise<MigrationLogEntry[]> {
  await ensureMigrationsTable(client);

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const fileSet = new Set(files);

  const log: MigrationLogEntry[] = [];

  for (const file of files) {
    const raw = readFileSync(join(migrationsDir, file), "utf8");
    const checksum = computeChecksum(raw);

    const existing = await client.execute({
      sql: "SELECT checksum FROM _migrations WHERE name = ? LIMIT 1",
      args: [file],
    });

    if (existing.rows.length > 0) {
      const storedChecksum = existing.rows[0]!.checksum as string | null;

      if (storedChecksum === null) {
        await client.execute({
          sql: "UPDATE _migrations SET checksum = ? WHERE name = ?",
          args: [checksum, file],
        });
        console.log(`Adopted checksum baseline for legacy migration ${file} (not re-applied)`);
        log.push({ file, action: "adopted-legacy-checksum" });
        continue;
      }

      if (storedChecksum !== checksum) {
        throw new Error(
          `Migration ${file} was already applied, but its file content on disk no longer ` +
            `matches the checksum recorded when it was applied (recorded ${storedChecksum}, ` +
            `on-disk ${checksum}). Refusing to continue: editing an already-applied migration ` +
            `is not supported. Revert the file, or write a new migration instead. (Any migration ` +
            `earlier than ${file} in this same run has already been applied and committed -- the ` +
            `database is now mid-sequence, not left exactly as it was before this run started.)`,
        );
      }

      log.push({ file, action: "unchanged" });
      continue;
    }

    const body = stripOuterTransaction(raw, file);

    const tx = await client.transaction("write");
    try {
      await tx.executeMultiple(body);
      await tx.execute({
        sql: "INSERT INTO _migrations (name, checksum) VALUES (?, ?)",
        args: [file, checksum],
      });
      await tx.commit();
    } catch (error) {
      try {
        await tx.rollback();
      } catch (rollbackError) {
        // The original `error` is what a deploy operator needs to see --
        // this scenario (a dying connection) is exactly when rollback()
        // itself is most likely to throw. Log it, but never let it replace
        // or swallow `error` below.
        console.error(`Rollback also failed while handling the error above for ${file}:`, rollbackError);
      }
      throw error;
    } finally {
      tx.close();
    }

    console.log(`Applied ${file}`);
    log.push({ file, action: "applied" });
  }

  const trackedRows = await client.execute("SELECT name FROM _migrations");
  for (const row of trackedRows.rows) {
    const name = row.name as string;
    if (!fileSet.has(name)) {
      console.warn(
        `WARNING: _migrations has a tracked row for "${name}" but no matching file exists in ` +
          `${migrationsDir}. If this file was renamed, restore it (or add a file with this exact ` +
          `name back) before removing the old name -- an untracked rename target re-applies as a ` +
          `brand-new migration on the next run.`,
      );
    }
  }

  const applied = log.filter((entry) => entry.action === "applied").length;
  const unchanged = log.filter((entry) => entry.action === "unchanged").length;
  const adopted = log.filter((entry) => entry.action === "adopted-legacy-checksum").length;
  console.log(
    `migrations: ${log.length} total, ${applied} applied, ${unchanged} unchanged, ${adopted} adopted-legacy-checksum`,
  );

  return log;
}

async function main() {
  // Lazy, dynamic import -- PR #305 review, P2. `../lib/server/db`
  // constructs a `createClient` from `TURSO_DATABASE_URL` at module top
  // level. A static top-level `import { db } from "../lib/server/db"` here
  // would mean `tests/server/db/migrate.test.ts` importing this module's
  // other exports (`computeChecksum`, `runMigrations`, etc.) for unit
  // testing also, as a side effect, constructs a live database client
  // handle in the test process on any machine where `TURSO_*` env vars are
  // set -- one careless future `db.execute` away from a migration test
  // touching production. Deferring the import into `main()`, which only
  // runs under `isDirectRun` below, means the test suite never triggers it.
  const { db } = await import("../lib/server/db");
  await runMigrations(db, join(process.cwd(), "migrations"));
  db.close();
}

// Guards against `main()` firing on import (e.g. from the test suite, which
// imports this module's exports for direct unit/mutation testing). `tsx` and
// `node` both set `process.argv[1]` to the entry script's path; vitest's
// worker process does not, so this stays false under test.
const isDirectRun = process.argv[1]?.endsWith("migrate.ts") ?? false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
