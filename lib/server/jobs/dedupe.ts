import { createHash } from "node:crypto";

/**
 * Ticket #352 (3A-M1b, plan §10.1/S6). Pure, no DB — the dedupe key that
 * `idx_jobs_dedupe` (`015_jobs.sql`) partially-uniques on.
 *
 * Stable hash of a prompt string. An empty prompt is a real, distinct
 * input (not "no prompt") and hashes like any other string — never
 * special-cased to a sentinel. sha256/hex for a fixed-length, collision-safe
 * key component; not a security boundary, just a stable digest.
 */
export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

/**
 * Builds the dedupe key stored in `jobs.dedupe_key`.
 *
 * `normalisedUrl` MUST already be the output of `normaliseAnalysisUrl()`
 * (`lib/server/analysis/classifier/rules.ts`, #350) — never a raw user URL.
 * Two URLs that normalise to the same canonical string (trailing slash,
 * `?utm_source=`, `?igsh=`, etc.) must collapse to one dedupe key, or the
 * partial unique index looks like it is protecting against double-spend
 * while silently doing nothing (plan R5 / TR-1).
 *
 * `promptHash` is `hashPrompt(prompt)` above — different prompts against the
 * same URL are deliberately different jobs.
 */
export function buildDedupeKey(normalisedUrl: string, promptHash: string): string {
  return `${normalisedUrl}::${promptHash}`;
}
