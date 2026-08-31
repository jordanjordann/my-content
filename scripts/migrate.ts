import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Client, Transaction } from "@libsql/client";

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
 *     TRANSACTION;`, `BEGIN IMMEDIATE TRANSACTION;`, or trailing content
 *     after `COMMIT;`) fails the strip silently and previously died inside
 *     the deploy with SQLite's own "cannot start a transaction within a
 *     transaction," naming neither the file nor the cause. NOTE: `END;`
 *     (SQLite's `COMMIT` synonym) as the terminator of a second block, or a
 *     bare `BEGIN;` opening one, is NOT one of the recognized-and-rejected
 *     shapes below -- `hasResidualTransactionControl`'s statement-start scan
 *     has no vocabulary for `END`, so that combination is silently missed
 *     (PR #305 review round 4, P2; tracked in #307, not fixed here -- naively
 *     adding `END` to the scan would false-positive on every
 *     `CREATE TRIGGER ... BEGIN ... END;`).
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
export function stripCommentsAndStrings(sql: string): string {
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
        `did not remove. This is either (a) a second transaction block in the same file whose ` +
        `interior statement literally starts with "BEGIN TRANSACTION" or "COMMIT", which would ` +
        `silently split migrate.ts's outer transaction, or (b) a wrapper shape this function does ` +
        `not recognize -- it only strips a leading "BEGIN TRANSACTION;" paired with a trailing ` +
        `"COMMIT;" as the file's first and last statements, not "BEGIN;", "COMMIT TRANSACTION;", ` +
        `"BEGIN IMMEDIATE TRANSACTION;", a header comment before BEGIN, or content after COMMIT. ` +
        `NOTE: a block terminated with "END;" (SQLite's COMMIT synonym) or opened with a bare ` +
        `"BEGIN;" is NOT detected by this check -- see #307. Use exactly one ` +
        `"BEGIN TRANSACTION; ... COMMIT;" block, or omit the wrapper entirely (see docs/RUNBOOK.md ` +
        `§ Migrations).`,
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
 * Ticket #307 — runner-level guard against a migration being re-presented
 * under a new name (Checks A/B) or destroying rows in a non-empty database
 * (Check C). See docs/TDD-migration-runner-guard.md for the full design and
 * docs/RUNBOOK.md § Migrations for the operator-facing recovery flow.
 */
export interface TableRowCounts {
  [table: string]: number;
}

export interface RowLoss {
  table: string;
  before: number;
  after: number;
}

/**
 * Check C's measurement primitive. Snapshots `COUNT(*)` for every user
 * table -- every table in `sqlite_master` except SQLite's own `sqlite_%`
 * internals and `_migrations` itself (the runner's own bookkeeping, updated
 * inside the same transaction it is measuring). No config, no hard-coded
 * table names: a table with 0 rows before a migration runs cannot lose
 * rows, so a fresh database is self-scoping and never trips anything here.
 *
 * MUST be called with the in-flight `Transaction`, not the `Client`. A
 * snapshot taken on the client reads outside the transaction and would
 * silently miss every uncommitted effect of the migration body currently
 * running inside `tx` -- turning this into a permanent no-op against the
 * exact case (a pending migration's own body) it exists to observe. Both
 * `Transaction` and `Client` expose the same `execute` shape, so nothing
 * about the type signature stops this mistake -- it's a runtime footgun, not
 * a compile-time one. See `tests/server/db/migrate.test.ts`'s dedicated
 * "snapshot reads inside tx" test.
 */
export async function snapshotRowCounts(executor: Transaction | Client): Promise<TableRowCounts> {
  const tables = await executor.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_migrations'",
  );

  const counts: TableRowCounts = {};
  for (const row of tables.rows) {
    const table = row.name as string;
    // Table names come from sqlite_master itself, not user input -- still
    // quoted as a double-quoted identifier rather than interpolated bare,
    // since SQLite table names may contain characters that are not valid
    // unquoted (e.g. this repo's own tables never do, but a future one
    // could).
    const result = await executor.execute(`SELECT COUNT(*) AS count FROM "${table}"`);
    counts[table] = Number(result.rows[0]!.count);
  }
  return counts;
}

/**
 * Check C's decision primitive. A table present in `before` whose count
 * decreased is a loss -- a table dropped entirely by the migration (absent
 * from `after`) counts as decreasing to 0. A table `after` has that `before`
 * does not (created by the migration) is ignored: nothing was lost, there
 * was nothing to lose from.
 */
export function diffRowCounts(before: TableRowCounts, after: TableRowCounts): RowLoss[] {
  const losses: RowLoss[] = [];
  for (const [table, beforeCount] of Object.entries(before)) {
    const afterCount = after[table] ?? 0;
    if (afterCount < beforeCount) {
      losses.push({ table, before: beforeCount, after: afterCount });
    }
  }
  return losses;
}

/**
 * Escape hatch for Check C. Deliberately a comma-separated list of EXACT
 * filenames, not a boolean -- `ALLOW_DESTRUCTIVE_MIGRATIONS=012_x.sql`
 * authorises only that one file to lose rows on this run; it does not
 * pre-authorise any future destructive migration. `--allow-destructive=<f>`
 * (repeatable) is the CLI equivalent for a local developer resetting a
 * local DB, so they never have to touch env vars for a one-off run.
 */
export function parseDestructiveAllowlist(env: NodeJS.ProcessEnv, argv: string[]): Set<string> {
  const allowlist = new Set<string>();

  const envValue = env.ALLOW_DESTRUCTIVE_MIGRATIONS;
  if (envValue) {
    for (const name of envValue.split(",")) {
      const trimmed = name.trim();
      if (trimmed) allowlist.add(trimmed);
    }
  }

  for (const arg of argv) {
    const match = /^--allow-destructive=(.+)$/.exec(arg);
    if (match) {
      const trimmed = match[1]!.trim();
      if (trimmed) allowlist.add(trimmed);
    }
  }

  return allowlist;
}

/**
 * Check A (catches H1: rename to a lower/equal sort key). A pending file
 * that sorts before the highest already-applied filename is a regression --
 * someone re-added, restored, or renamed an old migration to look new.
 * `appliedNames` is read from `_migrations` BEFORE the apply loop starts, so
 * this does not compare a file against itself or against migrations applied
 * earlier in the very same run.
 */
export function assertNoOrderRegression(pendingFiles: string[], appliedNames: string[]): void {
  if (appliedNames.length === 0) return;

  const maxApplied = appliedNames.reduce((max, name) => (name > max ? name : max));

  for (const file of pendingFiles) {
    if (file < maxApplied) {
      throw new Error(
        `Migration order regression detected: pending file "${file}" sorts before the most ` +
          `recently applied migration "${maxApplied}". This is the signature of a migration file ` +
          `being renamed, restored, or re-added under a name that sorts earlier than migrations ` +
          `already applied to this database. Refusing to run "${file}" -- if this is genuinely a ` +
          `new migration, give it a filename that sorts after "${maxApplied}". See ` +
          `docs/RUNBOOK.md § Migrations.`,
      );
    }
  }
}

/**
 * Check B (catches H2: rename to a higher sort key, which Check A misses).
 * A pending file whose checksum already exists in `_migrations` under a
 * DIFFERENT filename is provably the same migration, renamed -- not a new
 * migration that happens to produce identical bytes. Rows with a NULL
 * checksum (legacy, pre-#278) carry no identity to match against and are
 * skipped: Check B is therefore inert on the very first deploy after #278
 * ships, and fully effective from the second deploy onward (see
 * docs/RUNBOOK.md § Migrations).
 *
 * This is also the upgrade of PR #305's orphan-row `console.warn` to a hard
 * abort for exactly the case where the orphan is provably a rename (its
 * checksum matches a pending file); the warning is left as-is for a
 * genuinely deleted migration (no matching pending checksum).
 */
export function assertNoRenamedMigration(
  pending: { file: string; checksum: string }[],
  applied: { name: string; checksum: string | null }[],
): void {
  const checksumToName = new Map<string, string>();
  for (const row of applied) {
    if (row.checksum !== null) {
      checksumToName.set(row.checksum, row.name);
    }
  }

  for (const { file, checksum } of pending) {
    const originalName = checksumToName.get(checksum);
    if (originalName && originalName !== file) {
      throw new Error(
        `Migration "${file}" is byte-identical (checksum ${checksum}) to already-applied ` +
          `migration "${originalName}". This is a renamed or re-presented migration, not a new ` +
          `one, and re-running it against a non-empty database is exactly the hazard this guard ` +
          `exists to stop. Refusing to run "${file}" -- restore the original filename ` +
          `"${originalName}" (and delete "${file}"), or if this is genuinely intended to be a new ` +
          `migration, change its content. See docs/RUNBOOK.md § Migrations.`,
      );
    }
  }
}

/**
 * Check C's abort message.
 *
 * PR #309 review round 2, P2 -- the original version of this message
 * unconditionally claimed "Nothing has been committed... the database is
 * unchanged." That is true when the tripping migration is the FIRST pending
 * file in this run (Checks A and B are a genuine preflight -- nothing has
 * run yet when they fire). It is FALSE whenever an earlier pending file in
 * the SAME run already applied: Check C runs per-migration, inside the apply
 * loop, so an earlier file's body and its `_migrations` tracking row have
 * already committed in their own transaction by the time a LATER file trips
 * Check C. Reviewer-verified: a 3-file run tripping on the 3rd left two
 * `_migrations` rows written and a table grown, while this message told the
 * operator nothing had changed.
 *
 * Owner ruling (round 2): make the message honest rather than restructure
 * the apply loop into one giant transaction (rejected -- see the PR
 * description). Fixed here by (a) scoping the "rolled back, committed
 * nothing" claim to THIS migration's own transaction only, matching the
 * sibling checksum-mismatch error's existing convention in this same file
 * ("Any migration earlier than X in this same run has already been applied
 * and committed -- the database is now mid-sequence..."), and (b) per
 * explicit owner instruction, NAMING which migrations already committed in
 * this run, so the operator does not have to go check `_migrations` by hand
 * to know where they stand.
 *
 * Discoverability is still a design requirement (TDD §2.3), now amended:
 * must contain, in order, (1) the filename, (2) per-table
 * `table: N rows -> M rows (delta)`, (3) confirmation THIS migration's own
 * transaction was rolled back and committed nothing, PLUS -- if any earlier
 * migration in this run already committed -- the exact list of those
 * filenames and a statement that the database is mid-sequence, not
 * unchanged, (4) the literal opt-in env var and value to set, (5) a
 * plain-language warning not to set it if this loss was unexpected.
 *
 * NOTE: this amends the ticket's (#307) original mandated error-string
 * contract, which required the literal sentence "Nothing has been
 * committed. The transaction was rolled back; the database is unchanged."
 * unconditionally. That sentence's first half is right and its second half
 * is provably wrong for any non-first pending migration -- see the PR body
 * for the correction.
 */
export function formatDestructiveMigrationError(
  file: string,
  losses: RowLoss[],
  committedThisRun: string[] = [],
): string {
  const lines: string[] = [`Migration "${file}" would delete rows from an existing database:`, ""];

  for (const loss of losses) {
    const delta = loss.after - loss.before;
    lines.push(`  ${loss.table}: ${loss.before} rows -> ${loss.after} rows (${delta})`);
  }

  lines.push(
    "",
    `This migration's own transaction was rolled back; "${file}" itself committed nothing.`,
    committedThisRun.length > 0
      ? `However, earlier migrations already applied and committed in this same run: ` +
          `${committedThisRun.join(", ")}. The database is now mid-sequence, not left exactly as ` +
          `it was before this run started.`
      : `No earlier migration in this run committed anything before this one -- the database is ` +
          `unchanged.`,
    "",
    `If this migration is genuinely meant to delete this data, set ` +
      `ALLOW_DESTRUCTIVE_MIGRATIONS=${file} (or pass --allow-destructive=${file} for a local run) ` +
      `and re-run the migration.`,
    "",
    "If you did not expect this migration to delete data, do not set that variable -- this is " +
      "very likely a renamed or re-presented migration; see docs/RUNBOOK.md § Migrations.",
  );

  return lines.join("\n");
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
 *
 * Ticket #307 -- before any file is applied, runs Checks A and B (see
 * `assertNoOrderRegression` / `assertNoRenamedMigration` above) as a single
 * preflight pass over every currently-pending file, using `_migrations`
 * state read once, before the loop starts. Then, for each pending
 * migration, Check C snapshots row counts on the SAME transaction the body
 * runs in (before and after `tx.executeMultiple`) and aborts -- rolling
 * back via the existing catch block below, nothing new needed there -- if
 * rows were lost and the file is not in `allowlist`.
 */
export async function runMigrations(
  client: Client,
  migrationsDir: string,
  allowlist: Set<string> = new Set(),
): Promise<MigrationLogEntry[]> {
  await ensureMigrationsTable(client);

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const fileSet = new Set(files);

  const trackedBeforeRun = await client.execute("SELECT name, checksum FROM _migrations");
  const appliedRows = trackedBeforeRun.rows.map((row) => ({
    name: row.name as string,
    checksum: row.checksum as string | null,
  }));
  const appliedNames = appliedRows.map((row) => row.name);
  const appliedNameSet = new Set(appliedNames);

  const pendingFiles = files.filter((file) => !appliedNameSet.has(file));
  assertNoOrderRegression(pendingFiles, appliedNames);

  const pendingWithChecksum = pendingFiles.map((file) => ({
    file,
    checksum: computeChecksum(readFileSync(join(migrationsDir, file), "utf8")),
  }));
  assertNoRenamedMigration(pendingWithChecksum, appliedRows);

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
      // Ticket #307, Check C -- snapshot on `tx`, NOT `client`. A snapshot
      // on the client would read outside this transaction and miss the
      // migration body's uncommitted effect entirely.
      const before = await snapshotRowCounts(tx);
      await tx.executeMultiple(body);
      const after = await snapshotRowCounts(tx);
      const losses = diffRowCounts(before, after);

      if (losses.length > 0 && !allowlist.has(file)) {
        // Throwing here (rather than rolling back inline) reuses the
        // catch block below, which already rolls back, logs a rollback
        // failure without swallowing this error, and closes `tx` --
        // exactly the guarantee proven by the existing crash-mutation test.
        //
        // PR #309 review round 2, P2 -- pass the filenames of migrations
        // already `applied` earlier IN THIS RUN (not `unchanged`/
        // `adopted-legacy-checksum` entries, which committed nothing new
        // this run) so the abort message can honestly say which ones
        // already committed, instead of claiming the database is unchanged.
        const committedThisRun = log.filter((entry) => entry.action === "applied").map((entry) => entry.file);
        throw new Error(formatDestructiveMigrationError(file, losses, committedThisRun));
      }

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
  const allowlist = parseDestructiveAllowlist(process.env, process.argv);
  await runMigrations(db, join(process.cwd(), "migrations"), allowlist);
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
