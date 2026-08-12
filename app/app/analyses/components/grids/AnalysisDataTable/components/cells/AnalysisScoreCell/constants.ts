/**
 * DESIGN-3C §5 / TDD §9.3 — different pip fill per axis (D7), redundant with the `Scores`
 * group's `Content`/`Performance` sub-labels, never load-bearing on its own.
 */
export const SCORE_PIP_FILL_CLASSNAME: Record<"content" | "performance", string> = {
  content: "bg-muted-foreground",
  performance: "bg-primary",
};

export const SCORE_PIP_EMPTY_CLASSNAME = "bg-muted-foreground/30";
