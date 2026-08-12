/**
 * DESIGN-3C §4 / TDD §9.2 — the third, redundant-only channel (WCAG 1.4.1): amber `--accent`
 * for reach-denominated figures, teal for follower-denominated ones. Never the only signal —
 * the qualifier text and the `≈` prefix (helpers.ts) carry the meaning on their own.
 */
export const ENGAGEMENT_CELL_VALUE_CLASSNAME: Record<"REACH" | "FOLLOWERS", string> = {
  REACH: "text-accent",
  FOLLOWERS: "text-teal-500",
};
