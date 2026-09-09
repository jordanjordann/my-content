import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";

import { runMigrations } from "@/scripts/migrate";
import { normaliseAnalysisUrl } from "@/lib/server/analysis/classifier/rules";
import { buildDedupeKey, hashPrompt } from "@/lib/server/jobs/dedupe";
import { ANALYSIS_MAX_ATTEMPTS } from "@/lib/server/jobs/constants";
import {
  claim,
  enqueue,
  getJobs,
  heartbeat,
  markFailed,
  markSucceeded,
} from "@/lib/server/jobs/repository";
import type { AnalysisJobPayload } from "@/lib/server/jobs/types";

/**
 * Ticket #352 (3A-M1b). Real `/tmp` `file:` libSQL DB, migrated with the
 * real `migrations/` directory (matches `tests/server/analysis/reaper/reaper.test.ts`'s
 * proven pattern) -- no mocks. Zero paid external calls; zero live Turso.
 */

let workDirs: string[] = [];

afterEach(() => {
  for (const dir of workDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  workDirs = [];
});

async function makeMigratedDb(): Promise<Client> {
  const dir = mkdtempSync(join(tmpdir(), "jobs-repo-test-"));
  workDirs.push(dir);
  const client = createClient({ url: `file:${join(dir, "test.db")}` });
  await runMigrations(client, join(process.cwd(), "migrations"));
  return client;
}

function payload(overrides: Partial<AnalysisJobPayload> = {}): AnalysisJobPayload {
  return { url: "https://www.instagram.com/reel/ABC123", prompt: "analyse the hook", ...overrides };
}

function dedupeKeyFor(url: string, prompt: string): string {
  const normalised = normaliseAnalysisUrl(url);
  if (!normalised) {
    throw new Error(`test setup: expected ${url} to normalise`);
  }
  return buildDedupeKey(normalised, hashPrompt(prompt));
}

async function countRows(db: Client, table = "jobs"): Promise<number> {
  const result = await db.execute(`SELECT COUNT(*) AS n FROM ${table}`);
  return Number(result.rows[0]!.n);
}

describe("enqueue", () => {
  it("creates a new queued job on the first call", async () => {
    const db = await makeMigratedDb();
    const key = dedupeKeyFor("https://www.instagram.com/reel/ABC123", "analyse the hook");

    const result = await enqueue({ kind: "analysis", payload: payload(), dedupeKey: key }, db);

    expect(result.outcome).toEqual("created");
    expect(result.job.status).toEqual("queued");
    expect(result.job.dedupeKey).toEqual(key);
    expect(result.job.attempts).toEqual(0);
    expect(result.job.maxAttempts).toEqual(ANALYSIS_MAX_ATTEMPTS);
    expect(await countRows(db)).toEqual(1);

    db.close();
  });

  // Core acceptance criterion: same dedupe key while the first job is still
  // `queued` returns the EXISTING job, and the table holds exactly one row.
  it("returns the existing live job on a second enqueue with the same dedupe key, and the table holds one row", async () => {
    const db = await makeMigratedDb();
    const key = dedupeKeyFor("https://www.instagram.com/reel/ABC123", "analyse the hook");

    const first = await enqueue({ kind: "analysis", payload: payload(), dedupeKey: key }, db);
    const second = await enqueue({ kind: "analysis", payload: payload(), dedupeKey: key }, db);

    expect(second.outcome).toEqual("deduped");
    expect(second.job.id).toEqual(first.job.id);
    expect(await countRows(db)).toEqual(1);

    db.close();
  });

  // Dedupe proven with real URL variants, not two identical strings -- a
  // test using identical strings would pass even if buildDedupeKey ignored
  // normalisation entirely.
  it("dedupes real URL variants (trailing slash, utm_source, igsh) to a single job row", async () => {
    const db = await makeMigratedDb();
    const variants = [
      "https://www.instagram.com/reel/ABC123",
      "https://www.instagram.com/reel/ABC123/",
      "https://www.instagram.com/reel/ABC123/?utm_source=ig_web_copy_link",
      "https://instagram.com/reel/ABC123?igsh=xyz",
    ];

    let firstId: string | null = null;
    for (const url of variants) {
      const key = dedupeKeyFor(url, "analyse the hook");
      const result = await enqueue({ kind: "analysis", payload: payload({ url }), dedupeKey: key }, db);
      if (firstId === null) {
        firstId = result.job.id;
        expect(result.outcome).toEqual("created");
      } else {
        expect(result.outcome).toEqual("deduped");
        expect(result.job.id).toEqual(firstId);
      }
    }

    expect(await countRows(db)).toEqual(1);

    db.close();
  });

  // The partial unique index must not block legitimate re-analysis: once
  // the first job reaches a terminal state (`succeeded`), the same dedupe
  // key is free again.
  it("creates a new row for the same dedupe key after the first job has succeeded", async () => {
    const db = await makeMigratedDb();
    const key = dedupeKeyFor("https://www.instagram.com/reel/ABC123", "analyse the hook");

    const first = await enqueue({ kind: "analysis", payload: payload(), dedupeKey: key }, db);
    await markSucceeded(first.job.id, "analysis-1", db);

    const second = await enqueue({ kind: "analysis", payload: payload(), dedupeKey: key }, db);

    expect(second.outcome).toEqual("created");
    expect(second.job.id).not.toEqual(first.job.id);
    expect(await countRows(db)).toEqual(2);

    db.close();
  });

  it("different prompts on the same URL produce two distinct jobs", async () => {
    const db = await makeMigratedDb();
    const url = "https://www.instagram.com/reel/ABC123";
    const keyA = dedupeKeyFor(url, "prompt A");
    const keyB = dedupeKeyFor(url, "prompt B");

    const first = await enqueue({ kind: "analysis", payload: payload({ url, prompt: "prompt A" }), dedupeKey: keyA }, db);
    const second = await enqueue({ kind: "analysis", payload: payload({ url, prompt: "prompt B" }), dedupeKey: keyB }, db);

    expect(first.outcome).toEqual("created");
    expect(second.outcome).toEqual("created");
    expect(first.job.id).not.toEqual(second.job.id);
    expect(await countRows(db)).toEqual(2);

    db.close();
  });

  // MUTATION: proves enqueue() respects the retry ruling rather than
  // silently accepting a caller-supplied override above it.
  it("defaults maxAttempts to ANALYSIS_MAX_ATTEMPTS (1) when the caller does not override it", async () => {
    const db = await makeMigratedDb();
    const key = dedupeKeyFor("https://www.instagram.com/reel/ABC123", "analyse the hook");

    const result = await enqueue({ kind: "analysis", payload: payload(), dedupeKey: key }, db);

    expect(result.job.maxAttempts).toEqual(1);

    db.close();
  });
});

describe("claim", () => {
  it("returns the oldest queued job, sets claimed_by, and increments attempts to 1", async () => {
    const db = await makeMigratedDb();
    // Deliberately insert the row that will become "newer" FIRST (so it
    // gets the lower rowid / earlier insertion-order position), then the
    // row that will become "older" SECOND, backdating its created_at
    // afterwards. This decouples insertion order from created_at order --
    // if `claim()`'s query ever dropped `ORDER BY created_at` and fell back
    // to SQLite's default rowid/insertion-order scan, it would wrongly pick
    // the "newer" row here and this assertion would fail. A test that
    // inserted the older row first would pass even with that mutation,
    // since insertion order and created_at order would coincidentally
    // agree.
    const newer = await enqueue(
      { kind: "analysis", payload: payload(), dedupeKey: dedupeKeyFor("https://www.instagram.com/reel/NEWER", "p") },
      db,
    );
    const older = await enqueue(
      { kind: "analysis", payload: payload(), dedupeKey: dedupeKeyFor("https://www.instagram.com/reel/OLDER", "p") },
      db,
    );
    await db.execute({
      sql: "UPDATE jobs SET created_at = datetime('now', '-5 minutes') WHERE id = ?",
      args: [older.job.id],
    });
    expect(newer.job.id).not.toEqual(older.job.id);

    const claimed = await claim("worker-1", db);

    expect(claimed).not.toBeNull();
    expect(claimed!.id).toEqual(older.job.id);
    expect(claimed!.status).toEqual("claimed");
    expect(claimed!.claimedBy).toEqual("worker-1");
    expect(claimed!.attempts).toEqual(1);

    db.close();
  });

  it("returns null on an empty queue and does not throw", async () => {
    const db = await makeMigratedDb();

    await expect(claim("worker-1", db)).resolves.toBeNull();

    db.close();
  });

  it("returns null when every job is already claimed", async () => {
    const db = await makeMigratedDb();
    await enqueue({ kind: "analysis", payload: payload(), dedupeKey: dedupeKeyFor("https://www.instagram.com/reel/A1", "p") }, db);

    await claim("worker-1", db);
    const second = await claim("worker-2", db);

    expect(second).toBeNull();

    db.close();
  });

  it("two sequential claims never return the same row", async () => {
    const db = await makeMigratedDb();
    await enqueue({ kind: "analysis", payload: payload(), dedupeKey: dedupeKeyFor("https://www.instagram.com/reel/A1", "p") }, db);
    await enqueue({ kind: "analysis", payload: payload(), dedupeKey: dedupeKeyFor("https://www.instagram.com/reel/A2", "p") }, db);

    const first = await claim("worker-1", db);
    const second = await claim("worker-2", db);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first!.id).not.toEqual(second!.id);

    db.close();
  });
});

describe("markFailed", () => {
  it("sets status to dead (not failed) and persists a non-empty last_error when attempts === max_attempts", async () => {
    const db = await makeMigratedDb();
    const enqueued = await enqueue({ kind: "analysis", payload: payload(), dedupeKey: dedupeKeyFor("https://www.instagram.com/reel/A1", "p") }, db);
    expect(enqueued.job.maxAttempts).toEqual(1);

    const claimed = await claim("worker-1", db);
    expect(claimed!.attempts).toEqual(1);

    await markFailed(claimed!.id, "Gemini call failed: 500", db);

    const [row] = await getJobs([claimed!.id], db);
    expect(row!.status).toEqual("dead");
    expect(row!.lastError).toEqual("Gemini call failed: 500");

    db.close();
  });

  // MUTATION: pins the boundary the other direction -- a job with attempts
  // still below max_attempts goes to `failed`, not `dead`. Uses a
  // manually-raised max_attempts since the enqueue default is 1 and would
  // vacuously always dead-end the job.
  it("sets status to failed (not dead) when attempts is below max_attempts", async () => {
    const db = await makeMigratedDb();
    const enqueued = await enqueue(
      { kind: "analysis", payload: payload(), dedupeKey: dedupeKeyFor("https://www.instagram.com/reel/A1", "p"), maxAttempts: 5 },
      db,
    );
    const claimed = await claim("worker-1", db);
    expect(claimed!.attempts).toEqual(1);
    expect(enqueued.job.id).toEqual(claimed!.id);

    await markFailed(claimed!.id, "transient network error", db);

    const [row] = await getJobs([claimed!.id], db);
    expect(row!.status).toEqual("failed");
    expect(row!.lastError).toEqual("transient network error");

    db.close();
  });
});

describe("heartbeat", () => {
  it("writes heartbeat_at, progress_step and progress_message in a single call", async () => {
    const db = await makeMigratedDb();
    const enqueued = await enqueue({ kind: "analysis", payload: payload(), dedupeKey: dedupeKeyFor("https://www.instagram.com/reel/A1", "p") }, db);
    const claimed = await claim("worker-1", db);
    expect(claimed!.id).toEqual(enqueued.job.id);

    const before = (await getJobs([claimed!.id], db))[0]!;
    expect(before.heartbeatAt).toBeNull();
    expect(before.progressStep).toBeNull();
    expect(before.progressMessage).toBeNull();

    await heartbeat(claimed!.id, { progressStep: "downloading", progressMessage: "Fetching media" }, db);

    const after = (await getJobs([claimed!.id], db))[0]!;
    expect(after.heartbeatAt).not.toBeNull();
    expect(after.progressStep).toEqual("downloading");
    expect(after.progressMessage).toEqual("Fetching media");
    expect(after.status).toEqual("running");

    db.close();
  });
});

describe("markSucceeded", () => {
  it("sets status to succeeded and records the analysis id", async () => {
    const db = await makeMigratedDb();
    const enqueued = await enqueue({ kind: "analysis", payload: payload(), dedupeKey: dedupeKeyFor("https://www.instagram.com/reel/A1", "p") }, db);
    await claim("worker-1", db);

    await markSucceeded(enqueued.job.id, "analysis-42", db);

    const [row] = await getJobs([enqueued.job.id], db);
    expect(row!.status).toEqual("succeeded");
    expect(row!.analysisId).toEqual("analysis-42");

    db.close();
  });
});

describe("getJobs", () => {
  it("returns rows matching the given ids, parameterised (not interpolated)", async () => {
    const db = await makeMigratedDb();
    const a = await enqueue({ kind: "analysis", payload: payload(), dedupeKey: dedupeKeyFor("https://www.instagram.com/reel/A1", "p") }, db);
    const b = await enqueue({ kind: "analysis", payload: payload(), dedupeKey: dedupeKeyFor("https://www.instagram.com/reel/A2", "p") }, db);

    const rows = await getJobs([a.job.id, b.job.id], db);

    expect(rows.map((row) => row.id).sort()).toEqual([a.job.id, b.job.id].sort());

    db.close();
  });

  it("returns an empty array for an empty id list without querying", async () => {
    const db = await makeMigratedDb();

    await expect(getJobs([], db)).resolves.toEqual([]);

    db.close();
  });

  // Proves ids are bound as parameters, not string-interpolated: a quote
  // character in an id must not error and must simply match nothing.
  it("an id containing a quote character returns no rows and does not throw", async () => {
    const db = await makeMigratedDb();
    await enqueue({ kind: "analysis", payload: payload(), dedupeKey: dedupeKeyFor("https://www.instagram.com/reel/A1", "p") }, db);

    await expect(getJobs(["nonexistent' OR '1'='1"], db)).resolves.toEqual([]);

    db.close();
  });

  // MUTATION: a stronger injection proof than the quote test above. If
  // `getJobs` ever built its SQL by wrapping each id in quotes and
  // string-interpolating (`IN ('${id}')`) instead of binding parameters, a
  // comma smuggled inside one "id" would extend the IN-list to also match a
  // real row it was never asked for -- silently leaking a job the caller
  // did not request. Proper parameterisation binds the whole string as a
  // single opaque value, so this must match nothing.
  it("an id containing a comma-and-quote injection payload cannot smuggle in a real row", async () => {
    const db = await makeMigratedDb();
    const real = await enqueue(
      { kind: "analysis", payload: payload(), dedupeKey: dedupeKeyFor("https://www.instagram.com/reel/A1", "p") },
      db,
    );

    const rows = await getJobs([`nonexistent', '${real.job.id}`], db);

    expect(rows).toEqual([]);

    db.close();
  });
});
