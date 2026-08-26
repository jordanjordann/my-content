BEGIN TRANSACTION;

-- Ticket #291: caches the FAILURE of a platform profile lookup (e.g. a
-- YouTube channel that doesn't publish `subscriberCount`), distinctly from
-- a successful row. Before this migration, `fetchYoutubeChannelInput`
-- throwing left `resolveProfile` with no row to write at all (`upsertProfile`
-- is never reached), so the next analysis of the same channel re-called
-- `/v1/youtube/channel` and re-failed the same way — one wasted
-- ScrapeCreators credit per analysis, forever, with no cap and no log.
--
-- Deliberately NOT the same shape as Instagram's `followerCount:
-- raw.edge_followed_by?.count ?? null` (a successful-but-unknown value
-- persisted with a fresh `last_fetched_at`, indistinguishable from real
-- data for the full 7-day `PROFILE_TTL_DAYS`). The ticket's own reviewer
-- (Leo) called that the weaker design: an unknown silently becomes a
-- "fact" with no visibility. `lookup_failed_at` instead marks a row as
-- "the last attempt to fetch this profile failed", checked against its own
-- short retry window (`PROFILE_LOOKUP_FAILURE_RETRY_HOURS`,
-- `lib/server/profiles/constants.ts`) independent of `last_fetched_at` /
-- `PROFILE_TTL_DAYS`. A successful fetch always clears it back to NULL
-- (`upsertProfile`'s ON CONFLICT branch), so it never lingers on a row that
-- has real, current data.
--
-- Additive only: a single nullable column with no default and no CHECK, so
-- a plain `ALTER TABLE ADD COLUMN` is safe here (no full-table rebuild
-- needed, unlike the `analyses` CHECK-constraint migrations at 009/012/013
-- — `profiles` carries no CHECK on this column). Existing rows read back as
-- NULL, i.e. "no known failure", which is the correct default and needs no
-- backfill.
ALTER TABLE profiles ADD COLUMN lookup_failed_at TEXT;

COMMIT;
