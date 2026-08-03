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
 * tied to the same semantic token — deliberately quieter than "Hidden" and "0" so the visual
 * grammar reads full-strength "0" > "Hidden" > "—", not the other way around.
 *
 * Widened from the original `/70` to `/80` (#103, decision D3): `/70` measured BELOW the
 * ≥4.5:1 floor once checked against every surface this state actually renders on, not just
 * `--background` — computed from the OKLCH tokens via the standard OKLCH→linear-sRGB
 * transform and WCAG relative-luminance formula, `/70` gives 4.42:1 vs `--background`,
 * 4.37:1 vs `--card` (composited over `--background` at its own 86% alpha), and 4.31:1 vs the
 * table row's hover surface (`bg-muted/50` composited over `--card`) — all three below 4.5:1,
 * so the previous inline comment's "~6.1:1"/"~5.9:1" claim was itself wrong. `/80` clears every
 * measured surface with margin: 5.53:1 vs `--background`, 5.42:1 vs `--card`, 5.28:1 vs the
 * table row-hover surface — while staying visibly quieter than `ENGAGEMENT_MUTED_CLASSNAME`
 * (`/100`, ~8.3:1/~8.0:1/~7.7:1 on the same three surfaces), so the prominence ordering is
 * unchanged.
 */
export const ENGAGEMENT_UNKNOWN_CLASSNAME = "text-muted-foreground/80";
/** Design §2 — "0" and real counts are full-strength; they are trustworthy measured data. */
export const ENGAGEMENT_FULL_STRENGTH_CLASSNAME = "text-foreground";
