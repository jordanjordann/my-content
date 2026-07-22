import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scRequest } from "@/lib/server/scrapecreators/client";
import { ScrapeCreatorsError } from "@/lib/server/scrapecreators/errors";
import { SC_PATHS } from "@/lib/server/scrapecreators/constants";
import { loadJsonFixture, YOUTUBE_FIXTURES } from "@/tests/helpers/fixtures";

/**
 * `scRequest` transport behaviour, driven entirely by a stubbed `fetch` fed
 * with the committed real payloads. **No network, no credits.**
 *
 * The pin that matters: success/failure is decided by `response.ok`, never by
 * the body's `success` field — `/v1/youtube/channel` returns HTTP 404 with a
 * body that says `"success": true` (see verified-facts.md). If anyone ever
 * "fixes" the client to trust the body, these tests fail.
 *
 * Retryable statuses (429/5xx) ARE tested (see the "retry/backoff" describe
 * block below) using vitest fake timers, so the 1s/2s exponential backoff
 * runs in zero real wall time — no production code change was needed to make
 * this testable.
 */

const ORIGINAL_KEY = process.env.SCRAPECREATORS_API_KEY;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  process.env.SCRAPECREATORS_API_KEY = "test-key-not-a-real-key";
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (ORIGINAL_KEY === undefined) {
    delete process.env.SCRAPECREATORS_API_KEY;
  } else {
    process.env.SCRAPECREATORS_API_KEY = ORIGINAL_KEY;
  }
});

describe("scRequest", () => {
  it("returns the parsed body untouched on a 200", async () => {
    const fixture = loadJsonFixture<Record<string, unknown>>(YOUTUBE_FIXTURES.videoFresh);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(fixture, 200)),
    );

    const result = await scRequest<Record<string, unknown>>(SC_PATHS.youtubeVideo, {
      url: "https://www.youtube.com/shorts/tPEE9ZwTmy0",
    });

    expect(result).toEqual(fixture);
  });

  it("sends the API key as an x-api-key header and the params as query string", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: true }, 200));
    vi.stubGlobal("fetch", fetchMock);

    await scRequest(SC_PATHS.youtubeChannel, { handle: "hiddentracktv2", trim: undefined });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v1/youtube/channel");
    expect(url).toContain("handle=hiddentracktv2");
    // `undefined` params are dropped, not stringified to "undefined".
    expect(url).not.toContain("trim");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("test-key-not-a-real-key");
  });

  it("serialises boolean params (the Instagram client's trim=false)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: true }, 200));
    vi.stubGlobal("fetch", fetchMock);

    await scRequest(SC_PATHS.post, { url: "https://instagram.com/p/abc/", trim: false });

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("trim=false");
  });

  it("throws on a 404 even when the body claims success: true", async () => {
    const bogus = loadJsonFixture<Record<string, unknown>>(YOUTUBE_FIXTURES.channelBogus);
    expect(bogus.success).toBe(true); // the trap this test exists for
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(bogus, 404)),
    );

    await expect(
      scRequest(SC_PATHS.youtubeChannel, { handle: "thisdoesnotexist9999999xyz" }),
    ).rejects.toThrow(ScrapeCreatorsError);
  });

  it("maps a 404 to the not-found message and does not retry it", async () => {
    const deleted = loadJsonFixture<Record<string, unknown>>(YOUTUBE_FIXTURES.videoDeleted);
    const fetchMock = vi.fn(async () => jsonResponse(deleted, 404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      scRequest(SC_PATHS.youtubeVideo, { url: "https://www.youtube.com/shorts/aaaaaaaaaaa" }),
    ).rejects.toMatchObject({ status: 404, message: /not found/i });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps 401/403 to an auth message without leaking the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "unauthorized" }, 401)),
    );

    await expect(scRequest(SC_PATHS.youtubeVideo, { url: "x" })).rejects.toMatchObject({
      status: 401,
      message: "ScrapeCreators authentication failed. Check SCRAPECREATORS_API_KEY.",
    });
  });

  it("maps a private-account body to the private-content message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ is_private: true }, 400)),
    );

    await expect(scRequest(SC_PATHS.post, { url: "x" })).rejects.toMatchObject({
      message: "This content is private and cannot be analysed.",
    });
  });

  it("throws before making a request when the API key is missing", async () => {
    delete process.env.SCRAPECREATORS_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(scRequest(SC_PATHS.youtubeVideo, { url: "x" })).rejects.toMatchObject({
      status: 500,
      message: "Missing SCRAPECREATORS_API_KEY",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never logs the API key", async () => {
    const logMock = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ success: true }, 200)),
    );

    await scRequest(SC_PATHS.youtubeChannel, { handle: "hiddentracktv2" });

    const logged = logMock.mock.calls.map((call) => JSON.stringify(call)).join(" ");
    expect(logged).not.toContain("test-key-not-a-real-key");
  });
});

/**
 * Retry/backoff, exercised with vitest fake timers.
 *
 * `scRequest` sleeps `SC_RETRY_BASE_DELAY_MS * 2 ** attempt` (1s, then 2s)
 * between retryable-status attempts. Faking `setTimeout`/`clearTimeout` lets
 * these tests drive that backoff to completion in ~0 real wall time, with no
 * change to `scRequest` itself — the delay does not need to be made
 * injectable to be tested.
 */
describe("scRequest — retry/backoff (fake timers)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries a 503 with 1s then 2s exponential backoff before succeeding on the 3rd attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 503))
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 503))
      .mockResolvedValueOnce(jsonResponse({ success: true }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const wallClockStart = performance.now();
    const resultPromise = scRequest<Record<string, unknown>>(SC_PATHS.youtubeVideo, { url: "x" });

    // First attempt happens synchronously-ish; only two backoff sleeps stand between
    // it and success (3 attempts total, SC_MAX_RETRIES = 2).
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(2_000);

    const result = await resultPromise;

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // Real wall time barely moved — this is fake timers, not a live ~3s sleep.
    expect(performance.now() - wallClockStart).toBeLessThan(1_000);
  });

  it("gives up after SC_MAX_RETRIES retries (3 attempts total) and throws the mapped error", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "boom" }, 503));
    vi.stubGlobal("fetch", fetchMock);

    const assertion = expect(
      scRequest(SC_PATHS.youtubeVideo, { url: "x" }),
    ).rejects.toMatchObject({ status: 503 });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(2_000);
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not sleep before retrying — a non-retryable 404 fails on the first attempt", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "not_found" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(scRequest(SC_PATHS.youtubeVideo, { url: "x" })).rejects.toMatchObject({
      status: 404,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
