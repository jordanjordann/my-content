/**
 * #313 / #280 — how long a `pending` analysis row is allowed to sit before
 * the boot-time reaper marks it `failed`.
 *
 * A single analysis takes 45-73s measured. The batch loop in
 * `app/api/analyze/route.ts` is strictly sequential (`for (const [index, url]
 * of urls.entries())` with `await runAnalysis(...)` inside), so a healthy
 * row's `pending` window is bounded by ONE analysis, never the whole batch's
 * 7-18 minutes — reasoning from the batch duration would size this wrong in
 * both directions.
 *
 * 30 minutes is ~25x the observed p100 and comfortably clears the
 * code-derived pathological ceiling (DOWNLOAD_TIMEOUT_MS = 120_000 per
 * download, pollUntilReady maxAttempts = 30, TITLE_TIMEOUT_MS = 15_000).
 *
 * This threshold is a margin, not the primary correctness mechanism: a
 * freshly booted process has no in-flight analyses of its own, so any
 * `pending` row it sees was written by a process that is gone. The age
 * check only protects against a previous instance still draining during a
 * rolling restart.
 *
 * REVISIT TRIGGER: if #279 ever makes batches parallel or moves them to a
 * background worker, a row's pending window stops being bounded by one
 * analysis and this number must be re-derived.
 */
export const STRANDED_PENDING_THRESHOLD_MINUTES = 30;
