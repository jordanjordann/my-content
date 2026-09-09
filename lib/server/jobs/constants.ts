/**
 * Ticket #352 (3A-M1b). All named exports so tests can pin them instead of
 * hardcoding numbers (#313 precedent — see `lib/server/analysis/reaper/constants.ts`).
 */

/**
 * How often the worker (#355) writes a `heartbeat_at` on the job it is
 * currently running. `reaper.ts` (#353) uses this, scaled by
 * `STALE_JOB_MULTIPLIER`, to decide a `claimed`/`running` job has been
 * abandoned.
 */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * The multiple of `HEARTBEAT_INTERVAL_MS` after which a `claimed`/`running`
 * job with no recent heartbeat is considered abandoned by the jobs reaper
 * (#353). 3x gives a worker two missed heartbeats of grace (a GC pause, a
 * slow write) before it is reaped — one miss alone is too eager to
 * distinguish from ordinary jitter.
 */
export const STALE_JOB_MULTIPLIER = 3;

/**
 * The derived stale-job threshold, in milliseconds. Deliberately computed
 * from `HEARTBEAT_INTERVAL_MS` * `STALE_JOB_MULTIPLIER` rather than written
 * as a second literal — the two knobs must never drift apart from what this
 * value actually is.
 */
export const STALE_JOB_THRESHOLD_MS = HEARTBEAT_INTERVAL_MS * STALE_JOB_MULTIPLIER;

/** How often the worker (#355) polls `jobs` for a new row to claim when idle. */
export const POLL_INTERVAL_MS = 2_000;

/**
 * Owner ruling 2026-09-09 (plan Q1/R3): every attempt of an `analysis` job
 * spends real ScrapeCreators + Gemini credits, and there is no
 * `credits_charged` tracking to notice a wasted retry. `enqueue()` must use
 * this as its default `maxAttempts` for `kind: "analysis"` jobs — never a
 * value above it — matching `015_jobs.sql`'s own `max_attempts` column
 * default of `1`. Multi-attempt retry is a documented FUTURE prerequisite
 * gated on spend tracking; it is not part of 3A. Do NOT implement backoff,
 * jitter, or multi-attempt scheduling against this constant.
 */
export const ANALYSIS_MAX_ATTEMPTS = 1;
