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
 * Retryable statuses (429/5xx) are deliberately untested here: `scRequest`
 * sleeps 1s then 2s between attempts and the delay is not injectable, so a
 * retry test would add ~3s of real wall time to every run. Making the backoff
 * injectable is a separate, non-blocking refactor.
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
