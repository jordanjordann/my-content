import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";

/**
 * Ticket #312 (#281 audit finding), R1 fix (PR #315 review round 2).
 *
 * `tests/api/analyze/existingId.test.ts` mocks `@/lib/server/db` entirely, so
 * it only proves the ROUTE's reaction to a boolean — it never executes the
 * real `analysisExists`. A reviewer mutation that rewrote the function body
 * to always `return true` (ignoring its argument) left that suite green,
 * which would silently reinstate the exact bug #312 exists to fix (every
 * `existingId` "exists", no 404, phantom re-analysis runs the full paid
 * pipeline).
 *
 * This file executes the REAL `analysisExists` against a real `:memory:`
 * libsql DB (same `runMigrations` + `vi.resetModules` technique as
 * `tests/api/analyses/delete.test.ts`), so the money guarantee itself is
 * under test, not just the route's plumbing.
 */

async function runMigrations(db: Client): Promise<void> {
  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.executeMultiple(readFileSync(join(migrationsDir, file), "utf8"));
  }
}

let db: Client;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbModule: any;

beforeEach(async () => {
  vi.resetModules();
  process.env.TURSO_DATABASE_URL = ":memory:";
  delete process.env.TURSO_AUTH_TOKEN;
  dbModule = await import("@/lib/server/db");
  db = dbModule.db;
  await runMigrations(db);
});

afterEach(() => {
  db?.close();
});

async function insertAnalysis(id: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO analyses (id, prompt, url, platform, media_type, status)
          VALUES (?, 'p', 'https://instagram.com/reel/x', 'instagram', 'reel', 'completed')`,
    args: [id],
  });
}

describe("analysisExists (#312/#281, real DB)", () => {
  it("returns false for a phantom id that was never inserted", async () => {
    const result = await dbModule.analysisExists(randomUUID());
    expect(result).toBe(false);
  });

  it("returns true for a row that actually exists", async () => {
    const id = randomUUID();
    await insertAnalysis(id);

    const result = await dbModule.analysisExists(id);
    expect(result).toBe(true);
  });

  it("does not match on a different id even when the table is non-empty", async () => {
    const realId = randomUUID();
    await insertAnalysis(realId);

    const result = await dbModule.analysisExists(randomUUID());
    expect(result).toBe(false);
  });
});
