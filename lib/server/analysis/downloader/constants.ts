export const DOWNLOAD_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export const DOWNLOAD_REFERER = "https://www.instagram.com/";

export const DOWNLOAD_TIMEOUT_MS = 120_000;

export const MAX_REDIRECTS = 3;

export const MAX_VIDEO_BYTES = process.env.MAX_VIDEO_BYTES
  ? Number(process.env.MAX_VIDEO_BYTES)
  : 524_288_000; // 500MB
