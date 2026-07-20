import { getInstagramProfile } from "@/lib/server/scrapecreators";
import { getProfileByUsername, upsertProfile } from "@/lib/server/profiles/repository";
import { isStale } from "@/lib/server/profiles/helpers";
import type { Profile, ProfileInput } from "@/lib/server/profiles/types";

export interface ResolveProfileOptions {
  platform: "instagram";
  username: string;
  /** Owner block hint from the post payload, if any (TDD §1.1.5). */
  ownerHint?: Partial<ProfileInput> | null;
}

function ownerHintHasFollowerCount(
  ownerHint: ResolveProfileOptions["ownerHint"],
): ownerHint is Partial<ProfileInput> & { followerCount: number } {
  return typeof ownerHint?.followerCount === "number";
}

/**
 * Cache-then-fetch profile resolution (FR-7), in this exact order:
 *   1. Cached row exists and is fresh (< PROFILE_TTL_DAYS) -> return it,
 *      no API call.
 *   2. Else if the post payload's owner block already carried a follower
 *      count -> upsert from that hint and return, no API call (saves the
 *      Profile-endpoint credit — TDD §1.1.5).
 *   3. Else call GET /v1/instagram/profile, upsert, return.
 *   4. If step 3 throws -> log and return the stale cached row if one
 *      exists, otherwise null. A profile failure must never fail an
 *      analysis; engagement rate simply comes out NULL.
 */
export async function resolveProfile({
  platform,
  username,
  ownerHint,
}: ResolveProfileOptions): Promise<Profile | null> {
  const cached = await getProfileByUsername(platform, username);

  if (cached && !isStale(cached.lastFetchedAt)) {
    return cached;
  }

  if (ownerHintHasFollowerCount(ownerHint)) {
    return upsertProfile({
      platform,
      username,
      externalId: ownerHint.externalId,
      followerCount: ownerHint.followerCount,
      followingCount: ownerHint.followingCount,
      fullName: ownerHint.fullName,
      profilePicUrl: ownerHint.profilePicUrl,
      biography: ownerHint.biography,
      isVerified: ownerHint.isVerified,
      isBusinessAccount: ownerHint.isBusinessAccount,
      isPrivate: ownerHint.isPrivate,
    });
  }

  try {
    const raw = await getInstagramProfile(username);

    return await upsertProfile({
      platform,
      username,
      externalId: (raw.id ?? raw.pk) != null ? String(raw.id ?? raw.pk) : null,
      followerCount: raw.edge_followed_by?.count ?? raw.follower_count ?? null,
      followingCount: raw.edge_follow?.count ?? raw.following_count ?? null,
      fullName: raw.full_name ?? null,
      profilePicUrl: raw.profile_pic_url ?? null,
      biography: raw.biography ?? null,
      isVerified: raw.is_verified ?? null,
      isBusinessAccount: raw.is_business_account ?? null,
      isPrivate: raw.is_private ?? null,
      rawPayload: JSON.stringify(raw),
    });
  } catch (error) {
    console.error(`[Profiles] resolveProfile failed for ${platform}/${username}:`, error);
    return cached ?? null;
  }
}
