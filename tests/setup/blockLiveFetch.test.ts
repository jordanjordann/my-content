import { describe, expect, it, vi } from "vitest";

/**
 * Proves the global offline guard (`tests/setup/blockLiveFetch.ts`, wired via
 * `vitest.config.ts`'s `setupFiles`) actually works: an unstubbed `fetch`
 * call throws, naming the attempted URL, instead of silently reaching the
 * network. ScrapeCreators is credit-based and some endpoints charge even on
 * failure, so this is the test that makes the "offline by construction"
 * claim in `docs/RUNBOOK.md` §7 self-enforcing rather than a convention
 * every test file has to remember to follow.
 *
 * Deliberately does NOT stub `fetch` in the first test below — that omission
 * is exactly what this file is proving is unreachable.
 */
describe("global fetch guard (tests/setup/blockLiveFetch.ts)", () => {
  it("throws, naming the URL, when a test calls fetch() without stubbing it first", () => {
    const attemptedUrl = "https://api.scrapecreators.com/v1/youtube/video?url=live-call-attempt";

    expect(() => fetch(attemptedUrl)).toThrow(attemptedUrl);
  });

  it("still throws for a Request object input, naming its .url", () => {
    const request = new Request("https://api.scrapecreators.com/v1/youtube/channel?handle=x");

    expect(() => fetch(request)).toThrow(
      "https://api.scrapecreators.com/v1/youtube/channel?handle=x",
    );
  });

  it("lets a test opt in with its own fetch stub, overriding the guard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );

    const response = await fetch("https://api.scrapecreators.com/v1/youtube/video?url=stubbed");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("re-arms the guard for the next test even after a test opts out of it", () => {
    // No stubGlobal in this test — the guard installed by beforeEach must be back in force,
    // proving opting out in one test does not leak into the next.
    expect(() => fetch("https://api.scrapecreators.com/v1/youtube/video?url=should-still-block")).toThrow(
      /should-still-block/,
    );
  });
});
