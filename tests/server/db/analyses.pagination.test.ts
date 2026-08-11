import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";

/**
 * Ticket #144 (TDD §9.6, OR-8, R-S1/AC-14) — `getAnalysesList()`'s
 * server-side pagination and sort. Same fresh-`:memory:`-libsql-per-test
 * technique as `tests/server/fingerprint/service.test.ts` /
 * `tests/api/profiles/fingerprint.route.test.ts`.
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
    perfReachValue?: number | null;
    performanceScore?: number | null;
    perfMultiplier?: number | null;
    perfTier1Ratio?: number | null;
    perfTier1Denominator?: "REACH" | "FOLLOWERS" | null;
    perfTierUsed?: string | null;
  },
): Promise<string> {
  const id = randomUUID();
  await db.execute({
    sql: `
      INSERT INTO analyses (
        id, prompt, url, platform, media_type, username, status,
        post_date, perf_reach_value, performance_score, perf_multiplier,
        perf_tier1_ratio, perf_tier1_denominator, perf_tier_used
      ) VALUES (?, 'p', 'https://instagram.com/reel/x', 'instagram', 'reel', ?, 'completed', ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      opts.username,
      opts.postDate ?? null,
      opts.perfReachValue ?? null,
      opts.performanceScore ?? null,
      opts.perfMultiplier ?? null,
      opts.perfTier1Ratio ?? null,
      opts.perfTier1Denominator ?? null,
      opts.perfTierUsed ?? null,
    ],
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
      ids.push(await insertAnalysis(db, { username: `creator-${i}`, postDate: `2026-01-${String((i % 27) + 1).padStart(2, "0")}` }));
    }

    const page1 = await dbModule.getAnalysesList({ page: 1, sortBy: "creator", sortDir: "asc" });
    const page2 = await dbModule.getAnalysesList({ page: 2, sortBy: "creator", sortDir: "asc" });

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

  it("ordering is stable across repeated reads of the same page (same sort key ties broken by id)", async () => {
    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, { username: "same-creator", perfReachValue: 100 });
    }

    const first = await dbModule.getAnalysesList({ page: 1, sortBy: "creator", sortDir: "asc" });
    const second = await dbModule.getAnalysesList({ page: 1, sortBy: "creator", sortDir: "asc" });

    expect(first.analyses.map((a: { id: string }) => a.id)).toEqual(
      second.analyses.map((a: { id: string }) => a.id),
    );
  });
});

describe("getAnalysesList — default sort (OR-8)", () => {
  it("defaults to posted descending — newest first — when no params given", async () => {
    const older = await insertAnalysis(db, { username: "a", postDate: "2026-01-01T00:00:00.000Z" });
    const newer = await insertAnalysis(db, { username: "b", postDate: "2026-06-01T00:00:00.000Z" });

    const result = await dbModule.getAnalysesList();

    expect(result.analyses.map((a: { id: string }) => a.id)).toEqual([newer, older]);
  });
});

describe("getAnalysesList — R-S1/AC-14: absent values sink to the bottom in BOTH directions", () => {
  it("performanceScore ASC: unscored rows sink to the bottom (never sort as if they were 0)", async () => {
    const scored1 = await insertAnalysis(db, { username: "a", performanceScore: 1 });
    const scored5 = await insertAnalysis(db, { username: "b", performanceScore: 5 });
    const unscored = await insertAnalysis(db, { username: "c", performanceScore: null });

    const result = await dbModule.getAnalysesList({ sortBy: "performanceScore", sortDir: "asc" });

    expect(result.analyses.map((a: { id: string }) => a.id)).toEqual([scored1, scored5, unscored]);
  });

  it("performanceScore DESC: unscored rows STILL sink to the bottom, not to the top", async () => {
    const scored1 = await insertAnalysis(db, { username: "a", performanceScore: 1 });
    const scored5 = await insertAnalysis(db, { username: "b", performanceScore: 5 });
    const unscored = await insertAnalysis(db, { username: "c", performanceScore: null });

    const result = await dbModule.getAnalysesList({ sortBy: "performanceScore", sortDir: "desc" });

    // If the unscored row were treated as 0, DESC would still put it last —
    // the real regression this guards is an unscored row sorting as if it
    // were the WORST real score, i.e. always dead last, in BOTH directions,
    // never appearing between two scored rows.
    expect(result.analyses.map((a: { id: string }) => a.id)).toEqual([scored5, scored1, unscored]);
  });

  it("reach ASC and DESC: rows with no reach figure sink to the bottom both times", async () => {
    const reachLow = await insertAnalysis(db, { username: "a", perfReachValue: 10 });
    const reachHigh = await insertAnalysis(db, { username: "b", perfReachValue: 1000 });
    const noReach = await insertAnalysis(db, { username: "c", perfReachValue: null });

    const asc = await dbModule.getAnalysesList({ sortBy: "reach", sortDir: "asc" });
    const desc = await dbModule.getAnalysesList({ sortBy: "reach", sortDir: "desc" });

    expect(asc.analyses.map((a: { id: string }) => a.id)).toEqual([reachLow, reachHigh, noReach]);
    expect(desc.analyses.map((a: { id: string }) => a.id)).toEqual([reachHigh, reachLow, noReach]);
  });

  it("engagementReach sort only orders REACH-denominated rows; a FOLLOWERS-denominated row sorts as absent, never a mismatched value", async () => {
    const reachRow = await insertAnalysis(db, {
      username: "a",
      perfTier1Ratio: 0.05,
      perfTier1Denominator: "REACH",
    });
    const followerRow = await insertAnalysis(db, {
      username: "b",
      perfTier1Ratio: 0.9,
      perfTier1Denominator: "FOLLOWERS",
    });

    const result = await dbModule.getAnalysesList({ sortBy: "engagementReach", sortDir: "desc" });

    // followerRow's ratio (0.9) is the larger raw number, but it is not a
    // REACH-denominated figure, so it must sink to the bottom of the
    // `engagementReach` sort rather than appearing first.
    expect(result.analyses.map((a: { id: string }) => a.id)).toEqual([reachRow, followerRow]);
  });
});
