import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";

/**
 * Ticket #291: `resolveProfile` must cache a FAILED lookup (e.g. a YouTube
 * channel that doesn't publish `subscriberCount`) so the next call for the
 * same channel does not re-hit `/v1/youtube/channel` and re-spend a
 * ScrapeCreators credit. Real sqlite-file pattern (same as
 * `tests/server/analysis/performance/computeBlock.test.ts`) so this
 * exercises the actual `profiles` table and migration chain, not a mocked
 * `db.execute`.
 */

async function runMigrations(client: Client): Promise<void> {
  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await client.executeMultiple(readFileSync(join(migrationsDir, file), "utf8"));
  }
}

const getYoutubeChannelMock = vi.fn();
const getInstagramProfileMock = vi.fn();

vi.mock("@/lib/server/scrapecreators", () => ({
  getYoutubeChannel: (...args: unknown[]) => getYoutubeChannelMock(...args),
  getInstagramProfile: (...args: unknown[]) => getInstagramProfileMock(...args),
}));

let client: Client;
let dbPath: string;

beforeEach(async () => {
  vi.resetModules();
  getYoutubeChannelMock.mockReset();
  getInstagramProfileMock.mockReset();
  dbPath = join(tmpdir(), `profiles-service-${randomUUID()}.db`);
  process.env.TURSO_DATABASE_URL = `file:${dbPath}`;
  delete process.env.TURSO_AUTH_TOKEN;
  delete process.env.PROFILE_LOOKUP_FAILURE_RETRY_HOURS;
  const dbModule = await import("@/lib/server/db");
  client = dbModule.db;
  await runMigrations(client);
});

afterEach(() => {
  client?.close();
  vi.restoreAllMocks();
  delete process.env.PROFILE_LOOKUP_FAILURE_RETRY_HOURS;
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = `${dbPath}${suffix}`;
    if (existsSync(file)) {
      rmSync(file);
    }
  }
});

describe("resolveProfile — YouTube channel with no published subscriberCount (ticket #291)", () => {
  it("writes a profiles row on the FIRST failed lookup, instead of leaving no row at all", async () => {
    getYoutubeChannelMock.mockResolvedValue({ channelId: "UC_test", name: "Test Channel" });

    const { resolveProfile } = await import("@/lib/server/profiles/service");
    const result = await resolveProfile({ platform: "youtube", username: "@nocounthandle" });

    // Old bug: `cached ?? null` with no cache -> `null`, no row written.
    expect(result).toBeNull();

    const row = await client.execute({
      sql: "SELECT * FROM profiles WHERE platform = 'youtube' AND username = ?",
      args: ["nocounthandle"],
    });
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]!.follower_count).toBeNull();
    expect(row.rows[0]!.lookup_failed_at).not.toBeNull();
  });

  it("does NOT stamp last_fetched_at as fresh-right-now on the FIRST failure write (code review blocking issue 1)", async () => {
    // Migration 006: `last_fetched_at TEXT NOT NULL DEFAULT (datetime('now'))`.
    // Before the fix, `recordProfileLookupFailure`'s INSERT named only
    // `(id, platform, username, lookup_failed_at)`, leaving the unnamed
    // `last_fetched_at` column to silently take that default — a
    // first-failure row (no real fetch ever happened) would read back
    // exactly as fresh as a real, successful fetch made this second. This
    // leaks into `audience_source_fetched_at` on any analysis of the same
    // channel (`pipeline/index.ts`), recreating Instagram's
    // unknown-looks-like-fresh-real-data anti-pattern.
    getYoutubeChannelMock.mockResolvedValue({ channelId: "UC_test", name: "Test Channel" });

    const { resolveProfile } = await import("@/lib/server/profiles/service");
    await resolveProfile({ platform: "youtube", username: "@nocounthandle" });

    const row = await client.execute({
      sql: "SELECT last_fetched_at FROM profiles WHERE platform = 'youtube' AND username = ?",
      args: ["nocounthandle"],
    });

    const lastFetchedAt = row.rows[0]!.last_fetched_at as string;
    expect(lastFetchedAt).not.toBeNull();

    const ageMs = Date.now() - new Date(`${lastFetchedAt.replace(" ", "T")}Z`).getTime();
    // A "fresh-right-now" bug write would be a few ms old, not decades.
    // Assert it reads as far older than even the failure retry window
    // itself, so this can never be read as a real recent fetch.
    expect(ageMs).toBeGreaterThan(1000 * 60 * 60 * 24 * 365);
  });

  it("does NOT re-call getYoutubeChannel on a second resolveProfile within the failure retry window — the credit-spend fix", async () => {
    getYoutubeChannelMock.mockResolvedValue({ channelId: "UC_test", name: "Test Channel" });

    const { resolveProfile } = await import("@/lib/server/profiles/service");

    const first = await resolveProfile({ platform: "youtube", username: "@nocounthandle" });
    expect(first).toBeNull();
    expect(getYoutubeChannelMock).toHaveBeenCalledTimes(1);

    const second = await resolveProfile({ platform: "youtube", username: "@nocounthandle" });

    // Second call is served from the negative cache: no second network call.
    expect(getYoutubeChannelMock).toHaveBeenCalledTimes(1);
    // The cached (failed) row is returned rather than null, so callers can
    // still see whatever was last known about this channel.
    expect(second).not.toBeNull();
    expect(second?.followerCount).toBeNull();
  });

  it("retries after the failure retry window has elapsed", async () => {
    process.env.PROFILE_LOOKUP_FAILURE_RETRY_HOURS = "1";
    getYoutubeChannelMock.mockResolvedValue({ channelId: "UC_test", name: "Test Channel" });

    const { resolveProfile } = await import("@/lib/server/profiles/service");
    await resolveProfile({ platform: "youtube", username: "@nocounthandle" });
    expect(getYoutubeChannelMock).toHaveBeenCalledTimes(1);

    // Force the recorded failure to look old enough to retry.
    await client.execute({
      sql: "UPDATE profiles SET lookup_failed_at = ? WHERE platform = 'youtube' AND username = ?",
      args: ["2000-01-01 00:00:00", "nocounthandle"],
    });

    getYoutubeChannelMock.mockResolvedValue({ channelId: "UC_test", name: "Test Channel", subscriberCount: 42 });
    const second = await resolveProfile({ platform: "youtube", username: "@nocounthandle" });

    expect(getYoutubeChannelMock).toHaveBeenCalledTimes(2);
    expect(second?.followerCount).toBe(42);
  });

  it("clears the failure marker once a later fetch succeeds", async () => {
    getYoutubeChannelMock.mockResolvedValueOnce({ channelId: "UC_test", name: "Test Channel" });

    const { resolveProfile } = await import("@/lib/server/profiles/service");
    await resolveProfile({ platform: "youtube", username: "@nocounthandle" });

    // Move the failure outside the retry window so the next call actually
    // attempts a refetch.
    await client.execute({
      sql: "UPDATE profiles SET lookup_failed_at = ? WHERE platform = 'youtube' AND username = ?",
      args: ["2000-01-01 00:00:00", "nocounthandle"],
    });

    getYoutubeChannelMock.mockResolvedValueOnce({
      channelId: "UC_test",
      name: "Test Channel",
      subscriberCount: 9310,
    });
    const result = await resolveProfile({ platform: "youtube", username: "@nocounthandle" });

    expect(result?.followerCount).toBe(9310);
    expect(result?.lookupFailedAt).toBeNull();
  });

  it("logs a distinct, greppable lookup_failure line on failure", async () => {
    getYoutubeChannelMock.mockResolvedValue({ channelId: "UC_test", name: "Test Channel" });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { resolveProfile } = await import("@/lib/server/profiles/service");
    await resolveProfile({ platform: "youtube", username: "@nocounthandle" });

    const loggedLookupFailure = consoleErrorSpy.mock.calls.some((call) =>
      String(call[0]).includes("lookup_failure"),
    );
    expect(loggedLookupFailure).toBe(true);
  });
});

/**
 * Code review, medium issue: the reviewer's own hardcoded-value test
 * attempt survived a mutation that ignores `PROFILE_LOOKUP_FAILURE_RETRY_HOURS`
 * entirely — nothing proved the env var itself, not just the default, is
 * what gates the retry. Both tests below pin `lookup_failed_at` to the SAME
 * relative age (2 hours ago) and only vary the env var, so a mutation that
 * ignores the env var (falls back to the hardcoded 6h default) makes one of
 * these two tests fail: the override test expects a retry that a
 * default-6h read would still suppress.
 */
function hoursAgoTimestamp(hours: number): string {
  const date = new Date(Date.now() - hours * 60 * 60 * 1000);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

describe("PROFILE_LOOKUP_FAILURE_RETRY_HOURS — env override actually changes resolveProfile's retry decision", () => {
  it("with no override (default 6h), a failure 2 hours old is still within the window — no retry", async () => {
    delete process.env.PROFILE_LOOKUP_FAILURE_RETRY_HOURS;
    getYoutubeChannelMock.mockResolvedValue({ channelId: "UC_test", name: "Test Channel" });

    const { resolveProfile } = await import("@/lib/server/profiles/service");
    await resolveProfile({ platform: "youtube", username: "@nocounthandle" });
    expect(getYoutubeChannelMock).toHaveBeenCalledTimes(1);

    await client.execute({
      sql: "UPDATE profiles SET lookup_failed_at = ? WHERE platform = 'youtube' AND username = ?",
      args: [hoursAgoTimestamp(2), "nocounthandle"],
    });

    await resolveProfile({ platform: "youtube", username: "@nocounthandle" });
    expect(getYoutubeChannelMock).toHaveBeenCalledTimes(1);
  });

  it("with PROFILE_LOOKUP_FAILURE_RETRY_HOURS=1, that SAME 2-hour-old failure is outside the window — retries", async () => {
    process.env.PROFILE_LOOKUP_FAILURE_RETRY_HOURS = "1";
    getYoutubeChannelMock.mockResolvedValue({ channelId: "UC_test", name: "Test Channel" });

    const { resolveProfile } = await import("@/lib/server/profiles/service");
    await resolveProfile({ platform: "youtube", username: "@nocounthandle" });
    expect(getYoutubeChannelMock).toHaveBeenCalledTimes(1);

    await client.execute({
      sql: "UPDATE profiles SET lookup_failed_at = ? WHERE platform = 'youtube' AND username = ?",
      args: [hoursAgoTimestamp(2), "nocounthandle"],
    });

    await resolveProfile({ platform: "youtube", username: "@nocounthandle" });
    expect(getYoutubeChannelMock).toHaveBeenCalledTimes(2);
  });

  it("throws at module load for an invalid PROFILE_LOOKUP_FAILURE_RETRY_HOURS value", async () => {
    process.env.PROFILE_LOOKUP_FAILURE_RETRY_HOURS = "not-a-number";

    await expect(import("@/lib/server/profiles/constants")).rejects.toThrow(
      /Invalid PROFILE_LOOKUP_FAILURE_RETRY_HOURS/,
    );
  });
});

describe("resolveProfile — Instagram behaviour is unchanged (ticket #291 explicitly does not touch this path)", () => {
  it("still persists a successful-but-unknown follower count as real cached data (no failure marker)", async () => {
    getInstagramProfileMock.mockResolvedValue({
      data: { user: { id: "1", full_name: "Creator" } },
    });

    const { resolveProfile } = await import("@/lib/server/profiles/service");
    const result = await resolveProfile({ platform: "instagram", username: "creator" });

    expect(result?.followerCount).toBeNull();
    expect(result?.lookupFailedAt).toBeNull();
  });
});
