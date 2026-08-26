const DEFAULT_PROFILE_TTL_DAYS = 7;

function resolveProfileTtlDays(): number {
  const raw = process.env.PROFILE_TTL_DAYS;
  if (raw === undefined || raw === "") {
    return DEFAULT_PROFILE_TTL_DAYS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid PROFILE_TTL_DAYS env var: "${raw}" is not a positive finite number. ` +
        `Unset it to use the default (${DEFAULT_PROFILE_TTL_DAYS} days) or provide a valid positive integer.`,
    );
  }

  return parsed;
}

export const PROFILE_TTL_DAYS = resolveProfileTtlDays();

// Ticket #291: how long a FAILED profile lookup (e.g. a YouTube channel
// with no published subscriberCount) is cached before the next
// `resolveProfile` call is allowed to retry the platform endpoint. Kept far
// shorter than `PROFILE_TTL_DAYS` (7 days) on purpose — a channel that
// unhides its count, or a transient upstream error, should not be locked
// out of retrying for a week. This only throttles the repeat-credit-spend
// bug; it never blocks serving a still-valid cached success.
const DEFAULT_PROFILE_LOOKUP_FAILURE_RETRY_HOURS = 6;

function resolveProfileLookupFailureRetryHours(): number {
  const raw = process.env.PROFILE_LOOKUP_FAILURE_RETRY_HOURS;
  if (raw === undefined || raw === "") {
    return DEFAULT_PROFILE_LOOKUP_FAILURE_RETRY_HOURS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid PROFILE_LOOKUP_FAILURE_RETRY_HOURS env var: "${raw}" is not a positive finite number. ` +
        `Unset it to use the default (${DEFAULT_PROFILE_LOOKUP_FAILURE_RETRY_HOURS} hours) or provide a valid positive integer.`,
    );
  }

  return parsed;
}

export const PROFILE_LOOKUP_FAILURE_RETRY_HOURS = resolveProfileLookupFailureRetryHours();

// Ticket #291 code review, blocking issue 1: `profiles.last_fetched_at` is
// `NOT NULL DEFAULT (datetime('now'))` (migration 006) — additive-only
// migrations (this ticket's own convention) can't drop that constraint
// without a full-table rebuild, so `recordProfileLookupFailure`'s INSERT
// cannot simply omit the column and cannot bind NULL to it either. Instead
// it binds this fixed epoch sentinel explicitly on a row's FIRST failure
// (there is no real `profiles` row yet, so there is no real prior
// `last_fetched_at` to preserve). `isStale()` computes `Date.now() -
// epochMs`, which is always far past `PROFILE_TTL_DAYS`, so a first-failure
// row can never read as "fetched just now" — the exact bug this constant
// exists to close (a fresh-looking `last_fetched_at` on a row that has no
// real fetched data behind it, leaking into `audience_source_fetched_at` on
// any analysis of the same channel — `pipeline/index.ts`).
export const PROFILE_NEVER_FETCHED_SENTINEL = "1970-01-01 00:00:00";
