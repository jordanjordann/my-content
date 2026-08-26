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
