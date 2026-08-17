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
 * DESIGN-3B §4.5.1 (amendment B6) — the frozen clause shared, byte-identical, by both footer
 * variants (F1's whole sentence, and F2's first sentence and the whole of its second sentence
 * up to the em-dash). Exported only so `scoreExplainFooter` can build both variants from one
 * template; never rendered directly.
 */
const SCORE_EXPLAIN_FOOTER_FROZEN_CLAUSE =
  "These numbers are frozen at the time of analysis and don't update";

/**
 * TDD §9.4 item 6 / DESIGN-3B §4.5.1 (amendment B6) — the popover footer, now two variants
 * built from one template with an optional tail so a future re-wording of the shared clause
 * is inherited by both (§4.5.1's binding rule). `{date}` is interpolated by the caller.
 *
 * F1 (`coldStartBucketNoun == null`) renders on every popover except the cold-start state and
 * is byte-identical to the string this function returned before this amendment. F2 renders
 * only when the row's `vs their usual` state is cold start (`tier2` present, `tier2.multiplier
 * === null`) — the caller passes the SAME bucket noun the cell renders (`multiplierCell.kind
 * === "cold-start" ? multiplierCell.bucketNoun : null`), never a re-derived one (PR #198
 * blocker 8). F2 carries no numeral and no duration (R-13.3.4, R-13.4.4).
 */
export function scoreExplainFooter(date: string, coldStartBucketNoun: string | null = null): string {
  const prefix = `Measured ${date}. ${SCORE_EXPLAIN_FOOTER_FROZEN_CLAUSE}`;
  if (coldStartBucketNoun == null) {
    return `${prefix}.`;
  }
  return `${prefix} — except the count of ${coldStartBucketNoun} analysed so far, which is read from your library as it stands now.`;
}

/**
 * DESIGN-3C §5.1 — the trigger's accessible name is the question it answers, not a generic
 * "info" label (R-13.7.6). Renders on every row that has a 1–5 (DESIGN-3B §5.5.1, S-P8 table).
 */
export const SCORE_EXPLAIN_TRIGGER_LABEL = "How was this score worked out?";

/**
 * DESIGN-3B §5.5.1 (amendment B10) — `S-P8`. Row 8 only (`performanceCell.kind ===
 * "no-judgement"`): swaps in for `SCORE_EXPLAIN_TRIGGER_LABEL`, selected by the SAME
 * `isNoJudgement` flag that already selects `SCORE_EXPLAIN_NO_JUDGEMENT_HEADING` and
 * `SCORE_EXPLAIN_NO_JUDGEMENT_INTRO` above — one flag, three strings, so they cannot drift
 * apart. Asserts no score exists ("no 1–5"), never "this score" — there is no score on this
 * row to refer to.
 */
export const SCORE_EXPLAIN_NO_JUDGEMENT_TRIGGER_LABEL = "Why is there no 1–5 for this post?";
