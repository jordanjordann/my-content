import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";

/**
 * Ticket #312 (#281 audit finding) —
 * docs/TDD-analysis-write-verification.md §4.
 *
 * Real libsql `file:` DB, same technique as `profileIdGating.test.ts`, NOT a
 * hand-rolled `db.execute` mock: the entire point of this ticket is that
 * `rowsAffected` on a 0-row write must be caught, and a mock that always
 * returns `{ rows: [] }` (no `rowsAffected` at all) would prove nothing
 * about the real libsql behaviour the bug depends on.
 *
 * Covers, per the TDD:
 *  - check B: the re-analysis UPDATE throws on 0 rows, before any paid
 *    Gemini call (closes the TOCTOU window between the route's existence
 *    SELECT and this write).
 *  - the completion UPDATE throws on 0 rows (row vanished after the paid
 *    call already happened — money guarantee is gone, but false "success"
 *    must not be reported).
 *  - both error-path writes (the new-analysis DELETE and the re-analysis
 *    'failed' UPDATE) assert but only LOG on a mismatch — they must never
 *    replace the real, diagnostic error with a bookkeeping error.
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

const TEST_URL = "https://www.instagram.com/reel/abc/";

const { analyzeContentMock } = vi.hoisted(() => ({
  analyzeContentMock: vi.fn(),
}));

let client: Client;
let dbPath: string;

beforeEach(async () => {
  vi.resetModules();
  dbPath = join(tmpdir(), `write-verification-${randomUUID()}.db`);
  process.env.TURSO_DATABASE_URL = `file:${dbPath}`;
  delete process.env.TURSO_AUTH_TOKEN;

  analyzeContentMock.mockReset();
  analyzeContentMock.mockResolvedValue({ text: "{}", raw: "{}" });

  vi.doMock("@/lib/server/analysis/classifier", () => ({
    classifyUrl: () => ({ platform: "instagram", mediaType: "reel", shortcode: "abc" }),
  }));

  vi.doMock("@/lib/server/analysis/fetcher", () => ({
    fetchMetadata: vi.fn().mockResolvedValue({
      metadata: {
        url: TEST_URL,
        shortcode: "abc",
        mediaType: "reel",
        username: "creator",
        caption: "hello",
        viewCount: 100,
        postDate: null,
        durationSec: 10,
        thumbnailUrl: null,
        videoUrl: "https://cdn.example/video.mp4",
        mediaParts: [],
        mediaPartsTruncated: false,
      },
      ownerHint: null,
      reachResult: {
        value: null,
        kind: null,
        state: "UNKNOWN",
        derivedFrom: "NONE",
        laterSlideReach: { usable: false },
        hasVideo: false,
      },
    }),
  }));

  vi.doMock("@/lib/server/analysis/downloader", () => ({
    deleteTempFile: vi.fn().mockResolvedValue(undefined),
  }));

  vi.doMock("@/lib/server/analysis/gemini", () => ({
    analyzeContent: (...args: unknown[]) => analyzeContentMock(...args),
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

async function insertAnalysis(id: string, status: "pending" | "completed" | "failed" = "completed") {
  await client.execute({
    sql: `INSERT INTO analyses (id, prompt, url, platform, media_type, status)
          VALUES (?, 'old prompt', ?, 'instagram', 'reel', ?)`,
    args: [id, TEST_URL, status],
  });
}

describe("runAnalysis — re-analysis UPDATE write verification (#312 check B, closes the TOCTOU window)", () => {
  it("throws before any paid Gemini call when existingId no longer exists", async () => {
    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");
    const ghostId = randomUUID();
    // No row inserted — simulates a row deleted after the route's own
    // existence check (check A) already passed.

    await expect(
      runAnalysis({ url: TEST_URL, prompt: "p", existingId: ghostId }),
    ).rejects.toThrow(/no longer exists/i);

    expect(analyzeContentMock).not.toHaveBeenCalled();
  });

  it("control: re-analysing a row that DOES exist proceeds normally and completes", async () => {
    const id = randomUUID();
    await insertAnalysis(id);

    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");
    const result = await runAnalysis({ url: TEST_URL, prompt: "p", existingId: id });

    expect(result.analysisId).toBe(id);
    expect(analyzeContentMock).toHaveBeenCalledTimes(1);

    const row = await client.execute({ sql: "SELECT status FROM analyses WHERE id = ?", args: [id] });
    expect(row.rows[0]?.status).toBe("completed");
  });
});

describe("runAnalysis — completion UPDATE write verification (#312 §4.2)", () => {
  it("throws when the row is deleted mid-run, AFTER the paid Gemini call already happened", async () => {
    const id = randomUUID();
    await insertAnalysis(id);

    analyzeContentMock.mockImplementation(async () => {
      // Simulate the row vanishing between the re-analysis UPDATE and the
      // completion UPDATE (e.g. a concurrent DELETE from another request).
      await client.execute({ sql: "DELETE FROM analyses WHERE id = ?", args: [id] });
      return { text: "{}", raw: "{}" };
    });

    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");

    await expect(
      runAnalysis({ url: TEST_URL, prompt: "p", existingId: id }),
    ).rejects.toThrow(/vanished/i);

    // The paid call DID happen in this scenario — this assertion cannot
    // undo that spend, only stop the pipeline from reporting false success.
    expect(analyzeContentMock).toHaveBeenCalledTimes(1);
  });
});

describe("runAnalysis — error-path writes are asymmetric: log-only, never throw over the real error (#312 §4.2)", () => {
  it("a re-analysis failure still throws the ORIGINAL error, not a bookkeeping error, even though the row is gone by the time the 'failed' UPDATE runs", async () => {
    const id = randomUUID();
    await insertAnalysis(id);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    analyzeContentMock.mockImplementation(async () => {
      // The row is deleted by someone else, AND the Gemini call itself
      // fails — the catch block's own `UPDATE ... status = 'failed'` write
      // will affect 0 rows. The re-thrown error must still be the ORIGINAL
      // Gemini failure, not a rowsAffected bookkeeping error.
      await client.execute({ sql: "DELETE FROM analyses WHERE id = ?", args: [id] });
      throw new Error("Gemini exploded");
    });

    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");

    await expect(
      runAnalysis({ url: TEST_URL, prompt: "p", existingId: id }),
    ).rejects.toThrow("Gemini exploded");

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(`mark analysis ${id} failed`));
  });

  it("a NEW analysis failure still throws the ORIGINAL error, even though its own cleanup DELETE affects 0 rows (row already gone)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.doMock("@/lib/server/analysis/fetcher", () => ({
      fetchMetadata: vi.fn().mockImplementation(async () => {
        // Delete the row this call's own INSERT just wrote (found by URL —
        // the generated analysisId isn't known from outside the pipeline)
        // to simulate a concurrent process removing it before the catch
        // block's own DELETE runs.
        await client.execute({ sql: "DELETE FROM analyses WHERE url = ?", args: [TEST_URL] });
        throw new Error("fetchMetadata exploded");
      }),
    }));

    const { runAnalysis } = await import("@/lib/server/analysis/pipeline");

    await expect(runAnalysis({ url: TEST_URL, prompt: "p" })).rejects.toThrow(
      "fetchMetadata exploded",
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Expected to delete failed new-analysis row"),
    );
  });
});
