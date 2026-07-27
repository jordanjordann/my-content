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

/** Design §4 / PRD §6 — the fixed trailing word for the `plays` state, always shown. */
export const ENGAGEMENT_PLAYS_LABEL = "plays";

/** Accessible names for the `hidden` info trigger (design §7) — a question, not a label. */
export const ENGAGEMENT_HIDDEN_TRIGGER_LABEL: Record<EngagementMetric, string> = {
  views: "Why is the view count hidden?",
  likes: "Why is the like count hidden?",
};

/** Design §2 — info-blue, never warning/error. Non-text contrast target: WCAG 1.4.11. */
export const ENGAGEMENT_INFO_ICON_CLASSNAME = "text-blue-600";
/**
 * Design §2 — "Hidden" is muted, distinct from full-strength "0". The design's slate-500
 * value was authored against a white mockup surface (`engagement-count-display-states-mockup.html`)
 * and is illegible on this app's hard-locked dark theme, so this maps onto the app's
 * semantic token instead (`--muted-foreground`, ~8.3:1 against `--background` and ~8.0:1
 * against `--card` in dark mode — see PR #107 for measured ratios).
 */
export const ENGAGEMENT_MUTED_CLASSNAME = "text-muted-foreground";
/**
 * Design §2 — "—" is the most muted of the four, distinct from "Hidden". Dimmed further
 * than `ENGAGEMENT_MUTED_CLASSNAME` via opacity rather than a separate raw color so it stays
 * tied to the same semantic token (~6.1:1 against `--background`, ~5.9:1 against `--card` in
 * dark mode — still ≥4.5:1, and deliberately quieter than "Hidden" and "0" so the visual
 * grammar reads full-strength "0" > "Hidden" > "—", not the other way around).
 */
export const ENGAGEMENT_UNKNOWN_CLASSNAME = "text-muted-foreground/70";
/** Design §2 — "0" and real counts are full-strength; they are trustworthy measured data. */
export const ENGAGEMENT_FULL_STRENGTH_CLASSNAME = "text-foreground";
