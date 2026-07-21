import { IMAGE_PROXY_CACHE_TTL_DAYS } from "@/lib/server/imageProxyCache/constants";

/** Mirrors `lib/server/profiles/helpers.ts`'s `isStale()` TTL check. */
export function isStale(fetchedAt: string): boolean {
  const fetchedAtMs = new Date(fetchedAt).getTime();
  if (Number.isNaN(fetchedAtMs)) {
    // Unparseable timestamp is treated as stale — safer to refetch than to
    // trust cached data we can't validate the age of.
    return true;
  }

  const ttlMs = IMAGE_PROXY_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - fetchedAtMs > ttlMs;
}
