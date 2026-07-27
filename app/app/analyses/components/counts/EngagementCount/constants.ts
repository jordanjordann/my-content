import type { EngagementMetric } from "@/app/app/analyses/components/counts/EngagementCount/types";

/**
 * English tooltip copy for the `hidden` state (design §3). Same string for views and
 * likes — the flag covers both, so there is no need to vary it per metric.
 */
export const ENGAGEMENT_HIDDEN_TOOLTIP_COPY =
  "The creator turned off view and like counts on this post. This is a creator setting — not zero, and not missing data.";

export const ENGAGEMENT_METRIC_LABEL: Record<EngagementMetric, string> = {
  views: "views",
  likes: "likes",
};

/** Accessible names for the `hidden` info trigger (design §7) — a question, not a label. */
export const ENGAGEMENT_HIDDEN_TRIGGER_LABEL: Record<EngagementMetric, string> = {
  views: "Why is the view count hidden?",
  likes: "Why is the like count hidden?",
};

/** Design §2 — info-blue, never warning/error. Non-text contrast target: WCAG 1.4.11. */
export const ENGAGEMENT_INFO_ICON_CLASSNAME = "text-blue-600";
/** Design §2 — "Hidden" is muted (slate-500), distinct from full-strength "0". */
export const ENGAGEMENT_MUTED_CLASSNAME = "text-slate-500";
/** Design §2 — "—" is the most muted of the four (slate-400), distinct from "Hidden". */
export const ENGAGEMENT_UNKNOWN_CLASSNAME = "text-slate-400";
/** Design §2 — "0" and real counts are full-strength; they are trustworthy measured data. */
export const ENGAGEMENT_FULL_STRENGTH_CLASSNAME = "text-slate-700";
