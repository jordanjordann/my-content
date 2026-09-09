/**
 * Media query the `<aside>`'s dialog role/`inert`/focus-trap semantics are
 * gated on below `lg`. Geometry (widths, push vs. overlay) lives entirely in
 * Tailwind `lg:` variants in `Sidebar.tsx` and never reads this value — see
 * TDD #284 §5.2. `useIsBelowBreakpoint("lg")` is the JS-side source of truth
 * that matches this same breakpoint.
 */
export const SIDEBAR_NAV_ID = "app-nav";

/** aria-label pair for the rail toggle, keyed by its current expanded state. */
export const SIDEBAR_TOGGLE_LABEL = {
  collapsed: "Expand navigation",
  expanded: "Collapse navigation",
} as const;
