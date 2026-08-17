import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";

/**
 * Route-level tests for `app/api/analyses/route.ts` and
 * `app/api/analyses/[id]/route.ts` (ticket #144). Same fresh-`:memory:`
 * libsql-per-test technique as `tests/api/profiles/fingerprint.route.test.ts`.
 * Covers the ticket's own verification list: `performance` shaped correctly
 * for a scored row, a cold-start row and an unavailable row; D8
 * byte-identical reads; pagination default sort.
 */

const { isAuthenticatedMock } = vi.hoisted(() => ({
  isAuthenticatedMock: vi.fn<() => Promise<boolean>>(),
}));

vi.mock("@/lib/server/auth", () => ({
  isAuthenticated: isAuthenticatedMock,
}));

async function runMigrations(db: Client): Promise<void> {
  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.executeMultiple(readFileSync(join(migrationsDir, file), "utf8"));
  }
}

interface InsertOpts {
  username: string;
  postDate?: string | null;
  resultContent?: object | null;
  perfReachValue?: number | null;
  perfReachKind?: string | null;
  perfReachDerivedFrom?: string | null;
  perfTier1Ratio?: number | null;
  perfTier1Denominator?: string | null;
  perfBucketKey?: string | null;
  perfBaselineMedian?: number | null;
  perfBaselineSampleSize?: number | null;
  perfMultiplier?: number | null;
  perfPostAgeHours?: number;
  perfTierUsed?: string | null;
  perfConfidence?: string | null;
  perfUnavailableReason?: string | null;
  followerCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  /** Ticket #206 — the live cold-start count's grouping key. Unset (null) means "no creator", exactly `computeBlock.ts`'s own COLD_START/sampleSize:0 short-circuit. */
  profileId?: string | null;
  schemaVersion?: number | null;
}

const SCHEMA_VERSION = 3;

async function insertProfile(db: Client, id: string): Promise<void> {
  await db.execute({
    sql: "INSERT INTO profiles (id, platform, username) VALUES (?, 'instagram', ?)",
    args: [id, `creator-${id}`],
  });
}

async function insertAnalysis(db: Client, opts: InsertOpts): Promise<string> {
  const id = randomUUID();
  await db.execute({
    sql: `
      INSERT INTO analyses (
        id, prompt, url, platform, media_type, username, status,
        post_date, result_content, follower_count, like_count, comment_count,
        perf_reach_value, perf_reach_kind, perf_reach_derived_from,
        perf_tier1_ratio, perf_tier1_denominator, perf_bucket_key,
        perf_baseline_median, perf_baseline_sample_size, perf_multiplier,
        perf_post_age_hours, audience_source_fetched_at, perf_tier_used,
        perf_confidence, perf_provisional, perf_unavailable_reason,
        profile_id, schema_version
      ) VALUES (?, 'p', 'https://instagram.com/reel/x', 'instagram', 'reel', ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      opts.username,
      opts.postDate ?? null,
      opts.resultContent === undefined ? null : opts.resultContent === null ? null : JSON.stringify(opts.resultContent),
      opts.followerCount ?? null,
      opts.likeCount ?? null,
      opts.commentCount ?? null,
      opts.perfReachValue ?? null,
      opts.perfReachKind ?? null,
      opts.perfReachDerivedFrom ?? null,
      opts.perfTier1Ratio ?? null,
      opts.perfTier1Denominator ?? null,
      opts.perfBucketKey ?? null,
      opts.perfBaselineMedian ?? null,
      opts.perfBaselineSampleSize ?? null,
      opts.perfMultiplier ?? null,
      opts.perfPostAgeHours ?? 24,
      "2026-08-01T00:00:00.000Z",
      opts.perfTierUsed ?? null,
      opts.perfConfidence ?? null,
      0,
      opts.perfUnavailableReason ?? null,
      opts.profileId ?? null,
      opts.schemaVersion ?? null,
    ],
  });
  return id;
}

function makeGetRequest(query = ""): Request {
  return new Request(`http://localhost/api/analyses${query}`, { method: "GET" });
}

function makeDetailParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

let db: Client;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let listRoute: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let detailRoute: any;

beforeEach(async () => {
  vi.resetModules();
  isAuthenticatedMock.mockReset();
  isAuthenticatedMock.mockResolvedValue(true);
  process.env.TURSO_DATABASE_URL = ":memory:";
  delete process.env.TURSO_AUTH_TOKEN;
  const dbModule = await import("@/lib/server/db");
  db = dbModule.db;
  await runMigrations(db);
  listRoute = await import("@/app/api/analyses/route");
  detailRoute = await import("@/app/api/analyses/[id]/route");
});

afterEach(() => {
  db?.close();
  vi.restoreAllMocks();
});

describe("GET /api/analyses — performance shape, the ticket's three verification states", () => {
  it("a scored row: performance.computed and performance.judgement are fully shaped", async () => {
    await insertAnalysis(db, {
      username: "creator-scored",
      resultContent: {
        overallScore: 4,
        scorecard: { hookStrength: 4 },
        performance: { performanceScore: 5, verdict: "Kuat sekali.", drivers: ["Hook kuat"] },
      },
      followerCount: 10_000,
      likeCount: 200,
      commentCount: 20,
      perfReachValue: 8_000,
      perfReachKind: "VIEWS",
      perfReachDerivedFrom: "TOP_LEVEL",
      perfTier1Ratio: 0.0275,
      perfTier1Denominator: "REACH",
      perfBucketKey: "instagram:reel:full_video",
      perfBaselineMedian: 6_000,
      perfBaselineSampleSize: 6,
      perfMultiplier: 1.33,
      perfTierUsed: "CREATOR_BASELINE",
      perfConfidence: "HIGH",
    });

    const response = await listRoute.GET(makeGetRequest());
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.analyses).toHaveLength(1);
    const row = body.analyses[0];
    expect(row.performance).not.toBeNull();
    expect(row.performance.computed.tierUsed).toBe("CREATOR_BASELINE");
    expect(row.performance.computed.tier1).toEqual({ denominator: "REACH", ratio: 0.0275, reachKind: "VIEWS" });
    expect(row.performance.computed.tier2).toEqual({
      median: 6_000,
      sampleSize: 6,
      bucketKey: "instagram:reel:full_video",
      multiplier: 1.33,
    });
    expect(row.performance.judgement).toEqual({
      performanceScore: 5,
      verdict: "Kuat sekali.",
      drivers: ["Hook kuat"],
    });
  });

  it("a cold-start row: tier2.median/multiplier are null, tierUsed is REACH_ONLY, tier1 can still exist", async () => {
    await insertAnalysis(db, {
      username: "creator-cold-start",
      resultContent: { overallScore: 3, scorecard: {}, performance: { performanceScore: null, verdict: "", drivers: [] } },
      followerCount: 5_000,
      perfReachValue: 3_000,
      perfReachKind: "VIEWS",
      perfReachDerivedFrom: "TOP_LEVEL",
      perfTier1Ratio: 0.01,
      perfTier1Denominator: "REACH",
      perfBucketKey: "instagram:reel:full_video",
      perfBaselineMedian: null,
      perfBaselineSampleSize: 2,
      perfMultiplier: null,
      perfTierUsed: "REACH_ONLY",
      perfConfidence: "HIGH",
    });

    const response = await listRoute.GET(makeGetRequest());
    const body = await response.json();
    const row = body.analyses[0];

    expect(row.performance.computed.tierUsed).toBe("REACH_ONLY");
    expect(row.performance.computed.tier2).toEqual({
      median: null,
      sampleSize: 2,
      bucketKey: "instagram:reel:full_video",
      multiplier: null,
    });
    expect(row.performance.computed.tier1).not.toBeNull();
  });

  it("an unavailable row: no score, tierUsed UNAVAILABLE, a labelled reason — never a fabricated 0", async () => {
    await insertAnalysis(db, {
      username: "creator-unavailable",
      resultContent: { overallScore: 2, scorecard: {}, performance: { performanceScore: null, verdict: "", drivers: [] } },
      perfReachValue: null,
      perfReachDerivedFrom: "NONE",
      perfTierUsed: "UNAVAILABLE",
      perfConfidence: "NONE",
      perfUnavailableReason: "REACH_HIDDEN",
    });

    const response = await listRoute.GET(makeGetRequest());
    const body = await response.json();
    const row = body.analyses[0];

    expect(row.performance.computed.tierUsed).toBe("UNAVAILABLE");
    expect(row.performance.computed.unavailableReason).toBe("REACH_HIDDEN");
    expect(row.performance.judgement.performanceScore).toBeNull();
    expect(row.performance.computed.tier1).toBeNull();
  });

  it("B3: a row whose result_content carries no `performance` block gets judgement.verdict null, never a fabricated empty string", async () => {
    await insertAnalysis(db, {
      username: "creator-no-judgement-block",
      // No `performance` key at all — distinct from the above test's `verdict: ""`,
      // which is a real (if empty) model output. This is the "block never existed" case.
      resultContent: { overallScore: 2, scorecard: {} },
      perfReachValue: null,
      perfReachDerivedFrom: "NONE",
      perfTierUsed: "UNAVAILABLE",
      perfConfidence: "NONE",
      perfUnavailableReason: "REACH_HIDDEN",
    });

    const response = await listRoute.GET(makeGetRequest());
    const body = await response.json();
    const row = body.analyses[0];

    expect(row.performance.judgement).toEqual({ performanceScore: null, verdict: null, drivers: [] });
    expect(row.performance.judgement.verdict).not.toBe("");
  });
});

describe("GET /api/analyses — D8, byte-identical across two reads", () => {
  it("two consecutive GETs of the same unchanged data return byte-identical JSON", async () => {
    await insertAnalysis(db, {
      username: "creator-a",
      resultContent: { overallScore: 4, scorecard: {}, performance: { performanceScore: 4, verdict: "x", drivers: [] } },
      followerCount: 1_000,
      perfReachValue: 500,
      perfReachKind: "VIEWS",
      perfReachDerivedFrom: "TOP_LEVEL",
      perfTierUsed: "AUDIENCE_FALLBACK",
      perfConfidence: "MEDIUM",
    });

    const first = await (await listRoute.GET(makeGetRequest())).text();
    const second = await (await listRoute.GET(makeGetRequest())).text();

    expect(first).toBe(second);
  });
});

describe("GET /api/analyses — pagination and sorting", () => {
  it("defaults to Posted descending (OR-8) and returns pagination metadata", async () => {
    const older = await insertAnalysis(db, { username: "a", postDate: "2026-01-01T00:00:00.000Z" });
    const newer = await insertAnalysis(db, { username: "b", postDate: "2026-06-01T00:00:00.000Z" });

    const response = await listRoute.GET(makeGetRequest());
    const body = await response.json();

    expect(body.analyses.map((a: { id: string }) => a.id)).toEqual([newer, older]);
    expect(body.pagination).toEqual({ page: 1, pageSize: 50, total: 2, totalPages: 1 });
  });

  it("rejects an unknown sortBy with 400, not a silent fallback", async () => {
    const response = await listRoute.GET(makeGetRequest("?sortBy=notARealField"));
    expect(response.status).toBe(400);
  });

  it("rejects a non-integer page with 400", async () => {
    const response = await listRoute.GET(makeGetRequest("?page=abc"));
    expect(response.status).toBe(400);
  });
});

describe("GET /api/analyses/[id] — performance shape matches the list endpoint's derivation", () => {
  it("returns the same computed shape for a scored row as the list endpoint", async () => {
    const id = await insertAnalysis(db, {
      username: "creator-detail",
      resultContent: {
        overallScore: 4,
        scorecard: {},
        performance: { performanceScore: 5, verdict: "Bagus.", drivers: ["A"] },
      },
      followerCount: 10_000,
      perfReachValue: 8_000,
      perfReachKind: "VIEWS",
      perfReachDerivedFrom: "TOP_LEVEL",
      perfTier1Ratio: 0.02,
      perfTier1Denominator: "REACH",
      perfBucketKey: "instagram:reel:full_video",
      perfTierUsed: "REACH_ONLY",
      perfConfidence: "HIGH",
    });

    const response = await detailRoute.GET(makeGetRequest(), makeDetailParams(id));
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.performance.computed.tierUsed).toBe("REACH_ONLY");
    expect(body.performance.judgement).toEqual({ performanceScore: 5, verdict: "Bagus.", drivers: ["A"] });
  });

  it("401 when unauthenticated", async () => {
    isAuthenticatedMock.mockResolvedValue(false);
    const response = await detailRoute.GET(makeGetRequest(), makeDetailParams(randomUUID()));
    expect(response.status).toBe(401);
  });
});

/**
 * Ticket #206 — the reviewer's required addition (issue #206 comment,
 * raised on the #232 review). Neither existing D8 assertion above actually
 * exercises the cold-start live count: `readModel.test.ts:141` calls the
 * pure function twice with no injected value at all, and the `route.test.ts:251`
 * D8 test's row has no `perfBucketKey` (tier2 is `null`), so it never
 * touches the carve-out either. Both are determinism-given-unchanged-input
 * tests, not freezing tests — a live count read twice with nothing written
 * in between returns the same number regardless of whether it's frozen or
 * live, so neither would go red if the carve-out were silently widened or
 * even reverted to a no-op. THIS test is the one that actually pins the
 * boundary: it writes a NEW qualifying analysis BETWEEN two reads and
 * requires `tier2.sampleSize` to move while everything else about the
 * observed row stays byte-identical.
 */
describe("GET /api/analyses — #206: tier2.sampleSize is LIVE (moves when the library changes), everything else stays frozen", () => {
  it("a cold-start row's sampleSize increases after a new comparator is inserted between two reads; every other field is byte-identical", async () => {
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    const bucketKey = "instagram:reel:full_video";

    const observedId = await insertAnalysis(db, {
      username: "creator-giorrando",
      resultContent: { overallScore: 3, scorecard: {}, performance: { performanceScore: null, verdict: "", drivers: [] } },
      perfReachValue: 1_000,
      perfReachKind: "VIEWS",
      perfReachDerivedFrom: "TOP_LEVEL",
      perfBucketKey: bucketKey,
      perfBaselineMedian: null,
      // Deliberately stale/wrong stored value — proves the response does
      // NOT fall back to this once a live count is computable.
      perfBaselineSampleSize: 999,
      perfMultiplier: null,
      perfTierUsed: "REACH_ONLY",
      perfConfidence: "HIGH",
      perfPostAgeHours: 100,
      profileId,
      schemaVersion: SCHEMA_VERSION,
    });

    const firstBody = await (await listRoute.GET(makeGetRequest())).json();
    const firstRow = firstBody.analyses.find((a: { id: string }) => a.id === observedId);
    expect(firstRow).toBeDefined();
    // Only comparator candidate in the pool is itself, which is
    // self-excluded — zero comparators exist yet.
    expect(firstRow.performance.computed.tier2.sampleSize).toBe(0);

    // Write a NEW qualifying analysis into the SAME pool, between the two reads.
    await insertAnalysis(db, {
      username: "creator-giorrando",
      perfReachValue: 2_000,
      perfBucketKey: bucketKey,
      perfPostAgeHours: 100,
      profileId,
      schemaVersion: SCHEMA_VERSION,
    });

    const secondBody = await (await listRoute.GET(makeGetRequest())).json();
    const secondRow = secondBody.analyses.find((a: { id: string }) => a.id === observedId);
    expect(secondRow).toBeDefined();

    // The live field MOVED.
    expect(secondRow.performance.computed.tier2.sampleSize).toBe(1);
    expect(secondRow.performance.computed.tier2.sampleSize).not.toBe(firstRow.performance.computed.tier2.sampleSize);

    // Every OTHER field of the observed row's `performance.computed` is
    // byte-identical — the freeze still holds everywhere else. Compare the
    // whole computed block minus the one live field.
    const { tier2: firstTier2, ...firstComputedRest } = firstRow.performance.computed;
    const { tier2: secondTier2, ...secondComputedRest } = secondRow.performance.computed;
    expect(secondComputedRest).toEqual(firstComputedRest);
    expect(secondTier2.median).toBe(firstTier2.median);
    expect(secondTier2.bucketKey).toBe(firstTier2.bucketKey);
    expect(secondTier2.multiplier).toBe(firstTier2.multiplier);

    // And the rest of the row (outside `performance`) is untouched too.
    const omitPerformance = (row: Record<string, unknown>) => {
      const rest = { ...row };
      delete rest.performance;
      return rest;
    };
    expect(omitPerformance(secondRow)).toEqual(omitPerformance(firstRow));
  });

  it("a MEASURED row's tier2.sampleSize does NOT move even when a new comparator is inserted — the freeze still holds", async () => {
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    const bucketKey = "instagram:reel:full_video";

    const observedId = await insertAnalysis(db, {
      username: "creator-measured",
      resultContent: { overallScore: 4, scorecard: {}, performance: { performanceScore: 4, verdict: "x", drivers: [] } },
      perfReachValue: 3_000,
      perfReachKind: "VIEWS",
      perfReachDerivedFrom: "TOP_LEVEL",
      perfBucketKey: bucketKey,
      perfBaselineMedian: 2_000,
      perfBaselineSampleSize: 6,
      perfMultiplier: 1.5,
      perfTierUsed: "CREATOR_BASELINE",
      perfConfidence: "HIGH",
      perfPostAgeHours: 100,
      profileId,
      schemaVersion: SCHEMA_VERSION,
    });

    const firstBody = await (await listRoute.GET(makeGetRequest())).json();
    const firstRow = firstBody.analyses.find((a: { id: string }) => a.id === observedId);

    await insertAnalysis(db, {
      username: "creator-measured",
      perfReachValue: 9_000,
      perfBucketKey: bucketKey,
      perfPostAgeHours: 100,
      profileId,
      schemaVersion: SCHEMA_VERSION,
    });

    const secondBody = await (await listRoute.GET(makeGetRequest())).json();
    const secondRow = secondBody.analyses.find((a: { id: string }) => a.id === observedId);

    expect(secondRow.performance.computed.tier2).toEqual(firstRow.performance.computed.tier2);
    expect(secondRow.performance.computed.tier2.sampleSize).toBe(6);
  });
});

describe("GET /api/analyses — D3: one grouped query per page, never per row", () => {
  it("N cold-start rows sharing the same pool issue exactly one extra query, not N", async () => {
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    const bucketKey = "instagram:reel:full_video";

    for (let i = 0; i < 5; i++) {
      await insertAnalysis(db, {
        username: `creator-${i}`,
        perfReachValue: 1_000 * (i + 1),
        perfBucketKey: bucketKey,
        perfBaselineSampleSize: 0,
        perfMultiplier: null,
        perfTierUsed: "REACH_ONLY",
        perfConfidence: "HIGH",
        perfPostAgeHours: 100,
        profileId,
        schemaVersion: SCHEMA_VERSION,
      });
    }

    const executeSpy = vi.spyOn(db, "execute");
    const response = await listRoute.GET(makeGetRequest());
    expect(response.status).toBe(200);

    // getAnalysesList issues 2 (list + count) and getUniqueAccounts issues
    // 1 more — 3 baseline queries; the live cold-start count batches all 5
    // rows' shared pool into exactly 1 additional query, never 5.
    expect(executeSpy).toHaveBeenCalledTimes(4);
  });

  it("a page with zero cold-start rows skips the extra query entirely (D3's second guard)", async () => {
    await insertAnalysis(db, {
      username: "creator-plain",
      resultContent: { overallScore: 3, scorecard: {} },
    });

    const executeSpy = vi.spyOn(db, "execute");
    const response = await listRoute.GET(makeGetRequest());
    expect(response.status).toBe(200);

    expect(executeSpy).toHaveBeenCalledTimes(3);
  });
});
