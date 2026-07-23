import type { AnalysisPlatform, AnalysisStatus } from "@/lib/api/analyses/types";
import type { FilterDimension, ScoreBand } from "@/app/app/analyses/types";

export const PLATFORM_OPTIONS: { value: AnalysisPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
];

export const STATUS_OPTIONS: { value: AnalysisStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

export const FILTER_PARAM_KEYS: Record<FilterDimension | "keyword", string> = {
  account: "account",
  platform: "platform",
  status: "status",
  keyword: "q",
};

export const KEYWORD_DEBOUNCE_MS = 300;

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
