import type { AnalysisPlatform } from "@/lib/api/analyses/types";

/** Lowercase, trim, and collapse whitespace runs to a single space. */
export function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Routes Instagram thumbnail URLs through the same-origin image proxy
 * (`/api/image-proxy`) to work around the Instagram/FB CDN's
 * Cross-Origin-Resource-Policy block on direct embedding. The proxy route
 * only allowlists IG/FB CDN hosts, so non-Instagram platforms (e.g.
 * YouTube) must be passed through unchanged — wrapping them would 400.
 */
export function toProxiedThumbnail(
  url: string | null,
  platform: AnalysisPlatform,
): string | null {
  if (!url) {
    return null;
  }

  if (platform !== "instagram") {
    return url;
  }

  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}
