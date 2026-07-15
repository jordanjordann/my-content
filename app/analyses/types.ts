import type { AnalysisListItem } from "@/lib/api/analyses/types";

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

export type AnalysisFilterProps = {
  accounts: string[];
  selectedAccount: string | null;
  onSelect: (account: string | null) => void;
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
