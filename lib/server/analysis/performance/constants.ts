/**
 * Env-overridable named constants for the performance module (TDD §1.4,
 * ticket #140 step 1), in the manner already established for
 * `PROFILE_TTL_DAYS` (`lib/server/profiles/constants.ts`) and
 * `MAX_VIDEO_BYTES` (`lib/server/analysis/downloader/constants.ts`) —
 * RUNBOOK §3's audit rule.
 *
 * Caveat C1 (PRD §4.5) is explicit that 72h is an UNMEASURED GUESS, not a
 * validated threshold — it must stay a one-line tunable, never a hardcoded
 * literal buried in judgement.ts/computeBlock.ts (out of scope for this
 * ticket, but they will import this constant).
 */

const DEFAULT_MATURITY_FLOOR_HOURS = 72;

function resolveMaturityFloorHours(): number {
  const raw = process.env.PERFORMANCE_MATURITY_FLOOR_HOURS;
  if (raw === undefined || raw === "") {
    return DEFAULT_MATURITY_FLOOR_HOURS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid PERFORMANCE_MATURITY_FLOOR_HOURS env var: "${raw}" is not a positive finite number. ` +
        `Unset it to use the default (${DEFAULT_MATURITY_FLOOR_HOURS} hours) or provide a valid positive integer.`,
    );
  }

  return parsed;
}

/**
 * A post younger than this is `provisional` (TDD §4 confidence ladder /
 * PRD §4.5 point 2) and is excluded from Tier 2's age-bounded baseline
 * (PRD §4.5 point 3). Default `72`, override `PERFORMANCE_MATURITY_FLOOR_HOURS`.
 */
export const MATURITY_FLOOR_HOURS = resolveMaturityFloorHours();

const DEFAULT_BASELINE_MIN_SAMPLE = 5;

function resolveBaselineMinSample(): number {
  const raw = process.env.PERFORMANCE_BASELINE_MIN_SAMPLE;
  if (raw === undefined || raw === "") {
    return DEFAULT_BASELINE_MIN_SAMPLE;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    throw new Error(
      `Invalid PERFORMANCE_BASELINE_MIN_SAMPLE env var: "${raw}" is not a positive integer. ` +
        `Unset it to use the default (${DEFAULT_BASELINE_MIN_SAMPLE}) or provide a valid positive integer.`,
    );
  }

  return parsed;
}

/**
 * Minimum Tier 2 baseline sample size before confidence is demoted to
 * `LOW` (TDD §4 confidence ladder, `perf_confidence_reason = 'THIN_SAMPLE'`).
 * Also the numeral in the sub-threshold cold-start sentence (`3 of 5`) —
 * per OR-10 this constant is allow-listed, not stored per row. Default `5`,
 * override `PERFORMANCE_BASELINE_MIN_SAMPLE`.
 */
export const BASELINE_MIN_SAMPLE = resolveBaselineMinSample();
