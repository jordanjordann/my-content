/**
 * Builds the text for the bar's persistent `aria-live="polite"` region (TDD §7.4). Called from
 * render with already-settled `filteredCount`/`totalCount` — since those only change once the
 * memoized filter pass re-runs (immediately for checkbox toggles, after the 300ms debounce for
 * keyword edits), the region naturally announces once per settled state rather than per keystroke.
 */
export function buildResultCountAnnouncement(filteredCount: number, totalCount: number): string {
  if (filteredCount === 0 && totalCount > 0) {
    return `No results match your filters. Showing 0 of ${totalCount} analyses.`;
  }

  return `Showing ${filteredCount} of ${totalCount} analyses.`;
}
