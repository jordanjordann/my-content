import type {
  AnalysisListItem,
  AnalysisPlatform,
  AnalysisStatus,
} from "@/lib/api/analyses/types";

export type AnalysisCardProps = {
  analysis: AnalysisListItem;
  onClick: (id: string) => void;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
};

export type AnalysisGridProps = {
  analyses: AnalysisListItem[];
  onAnalysisClick: (id: string) => void;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
};

export type AnalysisEmptyProps = {
  onNewAnalysis: () => void;
};

export type NewAnalysisModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (urls: string[], prompt: string) => void;
  isAnalyzing: boolean;
};

/** The three multi-select filter dimensions on the analyses list. */
export type FilterDimension = "account" | "platform" | "status";

/** Current filter state, parsed from URL params. The URL is the source of truth. */
export type AnalysisFilters = {
  account: string[];
  platform: AnalysisPlatform[];
  status: AnalysisStatus[];
  q: string;
};

/** A single selectable value within a filter dimension, with a contextual match count. */
export type FilterOption = {
  value: string;
  label: string;
  /** Contextual count — see `useFilteredAnalyses` for the self-exclusion rule. */
  count: number;
};

export type OptionCounts = Record<FilterDimension, FilterOption[]>;
