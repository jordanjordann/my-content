import { PROFILE_LOOKUP_FAILURE_RETRY_HOURS, PROFILE_TTL_DAYS } from "@/lib/server/profiles/constants";

export function isStale(lastFetchedAt: string): boolean {
  const lastFetchedMs = new Date(`${lastFetchedAt.replace(" ", "T")}Z`).getTime();
  if (Number.isNaN(lastFetchedMs)) {
    // Unparseable timestamp is treated as stale — safer to refetch than to
    // trust cached data we can't validate the age of.
    return true;
  }

  const ttlMs = PROFILE_TTL_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - lastFetchedMs > ttlMs;
}

/**
 * Ticket #291: true while a previously-recorded lookup failure is still
 * "fresh" (within `PROFILE_LOOKUP_FAILURE_RETRY_HOURS`) — the negative-cache
 * window during which `resolveProfile` should skip re-calling the platform
 * endpoint rather than re-spending a credit on the same failure. Mirrors
 * `isStale`'s shape but is independent of it: this checks `lookup_failed_at`
 * against a short retry window, not `last_fetched_at` against the 7-day
 * `PROFILE_TTL_DAYS`.
 */
export function isLookupFailureFresh(lookupFailedAt: string): boolean {
  const failedMs = new Date(`${lookupFailedAt.replace(" ", "T")}Z`).getTime();
  if (Number.isNaN(failedMs)) {
    // Unparseable timestamp: don't let it block a retry.
    return false;
  }

  const retryWindowMs = PROFILE_LOOKUP_FAILURE_RETRY_HOURS * 60 * 60 * 1000;
  return Date.now() - failedMs < retryWindowMs;
}
