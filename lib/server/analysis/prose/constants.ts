/**
 * TDD §8.2. The allow-listed Indonesian denominator phrases a qualified
 * percentage must be near (R-12.5.1/R-12.5.2/R-12.5.4). Kept verbatim as the
 * TDD states them (with the `…` placeholder marking where the figure
 * itself goes) — `keywordOf()` below derives the actual matched substring
 * from each entry, so there is exactly one list, never a second hand-typed
 * keyword array that could drift from this one.
 */
export const DENOMINATOR_PHRASES_ID = [
  "dari … penayangan", // reach / views
  "dari … tayangan", // reach / views
  "dari … yang menonton", // reach / plays
  "dari … pengikut", // followers
  "dari jumlah pengikut", // followers
] as const;

/**
 * The window (characters, on each side of a percentage token) a
 * denominator keyword must fall within for `assertQualifiedPercentages` to
 * accept the percentage as qualified (TDD §8.2: "within 40 characters").
 */
export const DENOMINATOR_WINDOW_CHARS = 40;

/**
 * Derives the actual noun/phrase to search for from a
 * `DENOMINATOR_PHRASES_ID` entry, by stripping the leading `"dari … "` /
 * `"dari jumlah "` templating — the SAME list drives both the documentation
 * (the exact TDD-quoted strings) and the runtime match (the keyword), so
 * there is one list to keep in sync, not two.
 */
export function keywordOf(phrase: string): string {
  return phrase.replace(/^dari (jumlah )?…?\s*/i, "").trim();
}

export const DENOMINATOR_KEYWORDS_ID = DENOMINATOR_PHRASES_ID.map(keywordOf);
