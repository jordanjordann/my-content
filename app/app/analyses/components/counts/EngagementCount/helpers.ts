/**
 * Abbreviates a non-negative integer count for compact display, e.g.
 * `116333 -> "116.3K"` (design §2/§5.2, "116.3K"). Moved here from
 * `AnalysisDetailModal/helpers.ts` (`formatViews`) per TDD §5.2 — this is now the
 * single shared abbreviation helper for every surface. Callers only ever pass the
 * `value` of an already-classified `count`/`plays` `CountState`, which is always a
 * real `number`, so there is no `null` branch here (unlike the old `formatViews`).
 *
 * Contract for out-of-shape input: `formatAbbrev` is only defined for non-negative
 * integers — the only shape the derivation layer ever produces. Negative numbers and
 * non-integers are explicitly out of contract; rather than throw or produce a
 * nonsensical abbreviation, both fall straight through to `toLocaleString()`
 * (e.g. `-5 -> "-5"`, `999.5 -> "999.5"`), so a contract violation degrades to a
 * readable string instead of crashing.
 */
export function formatAbbrev(count: number): string {
  if (!Number.isInteger(count) || count < 0) return count.toLocaleString();

  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }

  if (count >= 1_000) {
    const thousands = (count / 1_000).toFixed(1);
    // 999_950-999_999 round to "1000.0" at the K tier (e.g. 999_999 -> 999.999 ->
    // "1000.0"). Bump to M rather than shipping "1000.0K" — the abbreviated tier
    // boundary is meant to sit exactly at 1000, not leak past it as a rounding artifact.
    if (thousands === "1000.0") {
      return `${(count / 1_000_000).toFixed(1)}M`;
    }
    return `${thousands}K`;
  }

  return count.toLocaleString();
}
