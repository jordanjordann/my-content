import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Client } from "@libsql/client";

import { db } from "../lib/server/db";

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
 * transform only: the `.sql` files on disk are never edited. That is the
 * deliberate choice over the ticket's other suggested direction (stripping
 * `BEGIN`/`COMMIT` from the files themselves) -- editing an already-applied
 * migration file collides directly with #278's checksum, which hashes
 * exactly what's on disk. Only strips when BOTH a leading `BEGIN
 * TRANSACTION;` and a trailing `COMMIT;` are present (some migrations, e.g.
 * 001 and 003, have no wrapper at all -- historically inconsistent, so this
 * is tolerant of both shapes). Never strips just one side: a lone `BEGIN`
 * with no matching `COMMIT` is left untouched and will fail loudly with
 * SQLite's own "cannot start a transaction within a transaction" error
 * rather than silently executing a half-wrapped file inside our transaction.
 */
export function stripOuterTransaction(sql: string): string {
  const beginPattern = /^\s*BEGIN\s+TRANSACTION\s*;/i;
  const commitPattern = /COMMIT\s*;\s*$/i;

  if (beginPattern.test(sql) && commitPattern.test(sql)) {
    return sql.replace(beginPattern, "").replace(commitPattern, "");
  }

  return sql;
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
    await client.execute("ALTER TABLE _migrations ADD COLUMN checksum TEXT");
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
 *     - stored checksum present and matches: skip, no log noise beyond the
 *       returned log entry.
 */
export async function runMigrations(client: Client, migrationsDir: string): Promise<MigrationLogEntry[]> {
  await ensureMigrationsTable(client);

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

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
            `is not supported. Revert the file, or write a new migration instead.`,
        );
      }

      log.push({ file, action: "unchanged" });
      continue;
    }

    const body = stripOuterTransaction(raw);

    const tx = await client.transaction("write");
    try {
      await tx.executeMultiple(body);
      await tx.execute({
        sql: "INSERT INTO _migrations (name, checksum) VALUES (?, ?)",
        args: [file, checksum],
      });
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.close();
    }

    console.log(`Applied ${file}`);
    log.push({ file, action: "applied" });
  }

  return log;
}

async function main() {
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
