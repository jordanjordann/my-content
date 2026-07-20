import { randomUUID } from "node:crypto";
import { db } from "@/lib/server/db";
import type { Profile, ProfileInput } from "@/lib/server/profiles/types";

function toBoolean(value: unknown): boolean {
  return Number(value) === 1;
}

function toNullableBoolInt(value: boolean | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  return value ? 1 : 0;
}

function mapRow(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    platform: row.platform as Profile["platform"],
    username: row.username as string,
    externalId: (row.external_id as string) ?? null,
    followerCount: row.follower_count == null ? null : Number(row.follower_count),
    followingCount: row.following_count == null ? null : Number(row.following_count),
    fullName: (row.full_name as string) ?? null,
    profilePicUrl: (row.profile_pic_url as string) ?? null,
    biography: (row.biography as string) ?? null,
    isVerified: toBoolean(row.is_verified),
    isBusinessAccount: toBoolean(row.is_business_account),
    isPrivate: toBoolean(row.is_private),
    rawPayload: (row.raw_payload as string) ?? null,
    lastFetchedAt: row.last_fetched_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getProfileByUsername(
  platform: ProfileInput["platform"],
  username: string,
): Promise<Profile | null> {
  const result = await db.execute({
    sql: "SELECT * FROM profiles WHERE platform = ? AND username = ? LIMIT 1",
    args: [platform, username],
  });

  const row = result.rows[0];
  return row ? mapRow(row as unknown as Record<string, unknown>) : null;
}

/**
 * Upserts on (platform, username). Every field is COALESCEd against the
 * existing row so a value absent from the new payload (e.g. a trimmed
 * owner hint that only carries the follower count) never wipes a
 * previously-known value from a fuller fetch.
 */
export async function upsertProfile(input: ProfileInput): Promise<Profile> {
  const id = randomUUID();

  const result = await db.execute({
    sql: `
      INSERT INTO profiles (
        id, platform, username, external_id, follower_count, following_count,
        full_name, profile_pic_url, biography, is_verified, is_business_account,
        is_private, raw_payload, last_fetched_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 0), COALESCE(?, 0), COALESCE(?, 0), ?, datetime('now'), datetime('now'), datetime('now'))
      ON CONFLICT(platform, username) DO UPDATE SET
        external_id          = COALESCE(excluded.external_id, profiles.external_id),
        follower_count       = COALESCE(excluded.follower_count, profiles.follower_count),
        following_count      = COALESCE(excluded.following_count, profiles.following_count),
        full_name            = COALESCE(excluded.full_name, profiles.full_name),
        profile_pic_url      = COALESCE(excluded.profile_pic_url, profiles.profile_pic_url),
        biography            = COALESCE(excluded.biography, profiles.biography),
        is_verified          = COALESCE(excluded.is_verified, profiles.is_verified),
        is_business_account  = COALESCE(excluded.is_business_account, profiles.is_business_account),
        is_private           = COALESCE(excluded.is_private, profiles.is_private),
        raw_payload          = COALESCE(excluded.raw_payload, profiles.raw_payload),
        last_fetched_at      = datetime('now'),
        updated_at           = datetime('now')
      RETURNING *
    `,
    args: [
      id,
      input.platform,
      input.username,
      input.externalId ?? null,
      input.followerCount ?? null,
      input.followingCount ?? null,
      input.fullName ?? null,
      input.profilePicUrl ?? null,
      input.biography ?? null,
      toNullableBoolInt(input.isVerified),
      toNullableBoolInt(input.isBusinessAccount),
      toNullableBoolInt(input.isPrivate),
      input.rawPayload ?? null,
    ],
  });

  const row = result.rows[0];
  if (!row) {
    // RETURNING should always yield the upserted row; fall back to a
    // read if a driver/version doesn't support RETURNING for some reason.
    const fallback = await getProfileByUsername(input.platform, input.username);
    if (!fallback) {
      throw new Error(`upsertProfile: failed to read back ${input.platform}/${input.username}`);
    }
    return fallback;
  }

  return mapRow(row as unknown as Record<string, unknown>);
}
