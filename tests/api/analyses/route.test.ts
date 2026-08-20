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
  /** #266 — the fixed order key. Unset leaves the column default (`datetime('now')`). */
  updatedAt?: string | null;
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
        profile_id, schema_version${opts.updatedAt !== undefined ? ", updated_at" : ""}
      ) VALUES (?, 'p', 'https://instagram.com/reel/x', 'instagram', 'reel', ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${
        opts.updatedAt !== undefined ? ", ?" : ""
      })
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
      ...(opts.updatedAt !== undefined ? [opts.updatedAt] : []),
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

/** Structural D8 comparison helper (finding 3, PR #235 review) — drops `sampleSize` (the one deliberately live field) so every OTHER `tier2` field is compared without hand-listing them, and a future field is covered automatically. */
function omitSampleSize<T extends { sampleSize: unknown }>(tier2: T): Omit<T, "sampleSize"> {
  const clone: Partial<T> = { ...tier2 };
  delete clone.sampleSize;
  return clone as Omit<T, "sampleSize">;
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
      state: "MEASURED",
      reason: null,
      median: 6_000,
      sampleSize: 6,
      bucketKey: "instagram:reel:full_video",
      multiplier: 1.33,
      minSample: 5,
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
      state: "COLD_START",
      reason: null,
      median: null,
      sampleSize: 2,
      bucketKey: "instagram:reel:full_video",
      multiplier: null,
      minSample: 5,
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

  /**
   * Reviewer note (finding 6, PR #235 review — the twin of `readModel.test.ts`'s
   * own D8 note): this proves determinism-given-unchanged-input, not
   * freezing. This row has no `perfBucketKey`, so `tier2` is `null` and the
   * #206 live carve-out never engages for it at all — two reads over an
   * unchanged library return the same JSON whether or not the carve-out
   * exists or is correct. The test that actually exercises and pins the
   * carve-out's boundary is below, in the "#206: tier2.sampleSize is LIVE"
   * describe block, which writes a new comparator BETWEEN two reads.
   */
});

describe("GET /api/analyses — pagination and order (#266, 2026-08-20 owner ruling)", () => {
  it("orders by updated_at DESC (OR-8 superseded) and returns pagination metadata", async () => {
    const older = await insertAnalysis(db, {
      username: "a",
      postDate: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-01-01 00:00:00",
    });
    const newer = await insertAnalysis(db, {
      username: "b",
      postDate: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-06-01 00:00:00",
    });

    const response = await listRoute.GET(makeGetRequest());
    const body = await response.json();

    expect(body.analyses.map((a: { id: string }) => a.id)).toEqual([newer, older]);
    expect(body.pagination).toEqual({ page: 1, pageSize: 50, total: 2, totalPages: 1 });
  });

  it("an unknown sortBy is silently ignored — 200, not 400 (sortBy no longer exists as a param)", async () => {
    await insertAnalysis(db, { username: "a" });
    const response = await listRoute.GET(makeGetRequest("?sortBy=notARealField"));
    expect(response.status).toBe(200);
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
      username: "creator-primary_test_creator",
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
      username: "creator-primary_test_creator",
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
    // whole computed block minus the one live field. Structural (destructure
    // sampleSize off tier2, toEqual the remainder), not hand-listed, so a
    // future PerformanceTier2 field is covered automatically.
    const { tier2: firstTier2, ...firstComputedRest } = firstRow.performance.computed;
    const { tier2: secondTier2, ...secondComputedRest } = secondRow.performance.computed;
    expect(secondComputedRest).toEqual(firstComputedRest);
    expect(omitSampleSize(secondTier2)).toEqual(omitSampleSize(firstTier2));

    // And the rest of the row (outside `performance`) is untouched too.
    const omitPerformance = (row: Record<string, unknown>) => {
      const rest = { ...row };
      delete rest.performance;
      return rest;
    };
    expect(omitPerformance(secondRow)).toEqual(omitPerformance(firstRow));
  });

  /**
   * Reviewer note (finding 2, PR #235 review): this test does NOT pin
   * `buildTier2`'s own `isColdStart = row.perfMultiplier == null` gate.
   * The route independently gates on the exact same condition BEFORE ever
   * calling `buildComputedPerformanceBlock` (this file, the two
   * `analysis.perfMultiplier == null` checks around `liveColdStartSampleSize`
   * above) — a MEASURED row's `liveColdStartSampleSize` stays `null` and is
   * never injected in the first place, so this test would stay green even
   * if `readModel.ts`'s own gate were mutated to always report cold start
   * (confirmed by the reviewer's mutation run: only
   * `readModel.test.ts`'s "a MEASURED row's tier2.sampleSize ignores the
   * injected live value entirely" test went red, not this one). What this
   * test DOES prove: the route-level gate, independently, never triggers
   * the extra I/O or injection path for a MEASURED row — real double-gate
   * coverage, just not a single-point pin of `buildTier2`'s own carve-out
   * boundary. That single-point pin is `readModel.test.ts`'s dedicated test.
   */
  it("a MEASURED row's liveColdStartSampleSize is never computed or injected by the route (route-level gate only — see readModel.test.ts for the buildTier2-level pin)", async () => {
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

  /**
   * Reviewer note (round-2 review, finding 1, PR #235): the detail endpoint
   * (`app/api/analyses/[id]/route.ts`) duplicates this exact derivation,
   * including the self-exclusion subtraction, but had zero coverage of its
   * own — the list-route test above only exercises `listRoute.GET`. Mirror
   * of the test above, driven through `detailRoute.GET` instead, so both
   * routes are pinned equivalently.
   */
  it("mirror of the above through the detail endpoint: sampleSize increases after a new comparator is inserted between two reads", async () => {
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    const bucketKey = "instagram:reel:full_video";

    const observedId = await insertAnalysis(db, {
      username: "creator-detail-live",
      resultContent: { overallScore: 3, scorecard: {}, performance: { performanceScore: null, verdict: "", drivers: [] } },
      perfReachValue: 1_000,
      perfReachKind: "VIEWS",
      perfReachDerivedFrom: "TOP_LEVEL",
      perfBucketKey: bucketKey,
      perfBaselineMedian: null,
      perfBaselineSampleSize: 999,
      perfMultiplier: null,
      perfTierUsed: "REACH_ONLY",
      perfConfidence: "HIGH",
      perfPostAgeHours: 100,
      profileId,
      schemaVersion: SCHEMA_VERSION,
    });

    const firstBody = await (await detailRoute.GET(makeGetRequest(), makeDetailParams(observedId))).json();
    // Only comparator candidate in the pool is itself, which is
    // self-excluded — zero comparators exist yet.
    expect(firstBody.performance.computed.tier2.sampleSize).toBe(0);

    // Write a NEW qualifying analysis into the SAME pool, between the two reads.
    await insertAnalysis(db, {
      username: "creator-detail-live",
      perfReachValue: 2_000,
      perfBucketKey: bucketKey,
      perfPostAgeHours: 100,
      profileId,
      schemaVersion: SCHEMA_VERSION,
    });

    const secondBody = await (await detailRoute.GET(makeGetRequest(), makeDetailParams(observedId))).json();

    // The live field MOVED.
    expect(secondBody.performance.computed.tier2.sampleSize).toBe(1);
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

/**
 * Ticket #252 — end-to-end through the real route + DB, mirroring
 * production's primary-test-creator `instagram:reel:full_video` pool (8
 * rows, 7 resolving reach, each excludes itself -> 6 comparators, >=
 * BASELINE_MIN_SAMPLE (5)). Proves the whole wire —
 * `fetchLiveEligibleComparatorIds` -> route batching -> `buildTier2`'s
 * self-exclusion -> the response body — not just the pure function in
 * isolation (`readModel.test.ts` pins the arithmetic).
 *
 * Reach values are synthetic (anonymised, #264) but constructed to preserve
 * the same shape as the original production data: 7 pool entries, a self
 * value large enough to be the outlier, and the two middle values straddling
 * the median so self-exclusion is still a real, provable assertion.
 */
describe("GET /api/analyses — ticket #252: the live multiplier end to end", () => {
  it("a null-multiplier row whose live pool clears the threshold gets a real live multiplier, and no extra query beyond the existing D3 batch", async () => {
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    const bucketKey = "instagram:reel:full_video";

    // The observed row — 620000 reach, no stored baseline yet (cold start
    // at write time).
    const observedId = await insertAnalysis(db, {
      username: "creator-primary_test_creator",
      resultContent: { overallScore: 3, scorecard: {}, performance: { performanceScore: null, verdict: "", drivers: [] } },
      perfReachValue: 620_000,
      perfReachKind: "VIEWS",
      perfReachDerivedFrom: "TOP_LEVEL",
      perfBucketKey: bucketKey,
      perfBaselineMedian: null,
      perfBaselineSampleSize: 0,
      perfMultiplier: null,
      perfTierUsed: "REACH_ONLY",
      perfConfidence: "HIGH",
      perfPostAgeHours: 200,
      profileId,
      schemaVersion: SCHEMA_VERSION,
    });

    // 6 more comparators in the SAME pool.
    for (const reach of [4_100, 118_000, 7_100, 7_900, 52_000, 6_300]) {
      await insertAnalysis(db, {
        username: "creator-primary_test_creator",
        perfReachValue: reach,
        perfBucketKey: bucketKey,
        perfPostAgeHours: 200,
        profileId,
        schemaVersion: SCHEMA_VERSION,
      });
    }

    const executeSpy = vi.spyOn(db, "execute");
    const response = await listRoute.GET(makeGetRequest("?pageSize=10"));
    expect(response.status).toBe(200);
    const body = await response.json();

    const row = body.analyses.find((a: { id: string }) => a.id === observedId);
    expect(row).toBeDefined();
    expect(row.performance.computed.tier2.state).toBe("MEASURED");
    expect(row.performance.computed.tier2.reason).toBeNull();
    // median of the 6 OTHER reels (own reach excluded): 4100,6300,7100,7900,52000,118000 -> (7100+7900)/2 = 7500.
    expect(row.performance.computed.tier2.median).toBe(7_500);
    expect(row.performance.computed.tier2.sampleSize).toBe(6);
    // 620000 / 7500 = 82.666...
    expect(row.performance.computed.tier2.multiplier).toBeCloseTo(82.7, 1);

    // getAnalysesList (2: list + count) + getUniqueAccounts (1) + exactly
    // ONE batched live-comparator query for all 7 null-multiplier rows —
    // never one per row (D3, unaffected by #252 carrying values now).
    expect(executeSpy).toHaveBeenCalledTimes(4);
  });

  it("an own-metric-unresolved row below the live threshold routes to NOT_COMPARABLE with no live count leak (DESIGN-3C §4.3, the sample-size leak fix)", async () => {
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    const bucketKey = "instagram:reel:full_video";

    const observedId = await insertAnalysis(db, {
      username: "creator-unresolved",
      resultContent: { overallScore: 3, scorecard: {}, performance: { performanceScore: null, verdict: "", drivers: [] } },
      perfReachValue: null, // own metric never resolved
      perfBucketKey: bucketKey,
      perfBaselineMedian: null,
      perfBaselineSampleSize: 1, // frozen, write-time count
      perfMultiplier: null,
      perfTierUsed: "UNAVAILABLE",
      perfConfidence: "NONE",
      perfUnavailableReason: "REACH_HIDDEN",
      perfPostAgeHours: 200,
      profileId,
      schemaVersion: SCHEMA_VERSION,
    });

    // 3 more comparators in the same pool — below BASELINE_MIN_SAMPLE (5),
    // but state routing must not depend on that: own metric unresolved wins
    // regardless of pool size (DESIGN-3C §3 step 2).
    for (const reach of [1_000, 2_000, 3_000]) {
      await insertAnalysis(db, {
        username: "creator-unresolved",
        perfReachValue: reach,
        perfBucketKey: bucketKey,
        perfPostAgeHours: 200,
        profileId,
        schemaVersion: SCHEMA_VERSION,
      });
    }

    const response = await listRoute.GET(makeGetRequest("?pageSize=10"));
    const body = await response.json();
    const row = body.analyses.find((a: { id: string }) => a.id === observedId);

    expect(row.performance.computed.tier2.state).toBe("NOT_COMPARABLE");
    expect(row.performance.computed.tier2.reason).toBe("POST_METRIC_UNRESOLVED");
    expect(row.performance.computed.tier2.multiplier).toBeNull();
    // The live pool has 3 eligible comparators, but that number must NOT
    // leak onto this row — it stays the frozen write-time column.
    expect(row.performance.computed.tier2.sampleSize).toBe(1);
  });

  it("pool >= threshold and live median === 0 routes to NOT_COMPARABLE / MEDIAN_ZERO — never a fabricated 0x", async () => {
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    const bucketKey = "instagram:reel:full_video";

    const observedId = await insertAnalysis(db, {
      username: "creator-zero",
      resultContent: { overallScore: 3, scorecard: {}, performance: { performanceScore: null, verdict: "", drivers: [] } },
      perfReachValue: 500, // own metric resolved
      perfBucketKey: bucketKey,
      perfBaselineMedian: null,
      perfBaselineSampleSize: 0,
      perfMultiplier: null,
      perfTierUsed: "REACH_ONLY",
      perfConfidence: "HIGH",
      perfPostAgeHours: 200,
      profileId,
      schemaVersion: SCHEMA_VERSION,
    });

    // 5 more comparators, all reach 0 — pool clears BASELINE_MIN_SAMPLE (5)
    // but their median is exactly 0.
    for (const reach of [0, 0, 0, 0, 0]) {
      await insertAnalysis(db, {
        username: "creator-zero",
        perfReachValue: reach,
        perfBucketKey: bucketKey,
        perfPostAgeHours: 200,
        profileId,
        schemaVersion: SCHEMA_VERSION,
      });
    }

    const response = await listRoute.GET(makeGetRequest("?pageSize=10"));
    const body = await response.json();
    const row = body.analyses.find((a: { id: string }) => a.id === observedId);

    expect(row.performance.computed.tier2.state).toBe("NOT_COMPARABLE");
    expect(row.performance.computed.tier2.reason).toBe("MEDIAN_ZERO");
    expect(row.performance.computed.tier2.median).toBe(0);
    expect(row.performance.computed.tier2.multiplier).toBeNull();
    expect(row.performance.computed.tier2.sampleSize).toBe(5);
  });

  it("owner ruling (#263 review, Finding 1): a row that was MEDIAN_ZERO at write time (stored perf_baseline_median present, perf_multiplier NULL) acquires a live multiplier once its live pool's median becomes non-zero — it is NOT frozen at the stored median", async () => {
    const profileId = randomUUID();
    await insertProfile(db, profileId);
    const bucketKey = "instagram:reel:full_video";

    const observedId = await insertAnalysis(db, {
      username: "creator-was-median-zero",
      resultContent: { overallScore: 3, scorecard: {}, performance: { performanceScore: null, verdict: "", drivers: [] } },
      perfReachValue: 500, // own metric resolved
      perfBucketKey: bucketKey,
      perfBaselineMedian: 0, // MEDIAN_ZERO at write time
      perfBaselineSampleSize: 5,
      perfMultiplier: null,
      perfTierUsed: "REACH_ONLY",
      perfConfidence: "HIGH",
      perfPostAgeHours: 200,
      profileId,
      schemaVersion: SCHEMA_VERSION,
    });

    // The pool's live median is now non-zero — 6 comparators, median 100.
    for (const reach of [50, 80, 100, 100, 120, 150]) {
      await insertAnalysis(db, {
        username: "creator-was-median-zero",
        perfReachValue: reach,
        perfBucketKey: bucketKey,
        perfPostAgeHours: 200,
        profileId,
        schemaVersion: SCHEMA_VERSION,
      });
    }

    const response = await listRoute.GET(makeGetRequest("?pageSize=10"));
    const body = await response.json();
    const row = body.analyses.find((a: { id: string }) => a.id === observedId);

    // median of the 6 comparators: 50,80,100,100,120,150 -> (100+100)/2 = 100.
    expect(row.performance.computed.tier2.state).toBe("MEASURED");
    expect(row.performance.computed.tier2.reason).toBeNull();
    expect(row.performance.computed.tier2.median).toBe(100);
    expect(row.performance.computed.tier2.sampleSize).toBe(6);
    expect(row.performance.computed.tier2.multiplier).toBeCloseTo(5, 5); // 500 / 100
  });
});
