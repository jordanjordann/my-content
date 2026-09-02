/** Reused verbatim from `validateUrl` so single-URL failures read identically on both the
 * Enter-key path and the paste path (ticket #285). */
export const INVALID_URL_MESSAGE = "Must be an Instagram Reel/Post or YouTube Short URL";

/** Summary shown when a paste rejects more than one URL. */
export function buildRejectedUrlsMessage(count: number): string {
  const noun = count === 1 ? "URL was" : "URLs were";
  return `${count} ${noun} not added — must be an Instagram Reel/Post or YouTube Short URL`;
}
