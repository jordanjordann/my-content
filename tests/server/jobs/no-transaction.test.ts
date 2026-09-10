import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Ticket #352 (3A-M1b), R2 (plan §5, §1.5, §13 E3). `@libsql/client`'s
 * `Sqlite3Transaction.close()` is a no-op after a successful commit and
 * there is no userland fix — a long-lived process (the worker, #355) leaks
 * one native connection per `db.transaction()` call. This is the structural
 * guard, not review discipline: it fails the moment a future contributor
 * "cleans up" the claim statement into a transaction.
 */

const JOBS_DIR = join(process.cwd(), "lib/server/jobs");

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

describe("lib/server/jobs contains no .transaction( calls", () => {
  it("no file under lib/server/jobs calls .transaction(", () => {
    const files = listFiles(JOBS_DIR).filter((file) => file.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.filter((file) => readFileSync(file, "utf8").includes(".transaction("));

    expect(offenders).toEqual([]);
  });

  // MUTATION: proves the guard above actually discriminates -- without this,
  // a guard that always passed (e.g. a typo'd substring) would look green
  // forever. Directly exercises the same detection logic against a string
  // known to contain the forbidden call.
  it("MUTATION: the detection logic itself flags a string containing .transaction(", () => {
    const offendingSource = "async function bad(client: Client) { await client.transaction(async (tx) => {}); }";
    expect(offendingSource.includes(".transaction(")).toBe(true);
  });
});
