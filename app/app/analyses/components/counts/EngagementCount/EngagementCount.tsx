import { CountInfoTooltip } from "@/app/app/analyses/components/counts/EngagementCount/components/tooltips/CountInfoTooltip";
import {
  ENGAGEMENT_FULL_STRENGTH_CLASSNAME,
  ENGAGEMENT_METRIC_LABEL,
  ENGAGEMENT_MUTED_CLASSNAME,
  ENGAGEMENT_PLAYS_LABEL,
  ENGAGEMENT_UNKNOWN_CLASSNAME,
} from "@/app/app/analyses/components/counts/EngagementCount/constants";
import { formatAbbrev } from "@/app/app/analyses/components/counts/EngagementCount/helpers";
import type { EngagementCountProps } from "@/app/app/analyses/components/counts/EngagementCount/types";
import { cn } from "@/lib/utils";

/**
 * The single shared presentational treatment for the four engagement-count states
 * (design §2, TDD §5.1). Consumes an already-classified `CountState` only — it must
 * never branch on raw `viewCount`/`playCount`/`likeAndViewCountsDisabled`
 * (AGENTS.md, TDD §4.3). All three surfaces (table, cards, detail modal) render every
 * count through this component so the four treatments are defined exactly once.
 */
export function EngagementCount({
  state,
  metric,
  showMetricWord = false,
  className,
}: EngagementCountProps) {
  const metricWord = ENGAGEMENT_METRIC_LABEL[metric];
  const wordSuffix = showMetricWord ? ` ${metricWord}` : "";

  if (state.kind === "hidden") {
    return (
      <span className={cn("inline-flex items-center gap-1", ENGAGEMENT_MUTED_CLASSNAME, className)}>
        Hidden
        <CountInfoTooltip metric={metric} />
      </span>
    );
  }

  if (state.kind === "zero") {
    return (
      <span className={cn(ENGAGEMENT_FULL_STRENGTH_CLASSNAME, className)}>0{wordSuffix}</span>
    );
  }

  if (state.kind === "unknown") {
    // `role="img"` is required here: a bare `<span>` maps to the `generic` accessibility
    // role, and `generic` does not support naming from author content — browsers drop a
    // plain `aria-label` on it, silently no-op-ing the accessible name. `role="img"`
    // accepts author naming, so "views unknown" / "likes unknown" reliably overrides the
    // visually-shown em dash instead of a screen reader announcing "dash" or nothing.
    return (
      <span
        role="img"
        className={cn(ENGAGEMENT_UNKNOWN_CLASSNAME, className)}
        aria-label={`${metricWord} unknown`}
      >
        {"—"}
        {wordSuffix}
      </span>
    );
  }

  if (state.kind === "plays") {
    return (
      <span className={cn(ENGAGEMENT_FULL_STRENGTH_CLASSNAME, className)}>
        {formatAbbrev(state.value)}{" "}
        <span className={ENGAGEMENT_MUTED_CLASSNAME}>{ENGAGEMENT_PLAYS_LABEL}</span>
      </span>
    );
  }

  return (
    <span className={cn(ENGAGEMENT_FULL_STRENGTH_CLASSNAME, className)}>
      {formatAbbrev(state.value)}
      {wordSuffix}
    </span>
  );
}
