export type ProfilePlatform = "instagram" | "youtube";

export interface Profile {
  id: string;
  platform: ProfilePlatform;
  username: string;
  externalId: string | null;
  followerCount: number | null;
  followingCount: number | null;
  fullName: string | null;
  profilePicUrl: string | null;
  biography: string | null;
  isVerified: boolean | null;
  isBusinessAccount: boolean | null;
  isPrivate: boolean | null;
  rawPayload: string | null;
  /**
   * Timestamp of the most recent FAILED lookup attempt for this row, or
   * `null` if the last attempt (or the only attempt) succeeded. Cleared
   * back to `null` by any successful `upsertProfile` — see
   * `lib/server/profiles/repository.ts`. Checked against its own short
   * retry window (`PROFILE_LOOKUP_FAILURE_RETRY_HOURS`), independent of
   * `lastFetchedAt` / `PROFILE_TTL_DAYS` (ticket #291).
   */
  lookupFailedAt: string | null;
  lastFetchedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input to upsertProfile(). Fields absent from a given upsert call are
 * COALESCEd against the existing row at the repository boundary, rather
 * than wiping previously-known values — a payload that omits a field
 * (e.g. a trimmed profile hint from the post owner block) must not erase
 * data a prior fuller fetch already captured.
 */
export interface ProfileInput {
  platform: ProfilePlatform;
  username: string;
  externalId?: string | null;
  followerCount?: number | null;
  followingCount?: number | null;
  fullName?: string | null;
  profilePicUrl?: string | null;
  biography?: string | null;
  isVerified?: boolean | null;
  isBusinessAccount?: boolean | null;
  isPrivate?: boolean | null;
  rawPayload?: string | null;
}
