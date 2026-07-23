import type { ContentAnalysis } from "@/lib/api/analyses/types"

export type ScorecardSectionProps = {
  results: ContentAnalysis
}

export type StyleSectionProps = {
  results: ContentAnalysis
}

/** Renders `redFlags` only (TDD §8.2) — `viralFormulas`/`audiencePsychology` no longer exist. */
export type RedFlagsSectionProps = {
  results: ContentAnalysis
}

export type SuggestionsSectionProps = {
  results: ContentAnalysis
}

export type AnalysisNoResultsSectionProps = {
  /** Clears every active filter dimension and the keyword in one action — same `clearAll()` as the bar's Clear-filters link (design §0, intentional duplication). */
  onClearFilters: () => void
}
