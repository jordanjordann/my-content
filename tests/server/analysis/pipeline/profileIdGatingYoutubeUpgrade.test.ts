import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";

/**
 * Ticket #291 code review round 3, "second call site uncovered": the
 * reviewer mutation-tested that un-gating only the FIRST
 * `computePerformanceBlock({ ...profileId })` call (~pipeline/index.ts:367)
 * while leaving the `analyses` INSERT/UPDATE's `profile_id` argument gated
 * still passed the full suite — proving the SECOND `computePerformanceBlock`
 * call (the YouTube upgrade branch, fired when Gemini's response evidences
 * real video decoding — ticket #295 B2/H1) was never exercised by a test
 * that would catch it reverting to the old ungated `profile?.id`.
 *
 * This is a real sqlite-file end-to-end test (same pattern as
 * `profileIdGating.test.ts`) exercising the YouTube upgrade path
 * specifically. It seeds:
 *   - a "failure-only" `profiles` row (never had a successful fetch —
 *     `hasRealProfileData()` must read this as `false`, so the CORRECT
 *     `profileId` fed to BOTH `computePerformanceBlock` calls is `null`)
 *   - 5 sibling `completed` analyses rows directly attached (via a raw
 *     INSERT, bypassing `runAnalysis()`'s own gating) to that failure-only
 *     profile's id, in the exact bucket
 *     (`youtube:short:full_video`/schema 3) the YouTube upgrade branch
 *     computes, mature enough to clear `MATURITY_FLOOR_HOURS` and hit
 *     `BASELINE_MIN_SAMPLE`.
 *
 * If the SECOND `computePerformanceBlock` call reverted to the old,
 * ungated `profile?.id`, `computeBaseline()` would pick up those 5 seeded
 * rows as real comparators and the upgrade UPDATE would persist a
 * `MEASURED` baseline (non-null `perf_baseline_median`,
 * `perf_baseline_sample_size = 5`) instead of the correct `COLD_START`
 * (`perf_baseline_sample_size = 0`, `perf_baseline_median = null`) that
 * `profileId = null` produces by skipping the DB read entirely
 * (`computeBlock.ts`: `input.profileId ? await computeBaseline(...) :
 * { state: "COLD_START", ... }`).
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

const YOUTUBE_URL = "https://www.youtube.com/shorts/abc123";

beforeEach(async () => {
  vi.resetModules();
  dbPath = join(tmpdir(), `profile-id-gating-yt-upgrade-${randomUUID()}.db`);
  process.env.TURSO_DATABASE_URL = `file:${dbPath}`;
  delete process.env.TURSO_AUTH_TOKEN;

  vi.doMock("@/lib/server/analysis/classifier", () => ({
    classifyUrl: () => ({ platform: "youtube", mediaType: "short", shortcode: "abc123" }),
  }));

  vi.doMock("@/lib/server/analysis/fetcher", () => ({
    fetchMetadata: async () => ({
      metadata: {
        url: YOUTUBE_URL,
        shortcode: "abc123",
        mediaType: "short",
        username: "failure-only-yt-creator",
        caption: "hello",
        viewCount: 1000,
        postDate: null,
        durationSec: 12,
        thumbnailUrl: null,
        videoUrl: YOUTUBE_URL,
      },
      // No owner hint follower count — forces resolveProfile to rely purely
      // on the cached row's own state (fresh failure -> short-circuit,
      // never a fetch call, never real data).
      ownerHint: null,
      reachResult: {
        value: 1000,
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

  const VIDEO_MODALITY_USAGE_METADATA = {
    promptTokensDetails: [
      { modality: "TEXT", tokenCount: 500 },
      { modality: "VIDEO", tokenCount: 6049 },
    ],
  };

  vi.doMock("@/lib/server/analysis/gemini", () => ({
    analyzeContent: vi
      .fn()
      .mockResolvedValue({ text: "{}", raw: "{}", usageMetadata: VIDEO_MODALITY_USAGE_METADATA }),
    hasVideoModalityEvidence: (usageMetadata: { promptTokensDetails?: { modality: string; tokenCount: number }[] }) =>
      (usageMetadata?.promptTokensDetails ?? []).some(
        (part) => part.modality === "VIDEO" && part.tokenCount > 0,
      ),
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

describe("runAnalysis — YouTube upgrade branch's SECOND computePerformanceBlock call must also gate profileId (ticket #291 code review round 3)", () => {
  it("stays COLD_START (no baseline pool hit) on the upgrade UPDATE, even though 5 mature sibling rows exist under the failure-only profile's id", async () => {
    const { recordProfileLookupFailure } = await import("@/lib/server/profiles/repository");
    const failureOnlyProfile = await recordProfileLookupFailure("youtube", "failure-only-yt-creator");
    expect(failureOnlyProfile.lookupFailedAt).not.toBeNull();
    expect(failureOnlyProfile.followerCount).toBeNull();

    // 5 mature, completed sibling rows in the EXACT bucket the YouTube
    // upgrade branch computes (`youtube:short:full_video`, schema 3),
    // attached directly to the failure-only profile's id — planted so that,
    // if the second computePerformanceBlock call reverted to the ungated
    // `profile?.id`, computeBaseline() would find them and go MEASURED.
    for (let i = 0; i < 5; i += 1) {
      await client.execute({
        sql: `
          INSERT INTO analyses (
            id, url, platform, media_type, status, profile_id,
            perf_bucket_key, schema_version, perf_reach_value,
            perf_post_age_hours, like_count, comment_count
          ) VALUES (?, ?, 'youtube', 'short', 'completed', ?, 'youtube:short:full_video', 3, ?, 100, 0, 0)
        `,
        args: [randomUUID(), `https://www.youtube.com/shorts/sibling-${i}`, failureOnlyProfile.id, 500 + i * 10],
      });
    }

    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");
    const result = await runAnalysis({ url: YOUTUBE_URL, prompt: "focus on hooks" });

    const row = await client.execute({
      sql: `
        SELECT profile_id, analysis_mode, perf_baseline_sample_size, perf_baseline_median, perf_tier_used
        FROM analyses WHERE id = ?
      `,
      args: [result.analysisId],
    });

    // Sanity check: the row DID upgrade to 'full_video' (otherwise this
    // proves nothing about the upgrade branch's own computePerformanceBlock
    // call specifically).
    expect(row.rows[0]?.analysis_mode).toBe("full_video");

    // The main assertion: profile_id stays null (failure-only row, no real
    // data), and the baseline the UPGRADE call computed is the honest
    // COLD_START — not MEASURED off the 5 planted sibling rows.
    expect(row.rows[0]?.profile_id).toBeNull();
    expect(row.rows[0]?.perf_baseline_sample_size).toBe(0);
    expect(row.rows[0]?.perf_baseline_median).toBeNull();
  });
});
