import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import type { ReachResult } from "@/lib/server/analysis/performance/types";

/**
 * Ticket #143 — `computeBlock.ts`'s single entry point, `computePerformanceBlock()`.
 * Same real-sqlite-file pattern as `baseline.test.ts` (its own DB read lives
 * one layer below this).
 */

const SCHEMA_VERSION = 3;

async function runMigrations(client: Client): Promise<void> {
  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await client.executeMultiple(readFileSync(join(migrationsDir, file), "utf8"));
  }
}

async function insertProfile(client: Client, id: string, lastFetchedAt?: string): Promise<void> {
  await client.execute({
    sql: "INSERT INTO profiles (id, platform, username, last_fetched_at) VALUES (?, 'instagram', ?, ?)",
    args: [id, `creator-${id}`, lastFetchedAt ?? new Date().toISOString()],
  });
}

async function insertCompletedAnalysis(
  client: Client,
  profileId: string,
  bucketKey: string,
  reachValue: number,
): Promise<void> {
  await client.execute({
    sql: `
      INSERT INTO analyses (
        id, url, platform, media_type, profile_id, status, schema_version,
        perf_bucket_key, perf_post_age_hours, perf_reach_value, like_count, comment_count
      ) VALUES (?, 'https://instagram.com/reel/x', 'instagram', 'reel', ?, 'completed', ?, ?, 200, ?, 100, 10)
    `,
    args: [randomUUID(), profileId, SCHEMA_VERSION, bucketKey, reachValue],
  });
}

function reelReach(): ReachResult {
  return {
    value: 100_000,
    kind: "VIEWS",
    state: "AVAILABLE",
    derivedFrom: "TOP_LEVEL",
    laterSlideReach: { usable: false },
  };
}

function noReach(): ReachResult {
  return { value: null, kind: null, state: "UNKNOWN", derivedFrom: "NONE", laterSlideReach: { usable: false } };
}

let client: Client;
let dbPath: string;

beforeEach(async () => {
  vi.resetModules();
  dbPath = join(tmpdir(), `computeBlock-${randomUUID()}.db`);
  process.env.TURSO_DATABASE_URL = `file:${dbPath}`;
  delete process.env.TURSO_AUTH_TOKEN;
  const dbModule = await import("@/lib/server/db");
  client = dbModule.db;
  await runMigrations(client);
});

afterEach(() => {
  client?.close();
  vi.restoreAllMocks();
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = `${dbPath}${suffix}`;
    if (existsSync(file)) {
      rmSync(file);
    }
  }
});

describe("computePerformanceBlock — no profile resolved", () => {
  it("skips the baseline DB read entirely and returns COLD_START with sampleSize 0", async () => {
    const { computePerformanceBlock } = await import("@/lib/server/analysis/performance/computeBlock");

    const result = await computePerformanceBlock({
      platform: "instagram",
      mediaType: "reel",
      analysisMode: "full_video",
      reach: reelReach(),
      likeCount: 5_000,
      commentCount: 500,
      likeAndViewCountsDisabled: false,
      followerCount: null,
      audienceSourceFetchedAt: null,
      postDate: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(),
      profileId: null,
      analysisId: randomUUID(),
      schemaVersion: SCHEMA_VERSION,
    });

    expect(result.baseline).toEqual({
      state: "COLD_START",
      bucketKey: "instagram:reel:full_video",
      sampleSize: 0,
    });
    expect(result.tierUsed).toBe("REACH_ONLY");
    expect(result.basedOnVideos).toBe(0);
  });
});

describe("computePerformanceBlock — AC-1: brand-new creator, reel with reach", () => {
  it("tierUsed REACH_ONLY, performanceScore-ready ratio present, basedOnVideos 0", async () => {
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const { computePerformanceBlock } = await import("@/lib/server/analysis/performance/computeBlock");

    const result = await computePerformanceBlock({
      platform: "instagram",
      mediaType: "reel",
      analysisMode: "full_video",
      reach: reelReach(),
      likeCount: 5_000,
      commentCount: 500,
      likeAndViewCountsDisabled: false,
      followerCount: 20_000,
      audienceSourceFetchedAt: "2026-08-01T00:00:00.000Z",
      postDate: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(),
      profileId,
      analysisId: randomUUID(),
      schemaVersion: SCHEMA_VERSION,
    });

    expect(result.tierUsed).toBe("REACH_ONLY");
    expect(result.basedOnVideos).toBe(0);
    expect(result.tier1Ratio).toEqual({ denominator: "REACH", ratio: 5_500 / 100_000, reachKind: "VIEWS" });
    expect(result.unavailableReason).toBeNull();
    expect(result.audienceSourceFetchedAt).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("computePerformanceBlock — AC-2: Tier 2 activates at the threshold, per bucket", () => {
  it("tierUsed CREATOR_BASELINE once 5 prior same-bucket completed analyses exist", async () => {
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";
    for (let i = 0; i < 5; i += 1) {
      await insertCompletedAnalysis(client, profileId, bucketKey, 80_000 + i * 1_000);
    }

    const { computePerformanceBlock } = await import("@/lib/server/analysis/performance/computeBlock");
    const result = await computePerformanceBlock({
      platform: "instagram",
      mediaType: "reel",
      analysisMode: "full_video",
      reach: reelReach(),
      likeCount: 5_000,
      commentCount: 500,
      likeAndViewCountsDisabled: false,
      followerCount: 20_000,
      audienceSourceFetchedAt: null,
      postDate: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(),
      profileId,
      analysisId: randomUUID(),
      schemaVersion: SCHEMA_VERSION,
    });

    expect(result.tierUsed).toBe("CREATOR_BASELINE");
    expect(result.basedOnVideos).toBe(5);
    expect(result.baseline.state).toBe("MEASURED");
  });
});

describe("computePerformanceBlock — all-image carousel (§12.2)", () => {
  it("follower-denominated Tier 1, tierUsed REACH_ONLY, confidence capped MEDIUM, reason CACHED_FOLLOWER_DENOMINATOR", async () => {
    const { computePerformanceBlock } = await import("@/lib/server/analysis/performance/computeBlock");

    const result = await computePerformanceBlock({
      platform: "instagram",
      mediaType: "carousel",
      analysisMode: "images_only",
      reach: noReach(),
      likeCount: 32_313,
      commentCount: 13_840,
      likeAndViewCountsDisabled: undefined,
      followerCount: 500_000,
      audienceSourceFetchedAt: null,
      postDate: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(),
      profileId: null,
      analysisId: randomUUID(),
      schemaVersion: SCHEMA_VERSION,
    });

    expect(result.tier1Ratio).toEqual({ denominator: "FOLLOWERS", ratio: (32_313 + 13_840) / 500_000 });
    expect(result.tierUsed).toBe("REACH_ONLY");
    expect(result.confidence).toBe("MEDIUM");
    expect(result.confidenceReason).toBe("CACHED_FOLLOWER_DENOMINATOR");
    expect(result.unavailableReason).toBeNull();
  });

  it("no reach, no followers, no likes/comments -> UNAVAILABLE, CONTENT_KIND_UNSUPPORTED, never a blank reason", async () => {
    const { computePerformanceBlock } = await import("@/lib/server/analysis/performance/computeBlock");

    const result = await computePerformanceBlock({
      platform: "instagram",
      mediaType: "carousel",
      analysisMode: "images_only",
      reach: noReach(),
      likeCount: null,
      commentCount: null,
      likeAndViewCountsDisabled: false,
      followerCount: null,
      audienceSourceFetchedAt: null,
      postDate: null,
      profileId: null,
      analysisId: randomUUID(),
      schemaVersion: SCHEMA_VERSION,
    });

    expect(result.tierUsed).toBe("UNAVAILABLE");
    expect(result.unavailableReason).not.toBeNull();
    expect(result.unavailableReason).toBe("CONTENT_KIND_UNSUPPORTED");
  });
});

describe("computePerformanceBlock — AC-9/D8: byte-identical re-computation over the same stored inputs", () => {
  it("two calls with identical inputs against the same DB state produce a deep-equal computed block (computed block only, per OR-22)", async () => {
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";
    for (let i = 0; i < 5; i += 1) {
      await insertCompletedAnalysis(client, profileId, bucketKey, 80_000 + i * 1_000);
    }

    const { computePerformanceBlock } = await import("@/lib/server/analysis/performance/computeBlock");
    const input = {
      platform: "instagram" as const,
      mediaType: "reel" as const,
      analysisMode: "full_video" as const,
      reach: reelReach(),
      likeCount: 5_000,
      commentCount: 500,
      likeAndViewCountsDisabled: false,
      followerCount: 20_000,
      audienceSourceFetchedAt: "2026-08-01T00:00:00.000Z",
      postDate: "2026-07-20T00:00:00.000Z",
      profileId,
      analysisId: randomUUID(),
      schemaVersion: SCHEMA_VERSION,
      now: new Date("2026-08-05T00:00:00.000Z"),
    };

    const first = await computePerformanceBlock(input);
    const second = await computePerformanceBlock(input);

    expect(second).toEqual(first);
  });
});
