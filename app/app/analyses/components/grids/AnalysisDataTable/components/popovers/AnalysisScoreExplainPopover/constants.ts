/**
 * DESIGN-3B §3-§7 is the only approved home for user-facing score-explainability copy.
 * Every string below is quoted from there verbatim. The disagreement line's two live
 * variants (D1/D2, DESIGN-3B §3.1.1, amendment B5) live in `lib/api/analyses/helpers.ts`
 * rather than here, because they are computed in the `select` derivation layer, not
 * rendered as static copy. Nothing here is invented; do not add new copy without a doc
 * citation.
 */

/** DESIGN-3B §7 point 1 — the popover's heading. */
export const SCORE_EXPLAIN_HEADING = "How this score was reached";

/** DESIGN-3B §7 point 1 / TDD §9.4 item 1 — read before anything else in the popover. */
export const SCORE_EXPLAIN_JUDGEMENT_INTRO =
  "The 1–5 is a judgement of the numbers below, not a number we measured. The measured figures are the percentage and the multiplier.";

/**
 * DESIGN-3B §5.5 (amendment B8) — row 8 only. Swaps in for `SCORE_EXPLAIN_HEADING` when the
 * popover opens on a row whose judgement returned no 1–5 (`performanceCell.kind ===
 * "no-judgement"`); every other row keeps the heading above unchanged.
 */
export const SCORE_EXPLAIN_NO_JUDGEMENT_HEADING = "Why there's no 1–5 here";

/**
 * DESIGN-3B §5.5 (amendment B8), §5 row 8's L2 — row 8 only. Swaps in for
 * `SCORE_EXPLAIN_JUDGEMENT_INTRO`, which asserts a score that is not there.
 */
export const SCORE_EXPLAIN_NO_JUDGEMENT_INTRO =
  "The 1–5 is a judgement, and none was returned for this post. The measurements are unaffected and are shown as normal. We can't tell why no judgement was reached, so we're not going to guess.";

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
