/**
 * DESIGN-3C §9.2 — the third, redundant-only channel (WCAG 1.4.1): amber `--accent` for
 * reach-denominated qualifiers, teal `--teal` for follower-denominated ones. §9.2 puts the
 * colour on the QUALIFIER line ("of 482.1K views" / "of 284K followers"), never the value line
 * — the value line stays `text-foreground` (§9.2's "Primary cell text" row). Never the only
 * signal — the qualifier text itself and the `≈` prefix (helpers.ts) carry the meaning on
 * their own.
 */
export const ENGAGEMENT_CELL_QUALIFIER_CLASSNAME: Record<"REACH" | "FOLLOWERS", string> = {
  REACH: "text-accent",
  FOLLOWERS: "text-teal",
};
