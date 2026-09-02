/** Reused verbatim from `validateUrl` so single-URL failures read identically on both the
 * Enter-key path and the paste path (ticket #285). */
export const INVALID_URL_MESSAGE = "Must be an Instagram Reel/Post or YouTube Short URL";

/** Summary shown when a paste rejects more than one URL. */
export function buildRejectedUrlsMessage(count: number): string {
  const noun = count === 1 ? "URL was" : "URLs were";
  return `${count} ${noun} not added — must be an Instagram Reel/Post or YouTube Short URL`;
}

/** Ticket #322 — shown when a paste has more accepted URLs than remaining capacity.
 * `remaining` is the capacity available *before* the paste, i.e. how many of the accepted
 * URLs were actually added. Takes priority over `buildRejectedUrlsMessage`/`INVALID_URL_MESSAGE`
 * when both would otherwise apply — the cap is the harder stop. */
export function buildCapMessage(remaining: number, maxChips: number): string {
  return `Only ${remaining} more URL(s) can be added — maximum is ${maxChips}`;
}
