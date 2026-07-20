export const DOWNLOAD_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export const DOWNLOAD_REFERER = "https://www.instagram.com/";

export const DOWNLOAD_TIMEOUT_MS = 120_000;

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
