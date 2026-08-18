import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";

/**
 * Ticket #143, implementation step 4 (TDD §1.3): `audience_source_fetched_at`
 * is a copy of `profiles.last_fetched_at` taken AT WRITE TIME. `profiles.
 * last_fetched_at` is mutated by the next refresh, so without the copy a
 * completed analysis cannot recover how stale its own denominator was
 * (R-13.3.2/R-13.4.5). This is an end-to-end test against a REAL sqlite file
 * (same pattern as `computeBlock.test.ts`/`baseline.test.ts`) with only the
 * network-facing collaborators (fetcher, Gemini, media, fingerprint)
 * mocked — `db` and `profiles` are real, so the assertion is against actual
 * persisted rows, not a mock's recorded call.
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
  dbPath = join(tmpdir(), `audience-source-${randomUUID()}.db`);
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
        username: "creator-audience-test",
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
      ownerHint: {
        username: "creator-audience-test",
        externalId: "ext-1",
        followerCount: 50_000,
        followingCount: null,
        fullName: null,
        profilePicUrl: null,
        biography: null,
        isVerified: null,
        isBusinessAccount: null,
        isPrivate: null,
      },
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

describe("runAnalysis — audience_source_fetched_at (TDD §1.3, ticket #143 step 4)", () => {
  it("is written at analysis time and does NOT change when the profile cache is subsequently refreshed", async () => {
    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");
    const { getProfileByUsername } = await import("@/lib/server/profiles/repository");

    const result = await runAnalysis({
      url: "https://www.instagram.com/reel/abc/",
      prompt: "focus on hooks",
    });

    const firstRow = await client.execute({
      sql: "SELECT audience_source_fetched_at, profile_id FROM analyses WHERE id = ?",
      args: [result.analysisId],
    });
    const audienceSourceFetchedAtAtWrite = firstRow.rows[0]?.audience_source_fetched_at as string;
    const profileId = firstRow.rows[0]?.profile_id as string;

    expect(audienceSourceFetchedAtAtWrite).toBeTruthy();

    const profileBeforeRefresh = await getProfileByUsername("instagram", "creator-audience-test");
    expect(profileBeforeRefresh?.id).toBe(profileId);
    expect(profileBeforeRefresh?.lastFetchedAt).toBe(audienceSourceFetchedAtAtWrite);

    // Simulate a later profile cache refresh — `profiles.last_fetched_at`
    // moves forward, mutating the very value `audience_source_fetched_at`
    // was copied from. Forced to a fixed, unambiguously-later value via a
    // direct write (rather than `upsertProfile`'s `datetime('now')`, whose
    // second-granularity could coincide with the write above within the
    // same test run, and which — PR #191 review C6 — this test does not
    // otherwise need to call at all) so the inequality assertion below is
    // not flaky.
    await client.execute({
      sql: "UPDATE profiles SET last_fetched_at = '2099-01-01 00:00:00' WHERE id = ?",
      args: [profileId],
    });

    const profileAfterRefresh = await getProfileByUsername("instagram", "creator-audience-test");
    expect(profileAfterRefresh?.lastFetchedAt).toBe("2099-01-01 00:00:00");
    expect(profileAfterRefresh?.lastFetchedAt).not.toBe(audienceSourceFetchedAtAtWrite);

    const rowAfterRefresh = await client.execute({
      sql: "SELECT audience_source_fetched_at FROM analyses WHERE id = ?",
      args: [result.analysisId],
    });
    expect(rowAfterRefresh.rows[0]?.audience_source_fetched_at).toBe(audienceSourceFetchedAtAtWrite);
  });
});
