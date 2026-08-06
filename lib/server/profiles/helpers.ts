import { PROFILE_TTL_DAYS } from "@/lib/server/profiles/constants";

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
