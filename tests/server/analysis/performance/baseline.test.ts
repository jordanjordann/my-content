import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";

/**
 * Ticket #141 (TDD §6). Same per-test temp-file DB setup as
 * `tests/server/fingerprint/overrides.test.ts` — `db.execute()` is a
 * single statement (no `transaction()`), so a real file isn't strictly
 * required by the libsql driver leak (dispatch hazard note), but it keeps
 * this suite consistent with the house pattern and lets multiple `it()`
 * blocks share nothing by accident.
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

async function insertProfile(client: Client, id: string): Promise<void> {
  await client.execute({
    sql: "INSERT INTO profiles (id, platform, username) VALUES (?, 'instagram', ?)",
    args: [id, `creator-${id}`],
  });
}

interface SeedAnalysis {
  profileId: string;
  bucketKey: string;
  status?: string;
  schemaVersion?: number;
  postAgeHours?: number;
  reachValue?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
}

async function insertAnalysis(client: Client, opts: SeedAnalysis): Promise<string> {
  const id = randomUUID();
  await client.execute({
    sql: `
      INSERT INTO analyses (
        id, url, platform, media_type, profile_id, status, schema_version,
        perf_bucket_key, perf_post_age_hours, perf_reach_value, like_count, comment_count
      ) VALUES (?, 'https://instagram.com/reel/x', 'instagram', 'reel', ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      opts.profileId,
      opts.status ?? "completed",
      opts.schemaVersion ?? SCHEMA_VERSION,
      opts.bucketKey,
      opts.postAgeHours ?? 200,
      opts.reachValue ?? null,
      opts.likeCount ?? null,
      opts.commentCount ?? null,
    ],
  });
  return id;
}

let client: Client;
let dbPath: string;

beforeEach(async () => {
  vi.resetModules();
  dbPath = join(tmpdir(), `baseline-${randomUUID()}.db`);
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

describe("computeBucketKey — (platform, content kind) per D4", () => {
  it("joins platform, media type and analysis mode", async () => {
    const { computeBucketKey } = await import("@/lib/server/analysis/performance/baseline");

    expect(computeBucketKey("instagram", "carousel", "images_only")).toBe(
      "instagram:carousel:images_only",
    );
    expect(computeBucketKey("instagram", "carousel", "full_video")).toBe(
      "instagram:carousel:full_video",
    );
    expect(computeBucketKey("youtube", "short", "full_video")).toBe("youtube:short:full_video");
  });
});

describe("bucketNoun — OR-9", () => {
  it("returns the right noun for every known bucket, and the generic fallback for an unknown one", async () => {
    const { bucketNoun } = await import("@/lib/server/analysis/performance/baseline");

    expect(bucketNoun("instagram:reel:full_video")).toBe("reels");
    expect(bucketNoun("instagram:carousel:full_video")).toBe("carousels");
    expect(bucketNoun("instagram:carousel:images_only")).toBe("carousels");
    expect(bucketNoun("youtube:short:full_video")).toBe("Shorts");
    expect(bucketNoun("instagram:post:full_video")).toBe("videos");
    expect(bucketNoun("instagram:post:images_only")).toBe("posts");
    expect(bucketNoun("instagram:post:metadata_only")).toBe("posts");
    expect(bucketNoun("not-a-real-bucket-key")).toBe("posts");
    expect(bucketNoun("")).toBe("posts");
  });
});

describe("computeBaseline — AC-1/AC-2 threshold behaviour", () => {
  it("AC-1: zero prior analyses is sample size 0, no multiplier", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const excludeId = randomUUID();

    const result = await computeBaseline({
      profileId,
      bucketKey: "instagram:reel:full_video",
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: excludeId,
      minPostAgeHours: 72,
      currentPost: { reachValue: 10_000, likeCount: 500, commentCount: 20 },
    });

    expect(result).toEqual({
      bucketKey: "instagram:reel:full_video",
      sampleSize: 0,
      median: null,
      multiplier: null,
    });
  });

  it("AC-2: at exactly BASELINE_MIN_SAMPLE - 1 prior analyses, still cold start", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";

    for (let i = 0; i < BASELINE_MIN_SAMPLE - 1; i++) {
      await insertAnalysis(client, { profileId, bucketKey, reachValue: 1_000 * (i + 1) });
    }

    const result = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: 5_000, likeCount: null, commentCount: null },
    });

    expect(result.sampleSize).toBe(BASELINE_MIN_SAMPLE - 1);
    expect(result.median).toBeNull();
    expect(result.multiplier).toBeNull();
  });

  it("AC-2: at exactly BASELINE_MIN_SAMPLE prior analyses, the multiplier activates", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";

    // Reach values 1000..5000 -> median 3000.
    for (let i = 0; i < BASELINE_MIN_SAMPLE; i++) {
      await insertAnalysis(client, { profileId, bucketKey, reachValue: 1_000 * (i + 1) });
    }

    const result = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: 9_000, likeCount: null, commentCount: null },
    });

    expect(result.sampleSize).toBe(BASELINE_MIN_SAMPLE);
    expect(result.median).toBe(3_000);
    expect(result.multiplier).toBe(3); // 9000 / 3000
  });
});

describe("computeBaseline — median, in JS", () => {
  it("computes the median of an odd-sized reach set", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";
    const values = [10, 500, 20, 8, 300];
    expect(values.length).toBeGreaterThanOrEqual(BASELINE_MIN_SAMPLE);
    for (const value of values) {
      await insertAnalysis(client, { profileId, bucketKey, reachValue: value });
    }

    const result = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: 20, likeCount: null, commentCount: null },
    });

    // Sorted: 8, 10, 20, 300, 500 -> median 20.
    expect(result.median).toBe(20);
  });
});

describe("computeBaseline — AC-23: engagement-count baseline for a no-reach bucket", () => {
  it("computes the multiplier from likes+comments, with no reach value involved", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:carousel:images_only";

    // likes+comments totals: 100, 200, 300, 400, 500 -> median 300.
    for (let i = 0; i < BASELINE_MIN_SAMPLE; i++) {
      await insertAnalysis(client, {
        profileId,
        bucketKey,
        reachValue: null,
        likeCount: 50 * (i + 1),
        commentCount: 50 * (i + 1),
      });
    }

    const result = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: null, likeCount: 300, commentCount: 300 },
    });

    expect(result.sampleSize).toBe(BASELINE_MIN_SAMPLE);
    expect(result.median).toBe(300);
    expect(result.multiplier).toBe(2); // 600 / 300
  });
});

describe("computeBaseline — R-4.3.2/R-12.3.2: a mixed-denominator set throws, not averages", () => {
  it("throws when the candidate set mixes reach-based and engagement-count-based rows", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:carousel:full_video";

    for (let i = 0; i < BASELINE_MIN_SAMPLE - 1; i++) {
      await insertAnalysis(client, { profileId, bucketKey, reachValue: 1_000 });
    }
    // One deliberately mismatched row — no reach, only likes/comments.
    await insertAnalysis(client, {
      profileId,
      bucketKey,
      reachValue: null,
      likeCount: 10,
      commentCount: 5,
    });

    await expect(
      computeBaseline({
        profileId,
        bucketKey,
        schemaVersion: SCHEMA_VERSION,
        excludeAnalysisId: randomUUID(),
        minPostAgeHours: 72,
        currentPost: { reachValue: 1_000, likeCount: null, commentCount: null },
      }),
    ).rejects.toThrow(/Mixed-denominator/);
  });

  it("throws when the current post's own denominator disagrees with an otherwise-homogeneous candidate set", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";

    for (let i = 0; i < BASELINE_MIN_SAMPLE; i++) {
      await insertAnalysis(client, { profileId, bucketKey, reachValue: 1_000 });
    }

    await expect(
      computeBaseline({
        profileId,
        bucketKey,
        schemaVersion: SCHEMA_VERSION,
        excludeAnalysisId: randomUUID(),
        minPostAgeHours: 72,
        currentPost: { reachValue: null, likeCount: 10, commentCount: 5 },
      }),
    ).rejects.toThrow(/Mixed-denominator/);
  });
});

describe("computeBaseline — no cross-bucket substitution (AC-23/AC-24)", () => {
  it("a reel never draws its baseline from a carousel bucket", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);

    // 20 reels in a different bucket, well above threshold.
    for (let i = 0; i < 20; i++) {
      await insertAnalysis(client, {
        profileId,
        bucketKey: "instagram:reel:full_video",
        reachValue: 50_000,
      });
    }
    // Only 3 image carousels — below BASELINE_MIN_SAMPLE.
    for (let i = 0; i < 3; i++) {
      await insertAnalysis(client, {
        profileId,
        bucketKey: "instagram:carousel:images_only",
        likeCount: 100,
        commentCount: 20,
      });
    }
    expect(3).toBeLessThan(BASELINE_MIN_SAMPLE);

    const result = await computeBaseline({
      profileId,
      bucketKey: "instagram:carousel:images_only",
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: null, likeCount: 90, commentCount: 10 },
    });

    // The 20 reels must not have leaked into this bucket's count.
    expect(result.sampleSize).toBe(3);
    expect(result.median).toBeNull();
    expect(result.multiplier).toBeNull();
  });
});

describe("computeBaseline — D5 part 3: age-bounded baseline", () => {
  it("excludes candidates below the maturity floor from the baseline pool", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";

    for (let i = 0; i < BASELINE_MIN_SAMPLE; i++) {
      await insertAnalysis(client, { profileId, bucketKey, reachValue: 1_000, postAgeHours: 200 });
    }
    // A too-young post — must not count toward the sample size.
    await insertAnalysis(client, { profileId, bucketKey, reachValue: 999_999, postAgeHours: 10 });

    const result = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: 1_000, likeCount: null, commentCount: null },
    });

    expect(result.sampleSize).toBe(BASELINE_MIN_SAMPLE);
    expect(result.median).toBe(1_000);
  });
});

describe("computeBaseline — R-8.4.4: sample size is never null when a multiplier exists", () => {
  it("sampleSize is always a number, both cold start and full baseline", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";

    const coldStart = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: 1_000, likeCount: null, commentCount: null },
    });
    expect(typeof coldStart.sampleSize).toBe("number");
    expect(coldStart.multiplier).toBeNull();

    for (let i = 0; i < BASELINE_MIN_SAMPLE; i++) {
      await insertAnalysis(client, { profileId, bucketKey, reachValue: 1_000 });
    }
    const full = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: 1_000, likeCount: null, commentCount: null },
    });
    expect(typeof full.sampleSize).toBe("number");
    expect(full.multiplier).not.toBeNull();
  });
});

describe("computeBaseline — schema-version isolation", () => {
  it("does not draw a baseline from a different schema_version's analyses", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";

    for (let i = 0; i < BASELINE_MIN_SAMPLE; i++) {
      await insertAnalysis(client, { profileId, bucketKey, reachValue: 1_000, schemaVersion: 2 });
    }

    const result = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: 1_000, likeCount: null, commentCount: null },
    });

    expect(result.sampleSize).toBe(0);
  });

  it("excludes the analysis being scored from its own candidate pool", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";

    const ids: string[] = [];
    for (let i = 0; i < BASELINE_MIN_SAMPLE; i++) {
      ids.push(await insertAnalysis(client, { profileId, bucketKey, reachValue: 1_000 }));
    }

    const result = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: ids[0],
      minPostAgeHours: 72,
      currentPost: { reachValue: 1_000, likeCount: null, commentCount: null },
    });

    expect(result.sampleSize).toBe(BASELINE_MIN_SAMPLE - 1);
  });
});
