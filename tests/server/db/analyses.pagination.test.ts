import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";

/**
 * Ticket #144 (TDD §9.6, OR-8) — `getAnalysesList()`'s server-side pagination. Same
 * fresh-`:memory:`-libsql-per-test technique as `tests/server/fingerprint/service.test.ts` /
 * `tests/api/profiles/fingerprint.route.test.ts`.
 *
 * #266 (2026-08-20 owner ruling, DESIGN-3C amendment A10) removed sorting entirely. The order is
 * now fixed at `updated_at DESC` with NO tiebreak — the owner considered `, a.id ASC` and
 * declined it. See `lib/server/db.ts`'s `getAnalysesList` for the required declined-tiebreak
 * comment. Every test below that asserted the OLD 8-field sort (R-S1/AC-14 sinks, the
 * `a.id ASC` tiebreaker, the runtime sort-column guard) is deleted, not re-pointed — those rules
 * bound a feature that no longer exists.
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

async function insertAnalysis(
  db: Client,
  opts: {
    username: string;
    postDate?: string | null;
    /**
     * #266 — the fixed order key. Left unset, every row takes the column default
     * `datetime('now')` and lands within the same second as every other row in the same test,
     * making an ordering assertion vacuous (it would pass regardless of the actual order).
     * Every test below that asserts an order sets this explicitly.
     */
    updatedAt?: string | null;
  },
): Promise<string> {
  const id = randomUUID();
  await db.execute({
    sql: `
      INSERT INTO analyses (
        id, prompt, url, platform, media_type, username, status,
        post_date${opts.updatedAt !== undefined ? ", updated_at" : ""}
      ) VALUES (?, 'p', 'https://instagram.com/reel/x', 'instagram', 'reel', ?, 'completed', ?${
        opts.updatedAt !== undefined ? ", ?" : ""
      })
    `,
    args:
      opts.updatedAt !== undefined
        ? [id, opts.username, opts.postDate ?? null, opts.updatedAt]
        : [id, opts.username, opts.postDate ?? null],
  });
  return id;
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
  vi.restoreAllMocks();
});

describe("getAnalysesList — pagination (50/page)", () => {
  it("returns a stable total count and 50 rows on page 1, remainder on page 2, no overlap/gaps", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 63; i++) {
      ids.push(
        await insertAnalysis(db, {
          username: `creator-${i}`,
          // Distinct updated_at per row (one second apart) so LIMIT/OFFSET is a total order
          // regardless of any tiebreak — the real-world case per #266 (production: 12 of 12
          // rows distinct today).
          updatedAt: `2026-01-01 00:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}`,
        }),
      );
    }

    const page1 = await dbModule.getAnalysesList({ page: 1 });
    const page2 = await dbModule.getAnalysesList({ page: 2 });

    expect(page1.pagination.total).toBe(63);
    expect(page2.pagination.total).toBe(63);
    expect(page1.analyses).toHaveLength(50);
    expect(page2.analyses).toHaveLength(13);

    const page1Ids = page1.analyses.map((a: { id: string }) => a.id);
    const page2Ids = page2.analyses.map((a: { id: string }) => a.id);
    const union = new Set([...page1Ids, ...page2Ids]);
    expect(union.size).toBe(63); // no duplicate, no dropped row across pages
    expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);
  });

  it("ordering is stable across repeated reads of the same page when updated_at values are distinct", async () => {
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, {
        username: "same-creator",
        updatedAt: `2026-01-01 00:00:0${i}`,
      });
    }

    const first = await dbModule.getAnalysesList({ page: 1 });
    const second = await dbModule.getAnalysesList({ page: 1 });

    expect(first.analyses.map((a: { id: string }) => a.id)).toEqual(
      second.analyses.map((a: { id: string }) => a.id),
    );
  });
});

describe("getAnalysesList — default and only order (#266, 2026-08-20 owner ruling)", () => {
  it("orders by updated_at DESC — most recently analysed first, regardless of post_date", async () => {
    const older = await insertAnalysis(db, {
      username: "a",
      // post_date is DELIBERATELY the inverse of updated_at here — proves the order key is
      // updated_at, not post_date (OR-8 is superseded).
      postDate: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-01-01 00:00:00",
    });
    const newer = await insertAnalysis(db, {
      username: "b",
      postDate: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-06-01 00:00:00",
    });

    const result = await dbModule.getAnalysesList();

    expect(result.analyses.map((a: { id: string }) => a.id)).toEqual([newer, older]);
  });

  it("a re-analysed row (updated_at bumped) moves to position 1 while its post_date is unchanged — the reason the key is updated_at, not created_at", async () => {
    const originallyNewer = await insertAnalysis(db, {
      username: "a",
      postDate: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-01-10 00:00:00",
    });
    const reanalysed = await insertAnalysis(db, {
      username: "b",
      postDate: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-05 00:00:00",
    });

    const before = await dbModule.getAnalysesList();
    expect(before.analyses.map((a: { id: string }) => a.id)).toEqual([originallyNewer, reanalysed]);

    // Simulate a re-analyze: bumps updated_at, leaves post_date untouched.
    await db.execute({
      sql: "UPDATE analyses SET updated_at = ? WHERE id = ?",
      args: ["2026-08-20 00:00:00", reanalysed],
    });

    const after = await dbModule.getAnalysesList();
    expect(after.analyses.map((a: { id: string }) => a.id)).toEqual([reanalysed, originallyNewer]);
  });
});
