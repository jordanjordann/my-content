/**
 * Pure focus-trap arithmetic for the rail's `Tab`/`Shift+Tab` cycling while
 * `EXPANDED` (TDD #284 §5.4). Kept free of the DOM so it is unit-testable
 * with plain arrays: no `render`, no `fireEvent`, no `document`.
 *
 * `focusables` is the ordered list of tab-stops inside the rail (toggle +
 * nav links). `activeIndex` is the index of `document.activeElement` within
 * that list, or `-1` when the active element is not one of the tracked
 * focusables (e.g. focus landed on the `<aside>` container itself, or on
 * some other element inside the trap that isn't `button`/`a[href]`). `-1` is
 * force-wrapped rather than treated as "no wrap needed" — letting the
 * browser's default `Tab` behaviour run from an untracked active element is
 * exactly how focus escapes the dialog.
 *
 * Returns the element focus should wrap to, or `null` when the browser's
 * default `Tab` behaviour already lands on a valid in-trap target and no
 * wrap is needed.
 */
export function getTrapFocusTarget(
  focusables: HTMLElement[],
  activeIndex: number,
  shiftKey: boolean,
): HTMLElement | null {
  if (focusables.length === 0) {
    return null;
  }

  const lastIndex = focusables.length - 1;

  if (activeIndex === -1) {
    return shiftKey ? focusables[lastIndex] : focusables[0];
  }

  if (shiftKey) {
    // Shift+Tab off the first element wraps to the last.
    if (activeIndex === 0) {
      return focusables[lastIndex];
    }
    return null;
  }

  // Tab off the last element wraps to the first.
  if (activeIndex === lastIndex) {
    return focusables[0];
  }
  return null;
}
