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
  perfTierUsed?: string | null;
  perfConfidence?: string | null;
  perfUnavailableReason?: string | null;
  followerCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
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
        perf_confidence, perf_provisional, perf_unavailable_reason
      ) VALUES (?, 'p', 'https://instagram.com/reel/x', 'instagram', 'reel', ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      24,
      "2026-08-01T00:00:00.000Z",
      opts.perfTierUsed ?? null,
      opts.perfConfidence ?? null,
      0,
      opts.perfUnavailableReason ?? null,
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
