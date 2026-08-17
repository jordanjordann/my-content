import type { EngagementHeaderTooltipColumnId } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/tooltips/AnalysisEngagementHeaderTooltip/types";

/**
 * DESIGN-3B §4.6 (amendment B7) is the only approved home for this copy — `T1` for
 * `Eng. / reach`, `T2` for `Eng. / followers`. Every string below is quoted verbatim,
 * including the en dash in "1–5" (not used here) and the straight apostrophes and em
 * dash the source doc itself uses. Do not retype from memory; do not add a word.
 *
 * DESIGN-3C §4.2 (amendment A6) is the affordance/accessible-name authority.
 */

/** DESIGN-3C §4.2, R-D8 — the accessible name IS the question the tooltip answers. */
export const ENGAGEMENT_HEADER_TOOLTIP_TRIGGER_LABEL: Record<EngagementHeaderTooltipColumnId, string> = {
  engagementReach: "How is engagement against reach worked out?",
  engagementFollowers: "How is engagement against followers worked out?",
};

/** DESIGN-3B §4.6 — the tooltip heading. */
export const ENGAGEMENT_HEADER_TOOLTIP_HEADING: Record<EngagementHeaderTooltipColumnId, string> = {
  engagementReach: "Engagement against reach",
  engagementFollowers: "Engagement against followers",
};

/**
 * DESIGN-3B §4.6 — the operand stack: an operand list over an em-rule implying the
 * operation, with no computed result (R-13.3.4 / #147's precedent).
 */
export const ENGAGEMENT_HEADER_TOOLTIP_OPERANDS: Record<
  EngagementHeaderTooltipColumnId,
  { numerator: string; denominator: string }
> = {
  engagementReach: {
    numerator: "Likes + comments",
    denominator: "Views or plays on this post",
  },
  engagementFollowers: {
    numerator: "Likes + comments",
    denominator: "The creator's follower count",
  },
};

/** DESIGN-3B §4.6 — T1/T2's second paragraph, verbatim. */
export const ENGAGEMENT_HEADER_TOOLTIP_BODY: Record<EngagementHeaderTooltipColumnId, string> = {
  engagementReach:
    "How many of the people who saw this post engaged with it. Both figures are counts Instagram published, not estimates — which is why no figure in this column carries an ≈. Where a carousel's reach is taken from its first slide, the cell says so.",
  engagementFollowers:
    "How much this post got relative to the size of the creator's audience. The follower count comes from a cached profile record that can be up to a week old, which is why every figure in this column carries an ≈.",
};

/**
 * DESIGN-3B §4.6 — the matched closing sentence pair. Each names the OTHER column and
 * states that column's denominator; editing one without the other produces a table where
 * the two explanations disagree about what the other one measures.
 */
export const ENGAGEMENT_HEADER_TOOLTIP_COMPARISON: Record<EngagementHeaderTooltipColumnId, string> = {
  engagementReach:
    "Not comparable with Eng. / followers: that column divides by the creator's follower count, not by this post's reach.",
  engagementFollowers:
    "Not comparable with Eng. / reach: that column divides by the views or plays on the post itself, not by follower count.",
};
