import type { CountState } from "@/lib/api/analyses/types";

export type EngagementMetric = "views" | "likes" | "comments";

export type EngagementCountProps = {
  /** Already-classified state (TDD §4.1) — never pass raw counts. */
  state: CountState;
  /** Drives the metric word (when `showMetricWord` is true) and the tooltip's accessible name. */
  metric: EngagementMetric;
  /**
   * Append the metric word ("views"/"likes") after the value. Dense surfaces (table,
   * cards) typically leave this off and supply their own glyph/label; the detail modal
   * opts in for full stacked lines (design §5.3). Ignored for `plays`, which always
   * shows its own mandatory "plays" word regardless of this flag.
   */
  showMetricWord?: boolean;
  className?: string;
};

export type CountInfoTooltipProps = {
  /**
   * `comments` is excluded at the type level: `computed.comments.state` never resolves
   * to `hidden` (ticket #205 — comments are never gated by `like_and_view_counts_disabled`),
   * so this trigger has no accessible-name copy for it and must never be asked to render one.
   */
  metric: Exclude<EngagementMetric, "comments">;
};
