import type { AnalysisDetail, ContentItemRecord, ContentAnalysis } from "@/lib/api/analyses/types";

export type DetailPageProps = {
  analysis: AnalysisDetail;
};

export type AnalysisDetailHeaderProps = {
  analysis: AnalysisDetail;
  onBack: () => void;
};

export type ScorecardSectionProps = {
  results: ContentAnalysis;
};

export type PerItemSectionProps = {
  items: ContentItemRecord[];
  results: ContentAnalysis;
};

export type PatternsSectionProps = {
  results: ContentAnalysis;
};

export type SuggestionsSectionProps = {
  results: ContentAnalysis;
};
