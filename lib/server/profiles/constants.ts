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
