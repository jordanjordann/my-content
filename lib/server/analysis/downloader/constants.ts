export const DOWNLOAD_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export const DOWNLOAD_REFERER = "https://www.instagram.com/";

export const DOWNLOAD_TIMEOUT_MS = 120_000;

// Deliberately much shorter than DOWNLOAD_TIMEOUT_MS — thumbnail proxy
// requests are small, latency-sensitive (they block an <img> paint), and
// should fail fast rather than hold a request open for minutes.
export const IMAGE_PROXY_TIMEOUT_MS = 15_000;

export const MAX_REDIRECTS = 3;

const DEFAULT_MAX_VIDEO_BYTES = 524_288_000; // 500MB

function resolveMaxVideoBytes(): number {
  const raw = process.env.MAX_VIDEO_BYTES;
  if (raw === undefined || raw === "") {
    return DEFAULT_MAX_VIDEO_BYTES;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid MAX_VIDEO_BYTES env var: "${raw}" is not a positive finite number. ` +
        `Unset it to use the default (${DEFAULT_MAX_VIDEO_BYTES} bytes) or provide a valid positive integer.`,
    );
  }

  return parsed;
}

export const MAX_VIDEO_BYTES = resolveMaxVideoBytes();

const DEFAULT_MAX_IMAGE_PROXY_BYTES = 10_485_760; // 10MB

function resolveMaxImageProxyBytes(): number {
  const raw = process.env.MAX_IMAGE_PROXY_BYTES;
  if (raw === undefined || raw === "") {
    return DEFAULT_MAX_IMAGE_PROXY_BYTES;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid MAX_IMAGE_PROXY_BYTES env var: "${raw}" is not a positive finite number. ` +
        `Unset it to use the default (${DEFAULT_MAX_IMAGE_PROXY_BYTES} bytes) or provide a valid positive integer.`,
    );
  }

  return parsed;
}

export const MAX_IMAGE_PROXY_BYTES = resolveMaxImageProxyBytes();

/**
 * Hostnames allowed through the image proxy route (`app/api/image-proxy`):
 * Instagram/Facebook CDN hosts serving thumbnail bytes, and their
 * subdomains only. This is a separate, explicit control from the SSRF
 * guard — the SSRF guard blocks private/loopback targets regardless of
 * host, this allowlist additionally restricts *which public hosts* the
 * proxy will ever fetch from.
 */
export const IMAGE_PROXY_ALLOWED_HOSTS = ["cdninstagram.com", "fbcdn.net"] as const;
