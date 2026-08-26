import { getInstagramProfile, getYoutubeChannel } from "@/lib/server/scrapecreators";
import {
  getProfileByUsername,
  recordProfileLookupFailure,
  upsertProfile,
} from "@/lib/server/profiles/repository";
import { isLookupFailureFresh, isStale } from "@/lib/server/profiles/helpers";
import { PROFILE_LOOKUP_FAILURE_RETRY_HOURS } from "@/lib/server/profiles/constants";
import type { Profile, ProfileInput, ProfilePlatform } from "@/lib/server/profiles/types";

export interface ResolveProfileOptions {
  platform: ProfilePlatform;
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
 * YouTube handles are renameable and can arrive with or without a leading
 * `@` (the video payload's `channel.handle` has none, but anything derived
 * from `channel.url` does). Normalise before using the handle as a cache key
 * or as the `/v1/youtube/channel` request param, so `@foo` and `foo` don't
 * become two `profiles` rows.
 */
function normalizeYoutubeHandle(handle: string): string {
  return handle.replace(/^@/, "").toLowerCase();
}

/**
 * `getInstagramProfile` + `data.user` unwrap, moved verbatim out of
 * `resolveProfile` so the fetch step can branch by platform.
 */
async function fetchInstagramProfileInput(username: string): Promise<ProfileInput> {
  const envelope = await getInstagramProfile(username);
  const raw = envelope.data?.user;

  if (!raw) {
    throw new Error(`ScrapeCreators returned no data.user for profile ${username}`);
  }

  return {
    platform: "instagram",
    username,
    externalId: raw.id != null ? String(raw.id) : null,
    followerCount: raw.edge_followed_by?.count ?? null,
    followingCount: raw.edge_follow?.count ?? null,
    fullName: raw.full_name ?? null,
    profilePicUrl: raw.profile_pic_url ?? null,
    biography: raw.biography ?? null,
    isVerified: raw.is_verified ?? null,
    isBusinessAccount: raw.is_business_account ?? null,
    isPrivate: raw.is_private ?? null,
    rawPayload: JSON.stringify(envelope),
  };
}

/**
 * `getYoutubeChannel(handle)`, mapping `subscriberCount` -> `followerCount`.
 * `followingCount`, `isBusinessAccount`, `isPrivate` stay null — YouTube has
 * no equivalent, and `toNullableBoolean` at the repository boundary
 * deliberately preserves "unknown" rather than coercing to `false`.
 *
 * Throws when the payload has no numeric `subscriberCount`, so the caller's
 * catch-and-return-stale path handles it rather than silently upserting a
 * null follower count.
 */
async function fetchYoutubeChannelInput(handle: string): Promise<ProfileInput> {
  const raw = await getYoutubeChannel(handle);

  if (typeof raw.subscriberCount !== "number") {
    throw new Error(`ScrapeCreators YouTube channel payload for ${handle} has no subscriberCount`);
  }

  // The committed fixtures (.claude/context/fixtures/scrapecreators-youtube/
  // yt_channel_*.json) carry no recommendation/video-list block equivalent
  // to /v1/youtube/video's `watchNextVideos` — the full channel payload is
  // small (social links, avatar/banner image metadata) and safe to persist
  // as-is. Verified against verified-facts.md; nothing to trim here.
  return {
    platform: "youtube",
    username: handle,
    externalId: raw.channelId ?? null,
    followerCount: raw.subscriberCount,
    followingCount: null,
    fullName: raw.name ?? null,
    // `avatar.image.sources` carries a single 68x68 entry in every observed
    // capture (see ScrapeCreatorsYoutubeChannelAvatar) — [0] is both the
    // first and only option. Missing avatar/sources is optional display
    // data, not required like subscriberCount, so fall back to null instead
    // of throwing.
    profilePicUrl: raw.avatar?.image?.sources?.[0]?.url ?? null,
    biography: raw.description ?? null,
    isVerified: raw.isVerified ?? null,
    isBusinessAccount: null,
    isPrivate: null,
    rawPayload: JSON.stringify(raw),
  };
}

/**
 * Cache-then-fetch profile resolution (FR-7), in this exact order:
 *   1. Cached row exists, carries no unresolved failure marker, and is
 *      fresh (< PROFILE_TTL_DAYS) -> return it, no API call.
 *   2. Else if the row's last lookup attempt FAILED and that failure is
 *      still within its short retry window
 *      (PROFILE_LOOKUP_FAILURE_RETRY_HOURS) -> return the cached row as-is,
 *      no API call. This is ticket #291's fix: without it, a channel whose
 *      lookup fails (e.g. YouTube hiding subscriberCount) re-spent a
 *      ScrapeCreators credit on every single analysis, forever, because no
 *      row was ever written to remember the failure.
 *   3. Else if the post payload's owner block already carried a follower
 *      count -> upsert from that hint and return, no API call (saves the
 *      Profile-endpoint credit — TDD §1.1.5). For YouTube this never fires:
 *      the video payload's `channel` block carries no subscriber count.
 *   4. Else fetch from the platform-specific endpoint, upsert (which also
 *      clears any prior failure marker), return.
 *   5. If step 4 throws -> log it (including a distinct, greppable
 *      "lookup_failure" line so a repeating leak is visible), record the
 *      failure via `recordProfileLookupFailure` so step 2 can short-circuit
 *      the next call, then return the stale cached row if one exists,
 *      otherwise null. A profile failure must never fail an analysis;
 *      engagement rate simply comes out NULL.
 */
export async function resolveProfile({
  platform,
  username,
  ownerHint,
}: ResolveProfileOptions): Promise<Profile | null> {
  const normalizedUsername = platform === "youtube" ? normalizeYoutubeHandle(username) : username;
  const cached = await getProfileByUsername(platform, normalizedUsername);

  if (cached) {
    if (!cached.lookupFailedAt && !isStale(cached.lastFetchedAt)) {
      return cached;
    }

    if (cached.lookupFailedAt && isLookupFailureFresh(cached.lookupFailedAt)) {
      return cached;
    }
  }

  if (ownerHintHasFollowerCount(ownerHint)) {
    return upsertProfile({
      platform,
      username: normalizedUsername,
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
    const input =
      platform === "instagram"
        ? await fetchInstagramProfileInput(normalizedUsername)
        : await fetchYoutubeChannelInput(normalizedUsername);

    return await upsertProfile(input);
  } catch (error) {
    console.error(`[Profiles] resolveProfile failed for ${platform}/${normalizedUsername}:`, error);
    // Ticket #291: a distinct, greppable line — separate from the message
    // above — so a repeating credit leak (the same channel failing on
    // every analysis) is visible to whoever is watching logs/metrics,
    // instead of silently recurring forever.
    console.error(
      `[Profiles] lookup_failure platform=${platform} username=${normalizedUsername} retry_after_hours=${PROFILE_LOOKUP_FAILURE_RETRY_HOURS}`,
    );

    // Code review on ticket #291: this write records the fact that the
    // lookup failed — it must never itself become a second, unhandled
    // failure that stops `return cached ?? null` below from running. A
    // profile failure (recording or fetching) must never fail an analysis
    // (same convention as the outer try/catch this is already inside).
    try {
      await recordProfileLookupFailure(platform, normalizedUsername);
    } catch (recordError) {
      console.error(
        `[Profiles] failed to record lookup failure for ${platform}/${normalizedUsername}:`,
        recordError,
      );
    }

    return cached ?? null;
  }
}
