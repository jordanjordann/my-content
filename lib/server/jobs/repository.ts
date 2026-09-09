import { randomUUID } from "node:crypto";

import { LibsqlError, type Client } from "@libsql/client";

import { db } from "@/lib/server/db";

import { ANALYSIS_MAX_ATTEMPTS } from "./constants";
import type { AnalysisJobPayload, ClaimResult, EnqueueResult, JobKind, JobRow, JobStatus } from "./types";

/**
 * Ticket #352 (3A-M1b). Repository for the `jobs` table (`015_jobs.sql`,
 * #351).
 *
 * R2 (plan §5, §1.5, §13 E3) — NO `db.transaction` calls anywhere in this
 * file, and never add one. `@libsql/client`'s local sqlite3 driver steals the
 * client's underlying native connection for the lifetime of a `db.transaction`
 * call, and `Sqlite3Transaction.close()` is a no-op after a successful commit
 * (`inTransaction` is already `false`, so `close()` issues nothing) — the
 * native handle is simply abandoned with no reachable reference anywhere.
 * There is no userland fix. A long-lived server leaks one native connection
 * per call; the worker (#355) is the longest-lived process this app will
 * ever run, so this is not a theoretical concern here. Every function below
 * is exactly one `client.execute()` — no `batch()` wrapping writes in an
 * implicit transaction either. The same discipline is carried by
 * `lib/server/fingerprint/repository.ts` (PR #120) and
 * `lib/server/analysis/reaper/reaper.ts`. `tests/server/jobs/no-transaction.test.ts`
 * greps this directory for the forbidden call and fails if one is added.
 *
 * R6 (plan §5) — embedded libSQL replicas are RULED OUT for this queue.
 * `lib/server/db.ts`'s `db` is a plain `createClient({ url, authToken })`
 * with no `syncUrl` (confirmed at `main`), which is deliberate: with
 * embedded replicas, the web service and the worker service would each hold
 * their OWN local replica, and the worker would not see a newly-enqueued job
 * until its next `sync()`. Adopting replicas is the tempting "fix" for the
 * SSE polling latency a later 3A ticket (progress transport) will
 * introduce — do not do it for this table.
 *
 * Every function takes `client: Client = db` as a default parameter, the
 * same shape `lib/server/analysis/reaper/reaper.ts` established: it lets
 * tests drive a real `/tmp` `file:` libSQL DB directly (no `vi.resetModules()`
 * gymnastics needed to swap out the module-level `db` singleton, which is
 * built from `TURSO_DATABASE_URL` at import time).
 */

type RawJobRow = Record<string, unknown>;

function mapRow(row: RawJobRow): JobRow {
  return {
    id: row.id as string,
    kind: row.kind as JobKind,
    status: row.status as JobStatus,
    payload: JSON.parse(row.payload as string) as AnalysisJobPayload,
    dedupeKey: (row.dedupe_key as string | null) ?? null,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    claimedAt: (row.claimed_at as string | null) ?? null,
    claimedBy: (row.claimed_by as string | null) ?? null,
    heartbeatAt: (row.heartbeat_at as string | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    analysisId: (row.analysis_id as string | null) ?? null,
    progressStep: (row.progress_step as string | null) ?? null,
    progressMessage: (row.progress_message as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * `idx_jobs_dedupe` is a UNIQUE index (partial, over `status IN
 * ('queued','claimed','running')`) on `jobs(dedupe_key)`. SQLite reports a
 * violation as `SQLITE_CONSTRAINT` with a message naming the column; this
 * checks both so `enqueue()` never mistakes an unrelated constraint failure
 * (e.g. a future `NOT NULL` violation) for a dedupe hit.
 */
function isDedupeConstraintViolation(error: unknown): boolean {
  return (
    error instanceof LibsqlError && error.code === "SQLITE_CONSTRAINT" && error.message.includes("dedupe_key")
  );
}

export interface EnqueueInput {
  kind: JobKind;
  payload: AnalysisJobPayload;
  dedupeKey: string;
  /**
   * Defaults to `ANALYSIS_MAX_ATTEMPTS` (1) — the owner's retry ruling.
   * Callers must not pass a value above it for `kind: "analysis"` jobs; the
   * parameter exists so the knob is one value to change later, once spend
   * tracking exists (plan Q1/R3), not so callers raise it today.
   */
  maxAttempts?: number;
}

/**
 * Inserts a new `queued` job, or — if `idx_jobs_dedupe` rejects the insert
 * because a live (queued/claimed/running) job already holds this dedupe key
 * — returns that existing job instead.
 *
 * Deliberately insert-first, not select-then-insert: a pre-`SELECT` would be
 * a TOCTOU race between the `SELECT` and the `INSERT` that the unique index
 * exists specifically to close (two concurrent enqueues could both pass the
 * `SELECT` and both `INSERT`). Catching the constraint violation and
 * `SELECT`ing the winner is the only race-free shape for this operation
 * without a transaction (R2).
 */
export async function enqueue(input: EnqueueInput, client: Client = db): Promise<EnqueueResult> {
  const id = randomUUID();
  const maxAttempts = input.maxAttempts ?? ANALYSIS_MAX_ATTEMPTS;

  try {
    const result = await client.execute({
      sql: `
        INSERT INTO jobs (id, kind, status, payload, dedupe_key, max_attempts)
        VALUES (?, ?, 'queued', ?, ?, ?)
        RETURNING *
      `,
      args: [id, input.kind, JSON.stringify(input.payload), input.dedupeKey, maxAttempts],
    });

    const row = result.rows[0];
    if (!row) {
      throw new Error("enqueue: INSERT ... RETURNING * returned no row");
    }
    return { outcome: "created", job: mapRow(row as unknown as RawJobRow) };
  } catch (error) {
    if (!isDedupeConstraintViolation(error)) {
      throw error;
    }

    const existing = await client.execute({
      sql: `
        SELECT * FROM jobs
        WHERE dedupe_key = ? AND status IN ('queued', 'claimed', 'running')
        LIMIT 1
      `,
      args: [input.dedupeKey],
    });

    const winner = existing.rows[0];
    if (!winner) {
      // The row that won the unique-index race moved to a terminal state
      // between the failed INSERT and this SELECT. Re-throwing the original
      // constraint error is honest — this function must never silently
      // report "deduped" against a job it cannot find.
      throw error;
    }
    return { outcome: "deduped", job: mapRow(winner as unknown as RawJobRow) };
  }
}

/**
 * The claim statement — verbatim per the ticket, do not "improve" it.
 * `attempts=attempts+1` happens on CLAIM, not on completion: a worker killed
 * mid-job has already burned its attempt, so a crash-loop terminates instead
 * of spinning forever. Zero rows returned = nothing to claim, not an error.
 */
export async function claim(workerId: string, client: Client = db): Promise<ClaimResult> {
  const result = await client.execute({
    sql: `
      UPDATE jobs
      SET status='claimed', claimed_at=datetime('now'), claimed_by=?,
          attempts=attempts+1, updated_at=datetime('now')
      WHERE id = (SELECT id FROM jobs WHERE status='queued' ORDER BY created_at LIMIT 1)
      RETURNING *
    `,
    args: [workerId],
  });

  const row = result.rows[0];
  return row ? mapRow(row as unknown as RawJobRow) : null;
}

export interface HeartbeatInput {
  progressStep?: string | null;
  progressMessage?: string | null;
}

/**
 * Single `UPDATE` writing `heartbeat_at`, `status='running'` and both
 * progress columns together. The progress columns are written but nothing
 * reads them yet — that is the SSE ticket (#358).
 */
export async function heartbeat(jobId: string, input: HeartbeatInput = {}, client: Client = db): Promise<void> {
  await client.execute({
    sql: `
      UPDATE jobs
      SET heartbeat_at = datetime('now'),
          status = 'running',
          progress_step = ?,
          progress_message = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `,
    args: [input.progressStep ?? null, input.progressMessage ?? null, jobId],
  });
}

/** Single `UPDATE` marking a job `succeeded` and recording the analysis it produced. */
export async function markSucceeded(jobId: string, analysisId: string, client: Client = db): Promise<void> {
  await client.execute({
    sql: `
      UPDATE jobs
      SET status = 'succeeded',
          analysis_id = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `,
    args: [analysisId, jobId],
  });
}

/**
 * Single `UPDATE` marking a job `failed` or `dead`. `dead` when the job has
 * already burned all of its attempts (`attempts >= max_attempts`, both read
 * from the row itself so this is race-free against `claim()`'s increment),
 * else `failed`. `last_error` is always persisted — it is the only forensic
 * record of what happened once the pipeline's own `DELETE FROM analyses`
 * (new-analysis failure path, owner ruling Q3) removes the analysis row.
 */
export async function markFailed(jobId: string, error: string, client: Client = db): Promise<void> {
  await client.execute({
    sql: `
      UPDATE jobs
      SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'failed' END,
          last_error = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `,
    args: [error, jobId],
  });
}

/**
 * Fetches jobs by id, single parameterised `SELECT ... WHERE id IN (...)`.
 * The placeholder list is built from `ids.length` — ids are always bound as
 * arguments, never string-interpolated into the SQL text.
 */
export async function getJobs(ids: string[], client: Client = db): Promise<JobRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const placeholders = ids.map(() => "?").join(", ");
  const result = await client.execute({
    sql: `SELECT * FROM jobs WHERE id IN (${placeholders})`,
    args: ids,
  });

  return result.rows.map((row) => mapRow(row as unknown as RawJobRow));
}
