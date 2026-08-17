/** DESIGN-3C §4.2 (amendment A6) — the two column ids that carry the header tooltip trigger. */
export type EngagementHeaderTooltipColumnId = "engagementReach" | "engagementFollowers";

export type AnalysisEngagementHeaderTooltipProps = {
  columnId: EngagementHeaderTooltipColumnId;
};
