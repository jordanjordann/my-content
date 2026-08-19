import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getInstagramPost } from "@/lib/server/scrapecreators/instagram";

/**
 * #254 §3.2 — `getInstagramPost()` must warn (never throw, per OR-25's no-retry
 * rule) when ScrapeCreators returns `success: true` alongside a non-empty
 * `errors` array. Driven entirely by a stubbed `fetch` — no network, no
 * credits.
 */

const ORIGINAL_KEY = process.env.SCRAPECREATORS_API_KEY;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  process.env.SCRAPECREATORS_API_KEY = "test-key-not-a-real-key";
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
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

describe("getInstagramPost — #254 §3.2 errors array observability", () => {
  it("warns once when the envelope carries a non-empty errors array alongside success: true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          success: true,
          credits_charged: 1,
          data: { xdt_shortcode_media: { id: "123", __typename: "XDTGraphVideo" } },
          errors: [
            {
              message: "execution error",
              path: ["xdt_shortcode_media", "location", "address_json"],
              severity: "ERROR",
            },
          ],
        }),
      ),
    );

    const envelope = await getInstagramPost("https://instagram.com/reel/abc/");

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(envelope.errors).toHaveLength(1);
  });

  it("does not warn when errors is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          success: true,
          data: { xdt_shortcode_media: { id: "123", __typename: "XDTGraphVideo" } },
        }),
      ),
    );

    await getInstagramPost("https://instagram.com/reel/abc/");

    expect(console.warn).not.toHaveBeenCalled();
  });

  it("does not warn when errors is an empty array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          success: true,
          data: { xdt_shortcode_media: { id: "123", __typename: "XDTGraphVideo" } },
          errors: [],
        }),
      ),
    );

    await getInstagramPost("https://instagram.com/reel/abc/");

    expect(console.warn).not.toHaveBeenCalled();
  });
});
