/**
 * Ticket #352 (3A-M1b, `docs/planning/PLAN-3A-job-queue.md` §4.2). Types for
 * the `jobs` table (migration `015_jobs.sql`, #351) — no caller yet.
 */

/** Mirrors the `jobs.kind` CHECK constraint. Only one kind exists today. */
export type JobKind = "analysis";

/** Mirrors the `jobs.status` CHECK constraint, in the order a healthy job moves through it. */
export type JobStatus = "queued" | "claimed" | "running" | "succeeded" | "failed" | "dead";

/**
 * Payload for `kind: "analysis"` jobs — the JSON blob stored in `jobs.payload`.
 * Mirrors `RunAnalysisOptions` (`lib/server/analysis/pipeline/index.ts`) minus
 * `onProgress`, which is a callback and cannot be serialised into a job row;
 * the worker (#355) supplies its own `onProgress` that writes through
 * `heartbeat()` instead.
 */
export interface AnalysisJobPayload {
  url: string;
  prompt: string;
  existingId?: string;
}

/** A `jobs` row, camelCased and with `payload` parsed back into `AnalysisJobPayload`. */
export interface JobRow {
  id: string;
  kind: JobKind;
  status: JobStatus;
  payload: AnalysisJobPayload;
  dedupeKey: string | null;
  attempts: number;
  maxAttempts: number;
  claimedAt: string | null;
  claimedBy: string | null;
  heartbeatAt: string | null;
  lastError: string | null;
  analysisId: string | null;
  progressStep: string | null;
  progressMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * `enqueue()`'s result. Discriminated on `outcome` so a caller can tell a
 * freshly-created row apart from one that was returned because
 * `idx_jobs_dedupe` rejected the insert (see `repository.ts`'s `enqueue`).
 */
export type EnqueueResult = { outcome: "created"; job: JobRow } | { outcome: "deduped"; job: JobRow };

/**
 * `claim()`'s result. `null` means the claim `UPDATE ... RETURNING *`
 * matched zero rows — nothing queued, not an error.
 */
export type ClaimResult = JobRow | null;
