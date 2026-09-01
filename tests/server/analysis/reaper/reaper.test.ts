import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";

import { runMigrations } from "@/scripts/migrate";
import { reapStrandedAnalyses } from "@/lib/server/analysis/reaper/reaper";
import { STRANDED_PENDING_THRESHOLD_MINUTES } from "@/lib/server/analysis/reaper/constants";

/**
 * Ticket #313 / #280 — reaper for stranded `pending` analysis rows.
 * Executed against a real libsql `file:` DB in `/tmp`, migrated with the
 * real `migrations/` directory (not a hand-rolled schema), per the repo's
 * binding testing standard (TDD §6).
 */

let workDirs: string[] = [];

afterEach(() => {
  for (const dir of workDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  workDirs = [];
});

async function makeMigratedDb(): Promise<Client> {
  const dir = mkdtempSync(join(tmpdir(), "reaper-test-"));
  workDirs.push(dir);
  const db = createClient({ url: `file:${join(dir, "test.db")}` });
  await runMigrations(db, join(process.cwd(), "migrations"));
  return db;
}

// `createdAgeMinutes` and `updatedAgeMinutes` default to `ageMinutes` when
// omitted, so most callers can pass one uniform age. Tests that need to
// distinguish the two columns (e.g. a re-analysed row: ancient `created_at`,
// fresh `updated_at`) pass them independently.
async function seedAnalysis(
  db: Client,
  args: {
    id: string;
    status: "pending" | "completed" | "failed";
    ageMinutes?: number;
    createdAgeMinutes?: number;
    updatedAgeMinutes?: number;
  },
): Promise<void> {
  const createdAgeMinutes = args.createdAgeMinutes ?? args.ageMinutes;
  const updatedAgeMinutes = args.updatedAgeMinutes ?? args.ageMinutes;
  if (createdAgeMinutes === undefined || updatedAgeMinutes === undefined) {
    throw new Error("seedAnalysis: must supply ageMinutes, or both createdAgeMinutes and updatedAgeMinutes");
  }

  await db.execute({
    sql: `
      INSERT INTO analyses (id, status, url, platform, media_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))
    `,
    args: [
      args.id,
      args.status,
      "https://instagram.com/p/abc123",
      "instagram",
      "reel",
      `-${createdAgeMinutes} minutes`,
      `-${updatedAgeMinutes} minutes`,
    ],
  });
}

async function readRow(db: Client, id: string) {
  const result = await db.execute({
    sql: "SELECT status, created_at, updated_at FROM analyses WHERE id = ?",
    args: [id],
  });
  return result.rows[0] as unknown as { status: string; created_at: string; updated_at: string } | undefined;
}

describe("reapStrandedAnalyses", () => {
  it("marks a stranded pending row (older than the threshold) as failed", async () => {
    const db = await makeMigratedDb();
    await seedAnalysis(db, { id: "stranded-1", status: "pending", ageMinutes: 45 });

    const before = await readRow(db, "stranded-1");
    expect(before!.status).toEqual("pending");

    const result = await reapStrandedAnalyses(db);
    expect(result).toEqual({ reaped: 1 });

    const after = await readRow(db, "stranded-1");
    expect(after!.status).toEqual("failed");

    db.close();
  });

  // The dangerous half of the acceptance criteria: a reaper that kills
  // healthy in-flight work is worse than the bug it fixes.
  it("does NOT touch a legitimately in-flight pending row (younger than the threshold)", async () => {
    const db = await makeMigratedDb();
    await seedAnalysis(db, { id: "healthy-1", status: "pending", ageMinutes: 2 });

    const result = await reapStrandedAnalyses(db);
    expect(result).toEqual({ reaped: 0 });

    const after = await readRow(db, "healthy-1");
    expect(after!.status).toEqual("pending");

    db.close();
  });

  // MUTATION: if the reaper's guard dropped `status = 'pending'` (matching
  // on age alone), this would go red -- an old completed/failed row would
  // be "reaped" (rowsAffected > 0) even though it's already terminal.
  it("MUTATION: does not touch an old row that is already completed or failed", async () => {
    const db = await makeMigratedDb();
    await seedAnalysis(db, { id: "old-completed", status: "completed", ageMinutes: 90 });
    await seedAnalysis(db, { id: "old-failed", status: "failed", ageMinutes: 90 });

    const result = await reapStrandedAnalyses(db);
    expect(result).toEqual({ reaped: 0 });

    expect((await readRow(db, "old-completed"))!.status).toEqual("completed");
    expect((await readRow(db, "old-failed"))!.status).toEqual("failed");

    db.close();
  });

  // MUTATION: if the reaper ever issued a DELETE instead of an UPDATE
  // (forbidden by the owner ruling), the row would vanish entirely instead
  // of surviving as `failed`. Asserts the row is still present.
  it("MUTATION: never deletes -- a stranded row still exists after being reaped", async () => {
    const db = await makeMigratedDb();
    await seedAnalysis(db, { id: "stranded-2", status: "pending", ageMinutes: 60 });

    await reapStrandedAnalyses(db);

    const result = await db.execute({ sql: "SELECT COUNT(*) as n FROM analyses WHERE id = ?", args: ["stranded-2"] });
    expect(result.rows[0]!.n).toEqual(1);

    db.close();
  });

  // MUTATION: if the reaper's UPDATE ever set `updated_at = datetime('now')`,
  // this timestamp would change. The list sorts by `updated_at DESC`, so
  // touching it would shuffle reaped rows to the top and destroy the
  // forensic "when was this stranded" record.
  it("MUTATION: does not modify updated_at on the reaped row", async () => {
    const db = await makeMigratedDb();
    await seedAnalysis(db, { id: "stranded-3", status: "pending", ageMinutes: 45 });
    const before = await readRow(db, "stranded-3");

    await reapStrandedAnalyses(db);

    const after = await readRow(db, "stranded-3");
    expect(after!.updated_at).toEqual(before!.updated_at);

    db.close();
  });

  // Concurrency ordering (TDD §5.3): a completion write is `WHERE id = ?`
  // with no status predicate, so it must be able to overwrite a reaped
  // `failed` row back to `completed`. This proves the reaper's write does
  // not somehow block that -- the pipeline always wins.
  it("a late completion write after reaping overwrites failed back to completed (pipeline always wins)", async () => {
    const db = await makeMigratedDb();
    await seedAnalysis(db, { id: "late-complete", status: "pending", ageMinutes: 45 });

    await reapStrandedAnalyses(db);
    expect((await readRow(db, "late-complete"))!.status).toEqual("failed");

    // Simulate the pipeline's completion write: WHERE id = ? only.
    await db.execute({
      sql: "UPDATE analyses SET status = 'completed' WHERE id = ?",
      args: ["late-complete"],
    });

    expect((await readRow(db, "late-complete"))!.status).toEqual("completed");

    db.close();
  });

  // MUTATION: proves the reaper CANNOT demote a row the pipeline already
  // finished -- if the reaper's WHERE clause ever dropped its status guard,
  // a second sweep after completion would incorrectly flip it to failed.
  it("MUTATION: a second sweep after the row completes does not demote it back to failed", async () => {
    const db = await makeMigratedDb();
    await seedAnalysis(db, { id: "already-done", status: "pending", ageMinutes: 45 });
    await db.execute({
      sql: "UPDATE analyses SET status = 'completed' WHERE id = ?",
      args: ["already-done"],
    });

    const result = await reapStrandedAnalyses(db);
    expect(result).toEqual({ reaped: 0 });
    expect((await readRow(db, "already-done"))!.status).toEqual("completed");

    db.close();
  });

  it("is idempotent: a second sweep over the same already-reaped row matches nothing", async () => {
    const db = await makeMigratedDb();
    await seedAnalysis(db, { id: "stranded-4", status: "pending", ageMinutes: 45 });

    const first = await reapStrandedAnalyses(db);
    const second = await reapStrandedAnalyses(db);

    expect(first).toEqual({ reaped: 1 });
    expect(second).toEqual({ reaped: 0 });

    db.close();
  });

  it("reaps multiple stranded rows in a single sweep and returns the count", async () => {
    const db = await makeMigratedDb();
    await seedAnalysis(db, { id: "batch-1", status: "pending", ageMinutes: 40 });
    await seedAnalysis(db, { id: "batch-2", status: "pending", ageMinutes: 50 });
    await seedAnalysis(db, { id: "batch-3", status: "pending", ageMinutes: 5 });

    const result = await reapStrandedAnalyses(db);
    expect(result).toEqual({ reaped: 2 });

    expect((await readRow(db, "batch-1"))!.status).toEqual("failed");
    expect((await readRow(db, "batch-2"))!.status).toEqual("failed");
    expect((await readRow(db, "batch-3"))!.status).toEqual("pending");

    db.close();
  });

  // Pins the exported threshold constant so a future accidental change is a
  // one-line, reviewable diff and this suite documents the boundary.
  it("the threshold constant is exactly 30 minutes", () => {
    expect(STRANDED_PENDING_THRESHOLD_MINUTES).toEqual(30);
  });

  // MUTATION: this is the test that distinguishes `updated_at` from
  // `created_at`. `seedAnalysis` used to write the same age into both
  // columns, so a reaper mistakenly keyed on `created_at` still passed every
  // other test in this file. A row re-queued for re-analysis gets a fresh
  // `updated_at` but keeps its original (possibly ancient) `created_at`
  // (see lib/server/analysis/pipeline/index.ts:113) -- a `created_at`-keyed
  // reaper would incorrectly kill that healthy in-flight re-analysis.
  it("MUTATION: does NOT reap a row with an ancient created_at but a fresh updated_at (pins the reaper to updated_at)", async () => {
    const db = await makeMigratedDb();
    await seedAnalysis(db, {
      id: "re-analysed",
      status: "pending",
      createdAgeMinutes: 30 * 24 * 60, // 30 days old
      updatedAgeMinutes: 1, // 1 minute into a fresh re-analysis run
    });

    const result = await reapStrandedAnalyses(db);
    expect(result).toEqual({ reaped: 0 });

    const after = await readRow(db, "re-analysed");
    expect(after!.status).toEqual("pending");

    db.close();
  });

  // Pins the exact boundary: strictly `<` the threshold, not `<=`. 29
  // minutes stays pending; 31 minutes is failed.
  it("boundary: 29 minutes old stays pending, 31 minutes old is failed (strict <)", async () => {
    const db = await makeMigratedDb();
    await seedAnalysis(db, { id: "boundary-under", status: "pending", ageMinutes: 29 });
    await seedAnalysis(db, { id: "boundary-over", status: "pending", ageMinutes: 31 });

    await reapStrandedAnalyses(db);

    expect((await readRow(db, "boundary-under"))!.status).toEqual("pending");
    expect((await readRow(db, "boundary-over"))!.status).toEqual("failed");

    db.close();
  });
});
