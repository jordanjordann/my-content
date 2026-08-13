import type { AnalysisListItemIndexed, AnalysisPlatform, AnalysisStatus, Tier } from "@/lib/api/analyses/types";
import type { AnalysisFilters, FilterDimension, ScoreBand } from "@/app/app/analyses/types";

export const PLATFORM_OPTIONS: { value: AnalysisPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
];

export const STATUS_OPTIONS: { value: AnalysisStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

/** Ticket #149 / DESIGN-3C §6.2 — the Content kind filter's options, from `mediaType`. */
export const CONTENT_KIND_OPTIONS: { value: AnalysisListItemIndexed["mediaType"]; label: string }[] = [
  { value: "reel", label: "Reel" },
  { value: "post", label: "Post" },
  { value: "carousel", label: "Carousel" },
  { value: "short", label: "Short" },
];

/**
 * Ticket #149 / DESIGN-3C §6.2 — the Tier filter's options, **the plain-language phrases, never
 * the enums** (the ticket's own hard rule). Values are the real `Tier` enum (matched against
 * `performance.computed.tierUsed`, the same field `tierPhrase()` in `lib/api/analyses/helpers.ts`
 * switches on) so this filter can never drift out of sync with what the Performance cell itself
 * renders — only the *labels* are filter-specific, quoted verbatim from DESIGN-3C §6.2 (they
 * differ from `tierPhrase()`'s compact cell text by design: "Compared to their usual" here vs.
 * "vs their usual" in the cell — full sentence vs. cell fragment, both approved, in different
 * places). `UNAVAILABLE` -> `No score` is this filter's only route to isolating unscored rows.
 */
export const TIER_OPTIONS: { value: Tier; label: string }[] = [
  { value: "CREATOR_BASELINE", label: "Compared to their usual" },
  { value: "REACH_ONLY", label: "Measured against reach" },
  { value: "AUDIENCE_FALLBACK", label: "Rough — vs audience size" },
  { value: "UNAVAILABLE", label: "No score" },
];

export const FILTER_PARAM_KEYS: Record<FilterDimension | "keyword", string> = {
  account: "account",
  platform: "platform",
  contentKind: "contentKind",
  tier: "tier",
  status: "status",
  keyword: "q",
};

export const KEYWORD_DEBOUNCE_MS = 300;

/** The "no filters active" state — `AnalysisDataTable`'s default `filters` prop. */
export const EMPTY_ANALYSIS_FILTERS: AnalysisFilters = {
  account: [],
  platform: [],
  contentKind: [],
  tier: [],
  status: [],
  q: "",
};

/**
 * Top of the 1-5 scorecard scale (PRD §4.6, TDD §8.2). The ONLY place `5` is
 * hardcoded as the scale ceiling — every consumer (scorecard pip meters, the
 * data table, the overall-score caption) imports this rather than repeating
 * the literal, which is exactly how the pre-redesign `/ 10` ended up
 * scattered across four call sites.
 */
export const MAX_SCORE = 5;

/** Band word per integer score, 1-5 (design doc §2.1). Index 0 is unused. */
export const SCORE_BAND_WORDS: readonly ["", ScoreBand, ScoreBand, ScoreBand, ScoreBand, ScoreBand] = [
  "",
  "Poor",
  "Weak",
  "Adequate",
  "Strong",
  "Excellent",
];
