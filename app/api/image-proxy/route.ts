import type { IncomingMessage } from "node:http";
import { NextResponse, type NextRequest } from "next/server";
import { requestWithSsrfGuard } from "@/lib/server/net/hardenedRequest";
import {
  DOWNLOAD_USER_AGENT,
  DOWNLOAD_REFERER,
  IMAGE_PROXY_TIMEOUT_MS,
  MAX_REDIRECTS,
  MAX_IMAGE_PROXY_BYTES,
  IMAGE_PROXY_ALLOWED_HOSTS,
} from "@/lib/server/analysis/downloader/constants";
import { readCacheEntry, writeCacheEntry } from "@/lib/server/imageProxyCache";

export const runtime = "nodejs";

const DEFAULT_CONTENT_TYPE = "image/jpeg";
const CACHE_CONTROL_HEADER = "public, max-age=2592000, immutable"; // 30 days

class ImageTooLargeError extends Error {}

class HostNotAllowedError extends Error {}

function isAllowedImageHost(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase();
  return IMAGE_PROXY_ALLOWED_HOSTS.some(
    (allowedHost) => lowerHostname === allowedHost || lowerHostname.endsWith(`.${allowedHost}`),
  );
}

/**
 * Enforces the image-proxy host allowlist on a URL. Passed to
 * `requestWithSsrfGuard` as `validateUrl` so it runs on the entry URL AND
 * on every redirect hop's target — the SSRF guard alone only blocks
 * private/loopback addresses, it does not stop a redirect from an
 * allowlisted host to an arbitrary public one. Without re-checking on every
 * hop, an attacker-controlled (or compromised) redirect on an allowlisted
 * CDN host could smuggle in a response that then gets cached under the
 * original, allowlisted cache key.
 */
function assertAllowedImageHost(url: URL): void {
  if (!isAllowedImageHost(url.hostname)) {
    throw new HostNotAllowedError(`Host "${url.hostname}" is not on the image proxy allowlist.`);
  }
}

/**
 * Consumes an already-connected 2xx response into a buffer, enforcing
 * `MAX_IMAGE_PROXY_BYTES`. On overflow, destroys the response immediately
 * (rather than continuing to buffer) and rejects with
 * `ImageTooLargeError` — the caller must not cache a partial/oversized
 * body on this path.
 */
function bufferResponse(response: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytesReceived = 0;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      response.destroy();
      reject(error);
    };

    response.on("data", (chunk: Buffer) => {
      bytesReceived += chunk.length;
      if (bytesReceived > MAX_IMAGE_PROXY_BYTES) {
        fail(new ImageTooLargeError(`Image exceeded maximum size of ${MAX_IMAGE_PROXY_BYTES} bytes`));
        return;
      }
      chunks.push(chunk);
    });

    response.on("error", (error) => {
      fail(error instanceof Error ? error : new Error(String(error)));
    });

    response.on("end", () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(Buffer.concat(chunks));
    });
  });
}

export async function GET(request: NextRequest) {
  const targetUrlRaw = request.nextUrl.searchParams.get("url");

  if (!targetUrlRaw) {
    return NextResponse.json({ error: "Bad Request", message: "Missing url query param.", status: 400 }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(targetUrlRaw);
  } catch {
    return NextResponse.json({ error: "Bad Request", message: "Invalid url query param.", status: 400 }, { status: 400 });
  }

  if (targetUrl.protocol !== "https:") {
    return NextResponse.json(
      { error: "Bad Request", message: "Only https URLs are supported.", status: 400 },
      { status: 400 },
    );
  }

  if (!isAllowedImageHost(targetUrl.hostname)) {
    return NextResponse.json(
      { error: "Bad Request", message: "Host is not on the image proxy allowlist.", status: 400 },
      { status: 400 },
    );
  }

  const cacheUrl = targetUrl.toString();

  const cached = await readCacheEntry(cacheUrl);
  if (cached) {
    return new NextResponse(new Uint8Array(cached.bytes), {
      status: 200,
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": CACHE_CONTROL_HEADER,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  }

  let response: IncomingMessage;
  try {
    response = await requestWithSsrfGuard(cacheUrl, {
      headers: {
        "User-Agent": DOWNLOAD_USER_AGENT,
        Referer: DOWNLOAD_REFERER,
        Accept: "image/*",
      },
      maxRedirects: MAX_REDIRECTS,
      deadlineAt: Date.now() + IMAGE_PROXY_TIMEOUT_MS,
      validateUrl: assertAllowedImageHost,
    });
  } catch (error) {
    if (error instanceof HostNotAllowedError) {
      console.error(`[ImageProxy] Redirect off the host allowlist for ${cacheUrl}:`, error.message);
      return NextResponse.json(
        { error: "Bad Request", message: "Host is not on the image proxy allowlist.", status: 400 },
        { status: 400 },
      );
    }
    console.error(`[ImageProxy] Upstream fetch failed for ${cacheUrl}:`, error);
    return NextResponse.json(
      { error: "Bad Gateway", message: "Failed to fetch image from upstream.", status: 502 },
      { status: 502 },
    );
  }

  const contentType = response.headers["content-type"] || DEFAULT_CONTENT_TYPE;

  let bytes: Buffer;
  try {
    bytes = await bufferResponse(response);
  } catch (error) {
    if (error instanceof ImageTooLargeError) {
      return NextResponse.json(
        { error: "Payload Too Large", message: error.message, status: 413 },
        { status: 413 },
      );
    }
    console.error(`[ImageProxy] Upstream stream failed for ${cacheUrl}:`, error);
    return NextResponse.json(
      { error: "Bad Gateway", message: "Failed to read image from upstream.", status: 502 },
      { status: 502 },
    );
  }

  // Best-effort — a cache-write failure must never fail the response.
  void writeCacheEntry(cacheUrl, bytes, contentType);

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": CACHE_CONTROL_HEADER,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
