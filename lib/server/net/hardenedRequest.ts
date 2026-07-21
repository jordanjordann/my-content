import https from "node:https";
import type { IncomingMessage } from "node:http";
import { assertSafeUrl, pinnedLookup, type SafeAddress } from "@/lib/server/net/ssrfGuard";

export interface HardenedRequestOptions {
  headers: Record<string, string>;
  maxRedirects: number;
  /** Absolute deadline (`Date.now() + timeoutMs`), shared across all hops. */
  deadlineAt: number;
}

/**
 * Performs a single HTTP hop against an already-validated URL/address pair.
 * Resolves with the redirect Location header if the response is a
 * redirect, or with the live response stream (caller owns consumption) if
 * the response is a successful 2xx. Rejects on non-2xx/non-redirect status,
 * a missing Location header on a redirect, or a request/timeout error.
 */
function requestOnce(
  url: URL,
  safeAddress: SafeAddress,
  headers: Record<string, string>,
  deadlineAt: number,
): Promise<{ location: string } | { response: IncomingMessage }> {
  return new Promise((resolve, reject) => {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) {
      reject(new Error("Request timed out"));
      return;
    }

    const request = https.request(
      url,
      {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(remainingMs),
        // Pin the connection to the already-validated IP instead of letting
        // https.request re-resolve (and potentially rebind to) the
        // hostname. `servername` keeps SNI/cert verification and the Host
        // header on the original hostname so TLS and the CDN still work.
        lookup: pinnedLookup(safeAddress),
        servername: url.hostname,
      },
      (response) => {
        const status = response.statusCode ?? 0;

        if (status === 301 || status === 302 || status === 303 || status === 307 || status === 308) {
          const location = response.headers.location;
          response.resume(); // discard body
          if (!location) {
            reject(new Error("Redirect with no Location header"));
            return;
          }
          resolve({ location });
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`Request failed with status ${status}`));
          return;
        }

        resolve({ response });
      },
    );

    request.on("error", (error) => {
      reject(error instanceof Error ? error : new Error(String(error)));
    });

    request.end();
  });
}

/**
 * Fetches `url` through the hardened path: validate -> pin -> connect ->
 * follow-redirect (re-validating and re-pinning on every hop, capped at
 * `maxRedirects`), resolving with the final 2xx response stream. Rejects on
 * non-2xx status, exceeding the redirect cap, or timeout.
 *
 * The caller owns consuming the response body and enforcing any size cap —
 * this helper only establishes the connection safely.
 */
export async function requestWithSsrfGuard(
  url: string,
  { headers, maxRedirects, deadlineAt }: HardenedRequestOptions,
): Promise<IncomingMessage> {
  let currentUrl: URL;
  try {
    currentUrl = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  let safeAddress = await assertSafeUrl(currentUrl);

  let redirectCount = 0;

  while (true) {
    const result = await requestOnce(currentUrl, safeAddress, headers, deadlineAt);

    if ("response" in result) {
      return result.response;
    }

    redirectCount++;
    if (redirectCount > maxRedirects) {
      throw new Error(`Exceeded maximum redirects (${maxRedirects})`);
    }

    let nextUrl: URL;
    try {
      nextUrl = new URL(result.location, currentUrl);
    } catch {
      throw new Error(`Redirect target is not a valid URL: ${result.location}`);
    }

    // Re-validate AND re-pin on every hop — the redirect target is just as
    // attacker-influenceable as the original URL, and its DNS is an
    // independent rebinding opportunity.
    safeAddress = await assertSafeUrl(nextUrl);
    currentUrl = nextUrl;
  }
}
