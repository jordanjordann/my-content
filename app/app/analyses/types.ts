export type AnalysisEmptyProps = {
  context: "no_data" | "no_matches";
  onNewAnalysis?: () => void;
  onClearFilters?: () => void;
};

export type NewAnalysisModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (urls: string[], prompt: string) => void;
  isAnalyzing: boolean;
};

export type FilterState = {
  account: string | null;
  platform: string | undefined;
  mediaTypes: string[];
  sort: "newest" | "oldest";
};

export type AnalysisFilterBarProps = {
  accounts: string[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  hasActiveFilters: boolean;
  onClearAll: () => void;
};
