/**
 * Abbreviates a non-negative count for compact display, e.g. `116333 -> "116.3K"`
 * (design §2/§5.2, "116.3K"). Moved here from
 * `AnalysisDetailModal/helpers.ts` (`formatViews`) per TDD §5.2 — this is now the
 * single shared abbreviation helper for every surface. Callers only ever pass the
 * `value` of an already-classified `count`/`plays` `CountState`, which is always a
 * real `number`, so there is no `null` branch here (unlike the old `formatViews`).
 */
export function formatAbbrev(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}
