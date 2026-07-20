export const SC_BASE_URL =
  process.env.SCRAPECREATORS_BASE_URL ?? "https://api.scrapecreators.com";

export const SC_PATHS = {
  post: "/v1/instagram/post",
  profile: "/v1/instagram/profile",
} as const;

export const SC_TIMEOUT_MS = 30_000;
export const SC_MAX_RETRIES = 2; // 3 attempts total
export const SC_RETRY_BASE_DELAY_MS = 1_000; // exponential: 1s, 2s
export const SC_RETRYABLE_STATUSES = [429, 500, 502, 503, 504] as const;

// Capped so a pathological upstream response can't be read into memory in full.
export const SC_ERROR_BODY_CAP_BYTES = 4_096;
