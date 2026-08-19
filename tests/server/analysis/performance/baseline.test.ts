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
  postDate?: string | null;
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
        perf_bucket_key, perf_post_age_hours, post_date, perf_reach_value, like_count, comment_count
      ) VALUES (?, 'https://instagram.com/reel/x', 'instagram', 'reel', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      opts.profileId,
      opts.status ?? "completed",
      opts.schemaVersion ?? SCHEMA_VERSION,
      opts.bucketKey,
      opts.postAgeHours ?? 200,
      opts.postDate ?? null,
      opts.reachValue ?? null,
      opts.likeCount ?? null,
      opts.commentCount ?? null,
    ],
  });
  return id;
}

/** Ticket #252 — `fetchLiveEligibleComparatorIds()` now returns `{ id, value }[]` per pool, not `Set<string>`; this projects a pool's array down to just the ids for assertions that only care about membership. */
function idsOf(comparators: { id: string; value: number }[] | undefined): string[] {
  return (comparators ?? []).map((comparator) => comparator.id);
}

/** ISO-8601 UTC timestamp `hoursAgo` hours before now — mirrors `fetcher/adapter.ts`'s stored shape. */
function isoHoursAgo(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
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

  it("throws loudly on a null analysisMode instead of building a phantom bucket key (pre-#142 guard)", async () => {
    // analysis_mode is nullable (migrations/012:93) and pipeline/index.ts:84
    // resets it to NULL on re-analysis. libsql types the column
    // `string | null`; #142 will read one of these rows and pass its value
    // straight through. Without a runtime guard, `[platform, mediaType,
    // null].join(":")` silently yields "instagram:reel:" — a phantom
    // bucket. This must throw instead.
    const { computeBucketKey } = await import("@/lib/server/analysis/performance/baseline");

    expect(() =>
      computeBucketKey(
        "instagram",
        "reel",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        null as any,
      ),
    ).toThrow(/analysisMode/);
  });

  it("throws loudly on an unrecognized platform or mediaType", async () => {
    const { computeBucketKey } = await import("@/lib/server/analysis/performance/baseline");

    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      computeBucketKey("tiktok" as any, "reel", "full_video"),
    ).toThrow(/platform/);
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      computeBucketKey("instagram", "story" as any, "full_video"),
    ).toThrow(/mediaType/);
  });
});

describe("denominatorForBucket — the bucket, not the row, decides the denominator", () => {
  it("full_video buckets are REACH; images_only/metadata_only buckets are ENGAGEMENT_COUNT", async () => {
    const { denominatorForBucket } = await import("@/lib/server/analysis/performance/baseline");

    expect(denominatorForBucket("instagram:reel:full_video")).toBe("REACH");
    expect(denominatorForBucket("instagram:carousel:full_video")).toBe("REACH");
    expect(denominatorForBucket("youtube:short:full_video")).toBe("REACH");
    expect(denominatorForBucket("instagram:carousel:images_only")).toBe("ENGAGEMENT_COUNT");
    expect(denominatorForBucket("instagram:post:metadata_only")).toBe("ENGAGEMENT_COUNT");
  });

  it("throws loudly on a malformed bucket key rather than guessing a denominator", async () => {
    const { denominatorForBucket } = await import("@/lib/server/analysis/performance/baseline");

    expect(() => denominatorForBucket("instagram:reel:")).toThrow(/malformed bucket key/);
    expect(() => denominatorForBucket("not-a-real-bucket-key")).toThrow(/malformed bucket key/);
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
      state: "COLD_START",
      bucketKey: "instagram:reel:full_video",
      sampleSize: 0,
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
    // COLD_START has no `median`/`multiplier` fields at all (post-#159-review
    // fix) — the state tag itself is the proof, not a null check on fields
    // that no longer exist on this variant.
    expect(result.state).toBe("COLD_START");
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
    expect(result.state).toBe("MEASURED");
    // Narrow before reading `median`/`multiplier` — un-narrowed access no
    // longer compiles now that those fields don't exist on every variant.
    if (result.state !== "MEASURED") throw new Error("unreachable");
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
    if (result.state !== "MEASURED") throw new Error("unreachable");
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
    if (result.state !== "MEASURED") throw new Error("unreachable");
    expect(result.median).toBe(300);
    expect(result.multiplier).toBe(2); // 600 / 300
  });
});

describe("computeBaseline — R-4.3.2/R-12.3.2: the denominator comes from the bucket, never row-level nullness", () => {
  it("a reach-hidden video-bearing carousel in a reach bucket is excluded, not relabelled ENGAGEMENT_COUNT (BLOCKING 1)", async () => {
    // This row is NOT a corrupt fixture — it is what a reach-hidden
    // video-bearing carousel looks like in production (hidden play/view counts,
    // `perf_reach_derived_from: 'NONE'` is out of scope, but the resulting
    // `perf_reach_value: NULL` on an otherwise reach-denominated bucket row
    // is exactly this shape). Before the fix, `metricFor()` inferred the
    // denominator from row-level nullness and relabelled this row
    // `ENGAGEMENT_COUNT`, which made `computeBaseline()` throw permanently
    // for the whole bucket. The bucket (`full_video`) is reach-denominated
    // by construction, so this row must simply be excluded from the pool.
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:carousel:full_video";

    for (let i = 0; i < BASELINE_MIN_SAMPLE; i++) {
      await insertAnalysis(client, { profileId, bucketKey, reachValue: 1_000 });
    }
    // A reach-hidden reel: reach unresolvable, likes/comments present.
    await insertAnalysis(client, {
      profileId,
      bucketKey,
      reachValue: null,
      likeCount: 10,
      commentCount: 5,
    });

    const result = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: 1_000, likeCount: null, commentCount: null },
    });

    // The reach-hidden row must not count toward the sample, and must not
    // throw — it is simply not a usable comparator this round.
    expect(result.sampleSize).toBe(BASELINE_MIN_SAMPLE);
    if (result.state !== "MEASURED") throw new Error("unreachable");
    expect(result.median).toBe(1_000);
  });

  it("the current post's own unresolved reach excludes it from the multiplier, without corrupting the candidate pool", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";

    for (let i = 0; i < BASELINE_MIN_SAMPLE; i++) {
      await insertAnalysis(client, { profileId, bucketKey, reachValue: 1_000 });
    }

    const result = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      // The post being scored is itself reach-hidden — same bucket,
      // unresolved reach. It must not be reclassified as
      // ENGAGEMENT_COUNT and must not disturb the candidate pool.
      currentPost: { reachValue: null, likeCount: 10, commentCount: 5 },
    });

    expect(result.sampleSize).toBe(BASELINE_MIN_SAMPLE);
    // `multiplier` does not exist on NOT_COMPARABLE (post-#159-review fix) —
    // `reason` is the field that proves no multiplier could be produced.
    expect(result.state).toBe("NOT_COMPARABLE");
    if (result.state !== "NOT_COMPARABLE") throw new Error("unreachable");
    expect(result.median).toBe(1_000);
    expect(result.reason).toBe("POST_METRIC_UNRESOLVED");
  });
});

describe("computeBaseline — usableEngagementCount excludes hidden-count candidates instead of scoring them 0 (BLOCKING 2)", () => {
  it("a candidate with no usable likes or comments is excluded from the pool, not counted as a zero-engagement sample", async () => {
    // An image carousel with `like_and_view_counts_disabled` (or any row
    // where the counts simply weren't captured) must not become a "valid"
    // sample worth 0 engagement — that would inflate sampleSize toward the
    // threshold AND drag the median down, inflating every multiplier in
    // the bucket. This is the ENGAGEMENT_COUNT-bucket mirror of BLOCKING 1.
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
    // A hidden-count candidate — no usable likes or comments at all.
    await insertAnalysis(client, {
      profileId,
      bucketKey,
      reachValue: null,
      likeCount: null,
      commentCount: null,
    });

    const result = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: null, likeCount: 300, commentCount: 300 },
    });

    // The hidden-count row must not inflate sampleSize or deflate the
    // median. If it had been scored 0, sampleSize would be
    // BASELINE_MIN_SAMPLE + 1 and the median would shift downward.
    expect(result.sampleSize).toBe(BASELINE_MIN_SAMPLE);
    if (result.state !== "MEASURED") throw new Error("unreachable");
    expect(result.median).toBe(300);
    expect(result.multiplier).toBe(2); // 600 / 300
  });
});

describe("computeBaseline — three-state result (post-#154-review: COLD_START vs NOT_COMPARABLE must not collapse)", () => {
  it("COLD_START (below threshold) is tagged 'COLD_START', not merely null median/multiplier", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const profileId = randomUUID();
    await insertProfile(client, profileId);

    const result = await computeBaseline({
      profileId,
      bucketKey: "instagram:reel:full_video",
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: 10_000, likeCount: 500, commentCount: 20 },
    });

    expect(result.state).toBe("COLD_START");
  });

  it("NOT_COMPARABLE (full baseline, this post's own reach unresolved) is tagged 'NOT_COMPARABLE' and is NOT confusable with COLD_START", async () => {
    // The exact regression this ticket closes: a full baseline exists
    // (sampleSize >= BASELINE_MIN_SAMPLE, median non-null) but this
    // specific post's own reach is unresolved, so no multiplier can be
    // produced. Before this fix, this state was distinguishable from
    // COLD_START only by inference (checking median !== null), which a
    // downstream consumer (#142) could get wrong and render "2 of 5
    // posts" for a creator who actually has a full baseline.
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";

    for (let i = 0; i < BASELINE_MIN_SAMPLE; i++) {
      await insertAnalysis(client, { profileId, bucketKey, reachValue: 1_000 });
    }

    const result = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: null, likeCount: 10, commentCount: 5 },
    });

    expect(result.sampleSize).toBe(BASELINE_MIN_SAMPLE);
    expect(result.state).toBe("NOT_COMPARABLE");
    expect(result.state).not.toBe("COLD_START");
    // `multiplier` does not exist on NOT_COMPARABLE at all (post-#159-review
    // fix) — narrowing to this branch is required just to read `median`;
    // `reason` is what proves no multiplier could be produced, not a
    // `multiplier === null` check a caller could get away with skipping.
    if (result.state !== "NOT_COMPARABLE") throw new Error("unreachable");
    expect(result.median).toBe(1_000);
    expect(result.reason).toBe("POST_METRIC_UNRESOLVED");
  });

  it("MEASURED (full baseline, this post's own metric resolved) is tagged 'MEASURED'", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";

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

    expect(result.state).toBe("MEASURED");
    if (result.state !== "MEASURED") throw new Error("unreachable");
    expect(result.multiplier).toBe(3);
  });

  it("MEDIAN_ZERO: full baseline where every comparator scored zero produces NOT_COMPARABLE/MEDIAN_ZERO, never a fabricated multiplier", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:carousel:images_only";

    for (let i = 0; i < BASELINE_MIN_SAMPLE; i++) {
      await insertAnalysis(client, {
        profileId,
        bucketKey,
        reachValue: null,
        likeCount: 0,
        commentCount: 0,
      });
    }

    const result = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: null, likeCount: 5, commentCount: 5 },
    });

    expect(result.sampleSize).toBe(BASELINE_MIN_SAMPLE);
    expect(result.state).toBe("NOT_COMPARABLE");
    if (result.state !== "NOT_COMPARABLE") throw new Error("unreachable");
    expect(result.median).toBe(0);
    expect(result.reason).toBe("MEDIAN_ZERO");
  });

  it("un-narrowed `.multiplier`/`.median` access on a bare BaselineResult no longer compiles (pins the #159 fix)", async () => {
    // This is a type-level assertion, not a runtime one. Before the fix,
    // `median`/`multiplier` were present (typed `number | null`) on every
    // variant, so this compiled and let a consumer branch on nullness
    // instead of `state` — exactly the #142 misreport risk. After dropping
    // the fields from COLD_START/NOT_COMPARABLE, both lines below are
    // `tsc` errors on the un-narrowed union; `@ts-expect-error` fails the
    // build if either one ever compiles again (e.g. if the fields were
    // reintroduced by a future edit).
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const profileId = randomUUID();
    await insertProfile(client, profileId);

    const result = await computeBaseline({
      profileId,
      bucketKey: "instagram:reel:full_video",
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: 10_000, likeCount: 500, commentCount: 20 },
    });

    // @ts-expect-error — `multiplier` does not exist on the un-narrowed
    // BaselineResult union (only on the narrowed "MEASURED" variant).
    expect(result.multiplier).toBeUndefined();
    // @ts-expect-error — `median` does not exist on the un-narrowed
    // BaselineResult union (absent on "COLD_START").
    expect(result.median).toBeUndefined();
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
    expect(result.state).toBe("COLD_START");
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
    if (result.state !== "MEASURED") throw new Error("unreachable");
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
    expect(coldStart.state).toBe("COLD_START");

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
    if (full.state !== "MEASURED") throw new Error("unreachable");
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

describe("computeBaseline — D2 (TDD §14.8b): candidate eligibility uses LIVE age, not just frozen age", () => {
  it("a post analysed while under the floor (frozen age low) but now genuinely mature (post_date old) IS eligible", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";

    for (let i = 0; i < BASELINE_MIN_SAMPLE - 1; i++) {
      await insertAnalysis(client, { profileId, bucketKey, reachValue: 1_000, postAgeHours: 200 });
    }
    // Analysed at 20h old (frozen, well under the 72h floor) but posted
    // long ago in wall-clock time — the Part 2 regression this ticket
    // fixes. Empirically the exact @giorrando shape (TDD §14.8b).
    await insertAnalysis(client, {
      profileId,
      bucketKey,
      reachValue: 5_000,
      postAgeHours: 20,
      postDate: isoHoursAgo(300),
    });

    const result = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: 1_000, likeCount: null, commentCount: null },
    });

    expect(result.sampleSize).toBe(BASELINE_MIN_SAMPLE);
  });

  it("monotonicity: a candidate already eligible under the frozen age stays eligible when post_date is NULL/unparseable", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";

    // Frozen age is above the floor; post_date is absent (NULL). A naive
    // "use live age only" implementation would compute julianday(NULL) ->
    // NULL and could silently drop this candidate. MAX(-1, frozen) must
    // keep it in.
    for (let i = 0; i < BASELINE_MIN_SAMPLE; i++) {
      await insertAnalysis(client, { profileId, bucketKey, reachValue: 1_000, postAgeHours: 200, postDate: null });
    }

    const result = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: 1_000, likeCount: null, commentCount: null },
    });

    expect(result.sampleSize).toBe(BASELINE_MIN_SAMPLE);
  });

  it("a post that is neither frozen-mature nor live-mature stays excluded (both signals genuinely young)", async () => {
    const { computeBaseline } = await import("@/lib/server/analysis/performance/baseline");
    const { BASELINE_MIN_SAMPLE } = await import("@/lib/server/analysis/performance/constants");
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";

    for (let i = 0; i < BASELINE_MIN_SAMPLE; i++) {
      await insertAnalysis(client, { profileId, bucketKey, reachValue: 1_000, postAgeHours: 200 });
    }
    // Genuinely young by both measures — must stay excluded.
    await insertAnalysis(client, {
      profileId,
      bucketKey,
      reachValue: 999_999,
      postAgeHours: 10,
      postDate: isoHoursAgo(10),
    });

    const result = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: SCHEMA_VERSION,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: 1_000, likeCount: null, commentCount: null },
    });

    expect(result.sampleSize).toBe(BASELINE_MIN_SAMPLE);
  });
});

describe("fetchLiveEligibleComparatorIds — D3/D4: the batched, grouped live count", () => {
  it("returns the eligible id set per requested (profileId, bucketKey, schemaVersion) pool, classified via the same metricFor() rules", async () => {
    const { fetchLiveEligibleComparatorIds, candidatePoolKey } = await import(
      "@/lib/server/analysis/performance/baseline"
    );
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";

    const eligibleId = await insertAnalysis(client, { profileId, bucketKey, reachValue: 1_000, postAgeHours: 200 });
    // Reach-hidden — must be classified out, exactly like computeBaseline's own metricFor() would.
    await insertAnalysis(client, { profileId, bucketKey, reachValue: null, postAgeHours: 200 });

    const pool = { profileId, bucketKey, schemaVersion: SCHEMA_VERSION };
    const result = await fetchLiveEligibleComparatorIds([pool], 72);

    const comparators = result.get(candidatePoolKey(pool));
    expect(comparators).toBeDefined();
    expect(idsOf(comparators)).toEqual([eligibleId]);
    // Ticket #252 — the classified metric value is retained, not discarded.
    expect(comparators).toEqual([{ id: eligibleId, value: 1_000 }]);
  });

  it("an empty pool list issues no query and returns an empty map", async () => {
    const { fetchLiveEligibleComparatorIds } = await import("@/lib/server/analysis/performance/baseline");
    const executeSpy = vi.spyOn(client, "execute");

    const result = await fetchLiveEligibleComparatorIds([], 72);

    expect(result.size).toBe(0);
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it("every requested pool gets an entry, even one with zero eligible candidates", async () => {
    const { fetchLiveEligibleComparatorIds, candidatePoolKey } = await import(
      "@/lib/server/analysis/performance/baseline"
    );
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const pool = { profileId, bucketKey: "instagram:reel:full_video", schemaVersion: SCHEMA_VERSION };

    const result = await fetchLiveEligibleComparatorIds([pool], 72);

    expect(result.get(candidatePoolKey(pool))).toEqual([]);
  });

  it("one call covers multiple distinct pools without cross-contaminating their eligible sets", async () => {
    const { fetchLiveEligibleComparatorIds, candidatePoolKey } = await import(
      "@/lib/server/analysis/performance/baseline"
    );
    const profileA = randomUUID();
    const profileB = randomUUID();
    await insertProfile(client, profileA);
    await insertProfile(client, profileB);
    const bucketKey = "instagram:reel:full_video";

    const idA = await insertAnalysis(client, { profileId: profileA, bucketKey, reachValue: 1_000, postAgeHours: 200 });
    const idB1 = await insertAnalysis(client, { profileId: profileB, bucketKey, reachValue: 2_000, postAgeHours: 200 });
    const idB2 = await insertAnalysis(client, { profileId: profileB, bucketKey, reachValue: 3_000, postAgeHours: 200 });

    const poolA = { profileId: profileA, bucketKey, schemaVersion: SCHEMA_VERSION };
    const poolB = { profileId: profileB, bucketKey, schemaVersion: SCHEMA_VERSION };
    const result = await fetchLiveEligibleComparatorIds([poolA, poolB], 72);

    expect(idsOf(result.get(candidatePoolKey(poolA))).sort()).toEqual([idA].sort());
    expect(idsOf(result.get(candidatePoolKey(poolB))).sort()).toEqual([idB1, idB2].sort());
  });

  it("two pools sharing (profileId, bucketKey) but differing only in schemaVersion do not cross-contaminate (reviewer repro, BLOCKER 1)", async () => {
    const { fetchLiveEligibleComparatorIds, candidatePoolKey, computeBaseline } = await import(
      "@/lib/server/analysis/performance/baseline"
    );
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKey = "instagram:reel:full_video";

    // 2 rows at schema_version 3, 1 row at schema_version 2 — same profile, same bucket.
    const idV3a = await insertAnalysis(client, {
      profileId,
      bucketKey,
      reachValue: 1_000,
      postAgeHours: 200,
      schemaVersion: 3,
    });
    const idV3b = await insertAnalysis(client, {
      profileId,
      bucketKey,
      reachValue: 2_000,
      postAgeHours: 200,
      schemaVersion: 3,
    });
    const idV2 = await insertAnalysis(client, {
      profileId,
      bucketKey,
      reachValue: 3_000,
      postAgeHours: 200,
      schemaVersion: 2,
    });

    const poolV3 = { profileId, bucketKey, schemaVersion: 3 };
    const poolV2 = { profileId, bucketKey, schemaVersion: 2 };
    const result = await fetchLiveEligibleComparatorIds([poolV3, poolV2], 72);

    expect(idsOf(result.get(candidatePoolKey(poolV3))).sort()).toEqual([idV3a, idV3b].sort());
    expect(idsOf(result.get(candidatePoolKey(poolV2))).sort()).toEqual([idV2]);

    // Read path and write path must agree on the same data.
    const v2Baseline = await computeBaseline({
      profileId,
      bucketKey,
      schemaVersion: 2,
      excludeAnalysisId: randomUUID(),
      minPostAgeHours: 72,
      currentPost: { reachValue: 500, likeCount: null, commentCount: null },
    });
    expect(v2Baseline.sampleSize).toBe(1);
    expect(result.get(candidatePoolKey(poolV2))!.length).toBe(v2Baseline.sampleSize);
  });

  it("two pools sharing (profileId, schemaVersion) but differing only in bucketKey do not cross-contaminate", async () => {
    const { fetchLiveEligibleComparatorIds, candidatePoolKey } = await import(
      "@/lib/server/analysis/performance/baseline"
    );
    const profileId = randomUUID();
    await insertProfile(client, profileId);
    const bucketKeyA = "instagram:reel:full_video";
    const bucketKeyB = "instagram:post:metadata_only";

    const idA = await insertAnalysis(client, {
      profileId,
      bucketKey: bucketKeyA,
      reachValue: 1_000,
      postAgeHours: 200,
    });
    const idB1 = await insertAnalysis(client, {
      profileId,
      bucketKey: bucketKeyB,
      likeCount: 10,
      commentCount: 2,
      postAgeHours: 200,
    });
    const idB2 = await insertAnalysis(client, {
      profileId,
      bucketKey: bucketKeyB,
      likeCount: 20,
      commentCount: 4,
      postAgeHours: 200,
    });

    const poolA = { profileId, bucketKey: bucketKeyA, schemaVersion: SCHEMA_VERSION };
    const poolB = { profileId, bucketKey: bucketKeyB, schemaVersion: SCHEMA_VERSION };
    const result = await fetchLiveEligibleComparatorIds([poolA, poolB], 72);

    expect(idsOf(result.get(candidatePoolKey(poolA))).sort()).toEqual([idA]);
    expect(idsOf(result.get(candidatePoolKey(poolB))).sort()).toEqual([idB1, idB2].sort());
  });
});

/**
 * Ticket #252 — `metricFor()` is now exported so the read path can classify
 * a row's own metric with the SAME rules (TR-1). Covers just the export
 * boundary; the classification rules themselves are already covered
 * exhaustively via `computeBaseline()`'s and `fetchLiveEligibleComparatorIds()`'s
 * own tests above, which call it internally.
 */
describe("metricFor — ticket #252, exported for the read path (TR-1)", () => {
  it("REACH denominator: a non-negative reach value classifies, a null/negative one does not", async () => {
    const { metricFor } = await import("@/lib/server/analysis/performance/baseline");
    expect(metricFor("REACH", { reachValue: 1_000, likeCount: null, commentCount: null })).toEqual({
      denominator: "REACH",
      value: 1_000,
    });
    expect(metricFor("REACH", { reachValue: null, likeCount: null, commentCount: null })).toBeNull();
  });

  it("ENGAGEMENT_COUNT denominator: likes + comments, both must be usable", async () => {
    const { metricFor } = await import("@/lib/server/analysis/performance/baseline");
    expect(metricFor("ENGAGEMENT_COUNT", { reachValue: null, likeCount: 10, commentCount: 2 })).toEqual({
      denominator: "ENGAGEMENT_COUNT",
      value: 12,
    });
    expect(metricFor("ENGAGEMENT_COUNT", { reachValue: null, likeCount: null, commentCount: 2 })).toBeNull();
  });
});
