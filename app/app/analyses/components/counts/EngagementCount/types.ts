import type { CountState } from "@/lib/api/analyses/types";

export type EngagementMetric = "views" | "likes";

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
  metric: EngagementMetric;
};
