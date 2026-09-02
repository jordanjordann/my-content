const MAX_LENGTH = 60;

/**
 * Ticket #289 (TDD §4.3) — presentation formatting for a failed URL in the progress panel's
 * failure list. Returns `host + pathname`, truncated to 60 chars, so the user can identify
 * which URL failed without a bare path (ambiguous) or the full querystring (noisy).
 *
 * Deliberately separate from `UrlChipInput`'s `shortenUrl` (which returns pathname only) — a
 * bare `/shorts/xyz` with no host is ambiguous in a failure list. No cross-module imports.
 *
 * Falls back to the raw string, unchanged, if `new URL()` throws.
 */
export function formatFailedUrl(url: string): string {
  let formatted: string;
  try {
    const parsed = new URL(url);
    formatted = `${parsed.host}${parsed.pathname}`;
  } catch {
    formatted = url;
  }

  return formatted.length > MAX_LENGTH ? `${formatted.slice(0, MAX_LENGTH)}...` : formatted;
}
