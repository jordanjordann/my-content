/**
 * DESIGN-3C §5 / TDD §9.3 — different pip fill per axis (D7), redundant with the `Scores`
 * group's `Content`/`Performance` sub-labels, never load-bearing on its own.
 */
export const SCORE_PIP_FILL_CLASSNAME: Record<"content" | "performance", string> = {
  content: "bg-muted-foreground",
  performance: "bg-primary",
};

/**
 * DESIGN-3C §9.2 / audit M5 — the Performance numeral takes the variant colour, same as the
 * pips (§5's Trap 3 mitigation list assumed both, plus the group header, differentiating).
 * The Content numeral does NOT — §9.2's table names `text-primary` for the Performance
 * numeral only.
 */
export const SCORE_NUMERAL_COLOR_CLASSNAME: Record<"content" | "performance", string | undefined> = {
  content: undefined,
  performance: "text-primary",
};

/**
 * DESIGN-3C §9.4 — the unfilled pip track's explicit value, `#5c6c86` (3.72:1 on card,
 * clearing the 3:1 non-text floor even though the pips are formally decorative). Audit L3 /
 * §9.2's hard rule: an opacity modifier off `muted-foreground` is not a substitute for the
 * named token — this is the third time that discipline was missed and it must not ship as an
 * opacity modifier again.
 */
export const SCORE_PIP_EMPTY_CLASSNAME = "bg-[#5c6c86]";
