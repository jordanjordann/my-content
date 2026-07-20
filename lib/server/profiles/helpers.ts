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

/**
 * (likes + comments) / followers, as a fraction (e.g. 0.0432), never a
 * percentage — formatting is a presentation concern per AGENTS.md.
 *
 * Returns null when followerCount is null or 0. Never divides by zero,
 * never coerces an unknown follower count to 0 — a real 0% engagement rate
 * and "we don't know the follower count" are different facts.
 */
export function computeEngagementRate({
  likeCount,
  commentCount,
  followerCount,
}: {
  likeCount: number | null | undefined;
  commentCount: number | null | undefined;
  followerCount: number | null | undefined;
}): number | null {
  if (followerCount == null || followerCount === 0) {
    return null;
  }

  const likes = likeCount ?? 0;
  const comments = commentCount ?? 0;

  return (likes + comments) / followerCount;
}
