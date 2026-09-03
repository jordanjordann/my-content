import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Round-three fix for issue #283 (P2 gap found in round-two review of
 * PR #333): `app/api/image-proxy/route.ts` is excluded from the site-wide
 * `headers()` rule in `next.config.ts` because it sets its own tighter
 * `Content-Security-Policy: default-src 'none'` + `X-Content-Type-Options:
 * nosniff` — but that was only true on the binary success branches. Every
 * JSON error branch came back with NO security headers at all.
 *
 * This file pins the LITERAL header values (not just presence) on every
 * exit path the route has: 4x 400, 2x 502, 1x 413, and both 200 success
 * branches (cache hit + fresh fetch). Uses paired/indexed assertions
 * (`headers.map(...)` against an ordered/keyed expectation, mirroring
 * `tests/config/nextConfigHeaders.test.ts`) rather than independent
 * "X exists" / "Y exists" checks, per the repo's mutation-review playbook
 * form 14 — a mutant that drops one header while leaving the other could
 * otherwise sneak past two independent assertions.
 */

const { readCacheEntryMock, writeCacheEntryMock, requestWithSsrfGuardMock } = vi.hoisted(() => ({
  readCacheEntryMock: vi.fn(),
  writeCacheEntryMock: vi.fn(),
  requestWithSsrfGuardMock: vi.fn(),
}));

vi.mock("@/lib/server/imageProxyCache", () => ({
  readCacheEntry: readCacheEntryMock,
  writeCacheEntry: writeCacheEntryMock,
}));

vi.mock("@/lib/server/net/hardenedRequest", () => ({
  requestWithSsrfGuard: requestWithSsrfGuardMock,
}));

const ALLOWED_URL = "https://x.cdninstagram.com/img.jpg";
const DISALLOWED_URL = "https://evil.example.com/img.jpg";

/** Expected security headers on every response this route returns, keyed exactly. */
const EXPECTED_SECURITY_HEADERS: [string, string][] = [
  ["X-Content-Type-Options", "nosniff"],
  ["Content-Security-Policy", "default-src 'none'"],
];

function assertSecurityHeaders(response: Response): void {
  for (const [key, value] of EXPECTED_SECURITY_HEADERS) {
    expect(response.headers.get(key)).toBe(value);
  }
}

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost/api/image-proxy?url=${encodeURIComponent(url)}`);
}

type FakeUpstreamResponse = EventEmitter & Pick<IncomingMessage, "headers"> & { destroy: ReturnType<typeof vi.fn> };

function makeFakeUpstreamResponse(): FakeUpstreamResponse {
  const emitter = new EventEmitter() as FakeUpstreamResponse;
  emitter.headers = { "content-type": "image/png" };
  emitter.destroy = vi.fn();
  return emitter;
}

beforeEach(() => {
  readCacheEntryMock.mockReset();
  writeCacheEntryMock.mockReset();
  writeCacheEntryMock.mockResolvedValue(undefined);
  requestWithSsrfGuardMock.mockReset();
});

describe("GET /api/image-proxy — security headers on every exit path (#283 round 3)", () => {
  it("400: missing url query param carries the route's security headers", async () => {
    const { GET } = await import("@/app/api/image-proxy/route");
    // Missing param: no `url` in the query string at all.
    const req = new NextRequest("http://localhost/api/image-proxy");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "Bad Request", message: "Missing url query param.", status: 400 });
    assertSecurityHeaders(res);
    expect(requestWithSsrfGuardMock).not.toHaveBeenCalled();
  });

  it("400: invalid url query param carries the route's security headers", async () => {
    const { GET } = await import("@/app/api/image-proxy/route");
    const res = await GET(makeRequest("not-a-url"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "Bad Request", message: "Invalid url query param.", status: 400 });
    assertSecurityHeaders(res);
  });

  it("400: non-https url carries the route's security headers", async () => {
    const { GET } = await import("@/app/api/image-proxy/route");
    const res = await GET(makeRequest("http://x.cdninstagram.com/img.jpg"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "Bad Request", message: "Only https URLs are supported.", status: 400 });
    assertSecurityHeaders(res);
  });

  it("400: disallowed host carries the route's security headers", async () => {
    const { GET } = await import("@/app/api/image-proxy/route");
    const res = await GET(makeRequest(DISALLOWED_URL));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: "Bad Request",
      message: "Host is not on the image proxy allowlist.",
      status: 400,
    });
    assertSecurityHeaders(res);
  });

  it("400: redirect off the allowlist (HostNotAllowedError from requestWithSsrfGuard) carries the route's security headers", async () => {
    readCacheEntryMock.mockResolvedValue(null);
    requestWithSsrfGuardMock.mockImplementation(
      async (_url: string, options: { validateUrl?: (url: URL) => void }) => {
        // Simulate the SSRF-guard machinery invoking the caller-supplied
        // validateUrl on a redirect hop that lands off the allowlist —
        // this is exactly how the route's own HostNotAllowedError branch
        // gets exercised in production.
        options.validateUrl?.(new URL(DISALLOWED_URL));
        throw new Error("unreachable");
      },
    );

    const { GET } = await import("@/app/api/image-proxy/route");
    const res = await GET(makeRequest(ALLOWED_URL));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: "Bad Request",
      message: "Host is not on the image proxy allowlist.",
      status: 400,
    });
    assertSecurityHeaders(res);
  });

  it("502: upstream fetch failure carries the route's security headers", async () => {
    readCacheEntryMock.mockResolvedValue(null);
    requestWithSsrfGuardMock.mockRejectedValue(new Error("connection reset"));

    const { GET } = await import("@/app/api/image-proxy/route");
    const res = await GET(makeRequest(ALLOWED_URL));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({
      error: "Bad Gateway",
      message: "Failed to fetch image from upstream.",
      status: 502,
    });
    assertSecurityHeaders(res);
  });

  it("413: oversized upstream body carries the route's security headers", async () => {
    vi.stubEnv("MAX_IMAGE_PROXY_BYTES", "10");
    vi.resetModules();
    readCacheEntryMock.mockReset();
    readCacheEntryMock.mockResolvedValue(null);
    requestWithSsrfGuardMock.mockReset();

    const fakeResponse = makeFakeUpstreamResponse();
    requestWithSsrfGuardMock.mockResolvedValue(fakeResponse);

    const { GET } = await import("@/app/api/image-proxy/route");
    const responsePromise = GET(makeRequest(ALLOWED_URL));

    await vi.waitFor(() => expect(fakeResponse.listenerCount("data")).toBeGreaterThan(0));
    fakeResponse.emit("data", Buffer.alloc(20, 1));

    const res = await responsePromise;
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("Payload Too Large");
    expect(body.status).toBe(413);
    assertSecurityHeaders(res);
    expect(fakeResponse.destroy).toHaveBeenCalledTimes(1);
  });

  it("502: upstream stream error carries the route's security headers", async () => {
    readCacheEntryMock.mockResolvedValue(null);
    const fakeResponse = makeFakeUpstreamResponse();
    requestWithSsrfGuardMock.mockResolvedValue(fakeResponse);

    const { GET } = await import("@/app/api/image-proxy/route");
    const responsePromise = GET(makeRequest(ALLOWED_URL));

    await vi.waitFor(() => expect(fakeResponse.listenerCount("error")).toBeGreaterThan(0));
    fakeResponse.emit("error", new Error("stream broke"));

    const res = await responsePromise;
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({
      error: "Bad Gateway",
      message: "Failed to read image from upstream.",
      status: 502,
    });
    assertSecurityHeaders(res);
  });

  it("200: cache hit still carries the same security headers as before", async () => {
    readCacheEntryMock.mockResolvedValue({
      bytes: Buffer.from("cached-bytes"),
      contentType: "image/webp",
    });

    const { GET } = await import("@/app/api/image-proxy/route");
    const res = await GET(makeRequest(ALLOWED_URL));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    assertSecurityHeaders(res);
    expect(requestWithSsrfGuardMock).not.toHaveBeenCalled();
  });

  it("200: fresh upstream fetch still carries the same security headers as before", async () => {
    readCacheEntryMock.mockResolvedValue(null);
    const fakeResponse = makeFakeUpstreamResponse();
    requestWithSsrfGuardMock.mockResolvedValue(fakeResponse);

    const { GET } = await import("@/app/api/image-proxy/route");
    const responsePromise = GET(makeRequest(ALLOWED_URL));

    await vi.waitFor(() => expect(fakeResponse.listenerCount("end")).toBeGreaterThan(0));
    fakeResponse.emit("data", Buffer.from("fresh-bytes"));
    fakeResponse.emit("end");

    const res = await responsePromise;
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    assertSecurityHeaders(res);
    expect(writeCacheEntryMock).toHaveBeenCalledTimes(1);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
