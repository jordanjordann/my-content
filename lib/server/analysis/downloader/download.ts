import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import https from "node:https";
import { randomUUID } from "node:crypto";
import {
  DOWNLOAD_USER_AGENT,
  DOWNLOAD_REFERER,
  DOWNLOAD_TIMEOUT_MS,
  MAX_REDIRECTS,
  MAX_VIDEO_BYTES,
} from "@/lib/server/analysis/downloader/constants";

// --- SSRF guard -------------------------------------------------------

const PRIVATE_IPV4_RANGES: [base: string, prefix: number][] = [
  ["127.0.0.0", 8], // loopback
  ["10.0.0.0", 8], // private
  ["172.16.0.0", 12], // private
  ["192.168.0.0", 16], // private
  ["169.254.0.0", 16], // link-local
  ["0.0.0.0", 8], // "this network"
];

function ipv4ToInt(ip: string): number {
  return (
    ip
      .split(".")
      .reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
  );
}

function isIpv4InRange(ip: string, base: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

function isPrivateIpv4(ip: string): boolean {
  return PRIVATE_IPV4_RANGES.some(([base, prefix]) => isIpv4InRange(ip, base, prefix));
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (normalized === "::1") {
    return true; // loopback
  }

  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true; // fc00::/7 (unique local)
  }

  if (normalized.startsWith("fe80")) {
    return true; // link-local
  }

  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(mapped)) {
      return isPrivateIpv4(mapped);
    }
  }

  return false;
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  return ip.includes(":") ? isPrivateIpv6(ip) : isPrivateIpv4(ip);
}

/**
 * Rejects non-https URLs and hosts that resolve to a private/loopback/
 * link-local address. Must be called before connecting AND again on every
 * redirect hop, since the redirect target is just as attacker-influenceable
 * as the original URL.
 */
async function assertSafeUrl(url: URL): Promise<void> {
  if (url.protocol !== "https:") {
    throw new Error(`Refusing to download non-https URL (protocol: ${url.protocol})`);
  }

  let addresses: { address: string }[];
  try {
    addresses = await dns.promises.lookup(url.hostname, { all: true });
  } catch {
    throw new Error(`Could not resolve host: ${url.hostname}`);
  }

  if (addresses.length === 0) {
    throw new Error(`Could not resolve host: ${url.hostname}`);
  }

  for (const { address } of addresses) {
    if (isPrivateOrLoopbackIp(address)) {
      throw new Error(`Refusing to download from private/loopback host: ${url.hostname}`);
    }
  }
}

// --- download -----------------------------------------------------------

async function deletePartialFile(filePath: string): Promise<void> {
  await fs.promises.unlink(filePath).catch(() => {});
}

/**
 * Performs a single HTTP hop. Returns the redirect Location header if the
 * response is a redirect (without writing to the file), or `null` if the
 * body was fully streamed to `filePath`. Rejects on non-2xx/redirect
 * status, size-cap overflow, timeout, or stream errors — always cleaning
 * up any partial file on the reject path.
 */
function fetchOnce(url: URL, filePath: string, deadlineAt: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) {
      reject(new Error("Download timed out"));
      return;
    }

    const request = https.request(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": DOWNLOAD_USER_AGENT,
          Referer: DOWNLOAD_REFERER,
          Accept: "*/*",
        },
        signal: AbortSignal.timeout(remainingMs),
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
          resolve(location);
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`Download failed with status ${status}`));
          return;
        }

        const file = fs.createWriteStream(filePath);
        let bytesReceived = 0;
        let settled = false;

        const fail = (error: Error) => {
          if (settled) {
            return;
          }
          settled = true;
          request.destroy();
          response.destroy();
          file.close();
          void deletePartialFile(filePath).finally(() => reject(error));
        };

        response.on("data", (chunk: Buffer) => {
          bytesReceived += chunk.length;
          if (bytesReceived > MAX_VIDEO_BYTES) {
            fail(new Error(`Download exceeded maximum size of ${MAX_VIDEO_BYTES} bytes`));
          }
        });

        response.on("error", (error) => {
          fail(error instanceof Error ? error : new Error(String(error)));
        });

        file.on("error", (error) => {
          fail(error instanceof Error ? error : new Error(String(error)));
        });

        file.on("finish", () => {
          if (settled) {
            return;
          }
          settled = true;
          file.close();
          resolve(null);
        });

        response.pipe(file);
      },
    );

    request.on("error", (error) => {
      void deletePartialFile(filePath).finally(() =>
        reject(error instanceof Error ? error : new Error(String(error))),
      );
    });

    request.end();
  });
}

export async function downloadVideo(videoUrl: string): Promise<string> {
  let currentUrl: URL;
  try {
    currentUrl = new URL(videoUrl);
  } catch {
    throw new Error(`Invalid video URL: ${videoUrl}`);
  }

  await assertSafeUrl(currentUrl);

  const ext = path.extname(currentUrl.pathname) || ".mp4";
  const filePath = path.join("/tmp", `${randomUUID()}${ext}`);
  const deadlineAt = Date.now() + DOWNLOAD_TIMEOUT_MS;

  let redirectCount = 0;

  while (true) {
    const location = await fetchOnce(currentUrl, filePath, deadlineAt);

    if (location === null) {
      return filePath;
    }

    redirectCount++;
    if (redirectCount > MAX_REDIRECTS) {
      await deletePartialFile(filePath);
      throw new Error(`Exceeded maximum redirects (${MAX_REDIRECTS})`);
    }

    let nextUrl: URL;
    try {
      nextUrl = new URL(location, currentUrl);
    } catch {
      await deletePartialFile(filePath);
      throw new Error(`Redirect target is not a valid URL: ${location}`);
    }

    await assertSafeUrl(nextUrl);
    currentUrl = nextUrl;
  }
}
