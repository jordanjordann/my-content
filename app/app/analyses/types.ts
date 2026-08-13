import type {
  AnalysisListItemIndexed,
  AnalysisPlatform,
  AnalysisStatus,
  Tier,
} from "@/lib/api/analyses/types";

export type AnalysisCardProps = {
  analysis: AnalysisListItemIndexed;
  onClick: (id: string) => void;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
};

export type AnalysisGridProps = {
  analyses: AnalysisListItemIndexed[];
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

/**
 * The five multi-select filter dimensions on the analyses list (DESIGN-3C §6.2, TDD §9.6):
 * Creator (`account`) · Platform · Content kind · Tier · Status. Order here matches the chip
 * bar's left-to-right rendering order. The Status *filter* survives OR-4's Status *column* cut
 * — two different things (design §6.2's own note).
 */
export type FilterDimension = "account" | "platform" | "contentKind" | "tier" | "status";

/** Current filter state, parsed from URL params. The URL is the source of truth. */
export type AnalysisFilters = {
  account: string[];
  platform: AnalysisPlatform[];
  /** `AnalysisListItemIndexed["mediaType"]` values — the only content-kind signal on this row shape. */
  contentKind: AnalysisListItemIndexed["mediaType"][];
  /**
   * `Tier` values (`lib/api/analyses/types.ts`) — reused directly rather than a parallel
   * filter-only enum, per the ticket's own instruction not to re-derive a second mapping.
   * `UNAVAILABLE` is this filter's `No score` option (DESIGN-3C §6.2).
   */
  tier: Tier[];
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

/**
 * Plain-language band word for a 1-5 scorecard score, pulled from the same
 * anchored rubric that defines the score (design doc §2.1) — the visual
 * (pip meter / color) and this word must never disagree.
 */
export type ScoreBand = "Poor" | "Weak" | "Adequate" | "Strong" | "Excellent";
