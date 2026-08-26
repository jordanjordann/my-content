import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";

/**
 * Ticket #291 code review, blocking issue 2: a `profiles` row whose most
 * recent lookup attempt FAILED (`lookup_failed_at` set and still within its
 * retry window — `resolveProfile` returns it as-is, no fetch attempted)
 * carries no real fetched data. `analyses.profile_id` must NOT be set to
 * such a row's `id` — `computeBlock.ts` gates the live-comparator baseline
 * pool solely on `profileId != null` (`performance/baseline.ts`'s
 * `(profile_id, perf_bucket_key, schema_version)` grouping), so attaching a
 * failure-only row's id would make the analysis eligible for that pool on
 * the strength of zero real signal.
 *
 * Real sqlite-file end-to-end test (same pattern as
 * `audienceSourceFetchedAt.test.ts`) — a `profiles` row with
 * `lookup_failed_at` fresh is seeded directly, `runAnalysis` is exercised,
 * and the persisted `analyses.profile_id` is asserted against the real row.
 */

async function runMigrations(client: Client): Promise<void> {
  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await client.executeMultiple(readFileSync(join(migrationsDir, file), "utf8"));
  }
}

let client: Client;
let dbPath: string;

beforeEach(async () => {
  vi.resetModules();
  dbPath = join(tmpdir(), `profile-id-gating-${randomUUID()}.db`);
  process.env.TURSO_DATABASE_URL = `file:${dbPath}`;
  delete process.env.TURSO_AUTH_TOKEN;

  vi.doMock("@/lib/server/analysis/classifier", () => ({
    classifyUrl: () => ({ platform: "instagram", mediaType: "reel", shortcode: "abc" }),
  }));

  vi.doMock("@/lib/server/analysis/fetcher", () => ({
    fetchMetadata: async () => ({
      metadata: {
        url: "https://www.instagram.com/reel/abc/",
        shortcode: "abc",
        mediaType: "reel",
        username: "failure-only-creator",
        caption: "hello",
        viewCount: 100_000,
        postDate: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(),
        durationSec: 10,
        thumbnailUrl: null,
        videoUrl: "https://cdn.example/video.mp4",
        mediaParts: [],
        mediaPartsTruncated: false,
        likeCount: 5_000,
        commentCount: 500,
      },
      // No owner hint follower count — forces resolveProfile to rely purely
      // on the cached row's own state (fresh failure -> short-circuit,
      // never a fetch call).
      ownerHint: null,
      reachResult: {
        value: 100_000,
        kind: "VIEWS",
        state: "AVAILABLE",
        derivedFrom: "TOP_LEVEL",
        laterSlideReach: { usable: false },
        hasVideo: true,
      },
    }),
  }));

  vi.doMock("@/lib/server/analysis/downloader", () => ({
    deleteTempFile: vi.fn().mockResolvedValue(undefined),
  }));

  vi.doMock("@/lib/server/analysis/gemini", () => ({
    analyzeContent: vi.fn().mockResolvedValue({ text: "{}", raw: "{}" }),
    summarizeCaptionToTitle: vi.fn().mockResolvedValue("Generated Title"),
  }));

  vi.doMock("@/lib/server/analysis/media", () => ({
    prepareParts: vi.fn().mockResolvedValue({
      geminiParts: [],
      tempFilePaths: [],
      truncatedForBytes: false,
      preparedCount: 0,
      videoFileUris: [],
    }),
    PreparePartsError: class PreparePartsError extends Error {},
  }));

  vi.doMock("@/lib/server/analysis/prompts", () => ({
    buildSystemInstruction: () => "system",
    buildUserPrompt: () => "user",
  }));

  vi.doMock("@/lib/server/analysis/parser", () => ({
    parseContentAnalysis: () => ({
      schemaVersion: 3,
      performance: { performanceScore: 4, verdict: "v", drivers: [] },
    }),
  }));

  vi.doMock("@/lib/server/fingerprint", () => ({
    recomputeFingerprint: vi.fn().mockResolvedValue(undefined),
  }));

  const dbModule = await import("@/lib/server/db");
  client = dbModule.db;
  await runMigrations(client);
});

afterEach(() => {
  client?.close();
  vi.restoreAllMocks();
  vi.doUnmock("@/lib/server/analysis/classifier");
  vi.doUnmock("@/lib/server/analysis/fetcher");
  vi.doUnmock("@/lib/server/analysis/downloader");
  vi.doUnmock("@/lib/server/analysis/gemini");
  vi.doUnmock("@/lib/server/analysis/media");
  vi.doUnmock("@/lib/server/analysis/prompts");
  vi.doUnmock("@/lib/server/analysis/parser");
  vi.doUnmock("@/lib/server/fingerprint");
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = `${dbPath}${suffix}`;
    if (existsSync(file)) {
      rmSync(file);
    }
  }
});

describe("runAnalysis — analyses.profile_id (ticket #291 code review, blocking issue 2)", () => {
  it("does NOT attach a failure-only profile row's id to the analysis", async () => {
    const { recordProfileLookupFailure } = await import("@/lib/server/profiles/repository");
    const failedProfile = await recordProfileLookupFailure("instagram", "failure-only-creator");
    expect(failedProfile.lookupFailedAt).not.toBeNull();

    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");
    const result = await runAnalysis({
      url: "https://www.instagram.com/reel/abc/",
      prompt: "focus on hooks",
    });

    const row = await client.execute({
      sql: "SELECT profile_id, follower_count FROM analyses WHERE id = ?",
      args: [result.analysisId],
    });

    expect(row.rows[0]?.profile_id).toBeNull();
    expect(row.rows[0]?.follower_count).toBeNull();
  });

  it("DOES attach a real (non-failed) profile row's id to the analysis — control case", async () => {
    const { upsertProfile } = await import("@/lib/server/profiles/repository");
    const realProfile = await upsertProfile({
      platform: "instagram",
      username: "failure-only-creator",
      followerCount: 12_345,
    });
    expect(realProfile.lookupFailedAt).toBeNull();

    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");
    const result = await runAnalysis({
      url: "https://www.instagram.com/reel/abc/",
      prompt: "focus on hooks",
    });

    const row = await client.execute({
      sql: "SELECT profile_id, follower_count FROM analyses WHERE id = ?",
      args: [result.analysisId],
    });

    expect(row.rows[0]?.profile_id).toBe(realProfile.id);
    expect(row.rows[0]?.follower_count).toBe(12_345);
  });
});
