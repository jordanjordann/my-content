import {
  SC_BASE_URL,
  SC_ERROR_BODY_CAP_BYTES,
  SC_MAX_RETRIES,
  SC_RETRY_BASE_DELAY_MS,
  SC_RETRYABLE_STATUSES,
  SC_TIMEOUT_MS,
} from "@/lib/server/scrapecreators/constants";
import { mapStatusToMessage, ScrapeCreatorsError } from "@/lib/server/scrapecreators/errors";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(
  path: string,
  params: Record<string, string | boolean | undefined>,
): string {
  const url = new URL(path, SC_BASE_URL);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

async function readCappedBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.length > SC_ERROR_BODY_CAP_BYTES
      ? text.slice(0, SC_ERROR_BODY_CAP_BYTES)
      : text;
  } catch {
    return "";
  }
}

/**
 * Generic ScrapeCreators request. Owns auth, timeout, retry and error
 * mapping. Knows nothing about MediaMetadata or the database — callers in
 * lib/server/scrapecreators/instagram.ts return the raw payload untouched.
 *
 * The API key is read here, inside the function, rather than at module
 * scope, so a missing key throws a clear error at request time rather than
 * import time.
 */
export async function scRequest<T>(
  path: string,
  params: Record<string, string | boolean | undefined>,
): Promise<T> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;

  if (!apiKey) {
    throw new ScrapeCreatorsError("Missing SCRAPECREATORS_API_KEY", 500);
  }

  const url = buildUrl(path, params);
  // Logged for observability — never log headers, which is where the key lives.
  console.log(`[ScrapeCreators] GET ${path}`, params);

  let lastError: unknown;

  for (let attempt = 0; attempt <= SC_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(SC_TIMEOUT_MS),
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      const body = await readCappedBody(response);
      const isRetryable = (SC_RETRYABLE_STATUSES as readonly number[]).includes(
        response.status,
      );

      if (isRetryable && attempt < SC_MAX_RETRIES) {
        await sleep(SC_RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }

      throw new ScrapeCreatorsError(
        mapStatusToMessage(response.status, body),
        response.status,
        body,
      );
    } catch (error) {
      if (error instanceof ScrapeCreatorsError) {
        throw error;
      }

      // Network error, DNS failure, or AbortSignal.timeout() abort.
      lastError = error;

      if (attempt < SC_MAX_RETRIES) {
        await sleep(SC_RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }

      throw new ScrapeCreatorsError(mapStatusToMessage(0), 0);
    }
  }

  // Unreachable, but keeps TypeScript satisfied.
  throw new ScrapeCreatorsError(mapStatusToMessage(0), 0, String(lastError));
}
