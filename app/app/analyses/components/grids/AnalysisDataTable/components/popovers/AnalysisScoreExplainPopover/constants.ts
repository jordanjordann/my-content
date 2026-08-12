/**
 * DESIGN-3B §3-§7 is the only approved home for user-facing score-explainability copy.
 * Every string below is quoted from there verbatim (or, where the design gives a worked
 * example rather than a literal template — the four disagreement variants — from TDD
 * §9.4 point 4 citing DESIGN-3B §3.1). Nothing here is invented; do not add new copy
 * without a doc citation.
 */

/** DESIGN-3B §7 point 1 — the popover's heading. */
export const SCORE_EXPLAIN_HEADING = "How this score was reached";

/** DESIGN-3B §7 point 1 / TDD §9.4 item 1 — read before anything else in the popover. */
export const SCORE_EXPLAIN_JUDGEMENT_INTRO =
  "The 1–5 is a judgement of the numbers below, not a number we measured. The measured figures are the percentage and the multiplier.";

/** DESIGN-3B §3.1 — "Both readings, side by side." */
export const SCORE_EXPLAIN_MEASURED_HEADING = "Both readings, side by side";

/** DESIGN-3B §4.4 — "What went into this." */
export const SCORE_EXPLAIN_OPERANDS_HEADING = "What went into this";

/** DESIGN-3B §7 point 3 / TDD §9.4 item 5 — drivers[] render under this heading. */
export const SCORE_EXPLAIN_DRIVERS_HEADING = "Why it did what it did";

/**
 * TDD §9.4 item 6 / DESIGN-3B §4.5 — the unconditional footer. `{date}` is interpolated by
 * the caller; the sentence otherwise renders on every open, no condition (R-13.3.2).
 */
export function scoreExplainFooter(date: string): string {
  return `Measured ${date}. These numbers are frozen at the time of analysis and don't update.`;
}

/**
 * DESIGN-3C §5.1 — the trigger's accessible name is the question it answers, not a generic
 * "info" label (R-13.7.6).
 */
export const SCORE_EXPLAIN_TRIGGER_LABEL = "How was this score worked out?";
