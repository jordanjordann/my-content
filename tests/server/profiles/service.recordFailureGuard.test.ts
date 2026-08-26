import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Code review on ticket #291, medium issue: `resolveProfile`'s catch block
 * called `await recordProfileLookupFailure(...)` unguarded — if THAT write
 * itself throws (e.g. a transient DB error), the promised `return cached ??
 * null` never runs, and a profile failure (which must never fail an
 * analysis — see the surrounding try/catch's own doc comment) turns into an
 * unhandled rejection instead. `repository` is mocked here specifically so
 * `recordProfileLookupFailure` can be forced to reject without needing a
 * real DB failure mode.
 */

const getYoutubeChannelMock = vi.fn();
const getInstagramProfileMock = vi.fn();
const getProfileByUsernameMock = vi.fn();
const recordProfileLookupFailureMock = vi.fn();
const upsertProfileMock = vi.fn();

vi.mock("@/lib/server/scrapecreators", () => ({
  getYoutubeChannel: (...args: unknown[]) => getYoutubeChannelMock(...args),
  getInstagramProfile: (...args: unknown[]) => getInstagramProfileMock(...args),
}));

vi.mock("@/lib/server/profiles/repository", () => ({
  getProfileByUsername: (...args: unknown[]) => getProfileByUsernameMock(...args),
  recordProfileLookupFailure: (...args: unknown[]) => recordProfileLookupFailureMock(...args),
  upsertProfile: (...args: unknown[]) => upsertProfileMock(...args),
}));

beforeEach(() => {
  vi.resetModules();
  getYoutubeChannelMock.mockReset();
  getInstagramProfileMock.mockReset();
  getProfileByUsernameMock.mockReset();
  recordProfileLookupFailureMock.mockReset();
  upsertProfileMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveProfile — recordProfileLookupFailure write failure is swallowed, not thrown", () => {
  it("still returns cached ?? null when recording the failure itself rejects", async () => {
    getProfileByUsernameMock.mockResolvedValue(null);
    getYoutubeChannelMock.mockResolvedValue({ channelId: "UC_test", name: "Test Channel" }); // no subscriberCount -> throws
    recordProfileLookupFailureMock.mockRejectedValue(new Error("db unavailable"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { resolveProfile } = await import("@/lib/server/profiles/service");

    await expect(
      resolveProfile({ platform: "youtube", username: "@nocounthandle" }),
    ).resolves.toBeNull();

    expect(recordProfileLookupFailureMock).toHaveBeenCalledTimes(1);
    const loggedRecordFailure = consoleErrorSpy.mock.calls.some((call) =>
      String(call[0]).includes("failed to record lookup failure"),
    );
    expect(loggedRecordFailure).toBe(true);
  });
});
