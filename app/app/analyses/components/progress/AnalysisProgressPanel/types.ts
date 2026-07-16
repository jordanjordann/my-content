export type AnalysisStep =
  | "classifying"
  | "fetching"
  | "summarizing"
  | "downloading"
  | "uploading"
  | "analyzing"
  | "saving"
  | "complete"
  | "error";

export interface ProgressState {
  step: AnalysisStep;
  current: number;
  total: number;
  message: string;
}

export interface AnalysisProgressPanelProps {
  progress: ProgressState | null;
  onDismiss: () => void;
  onRetry?: () => void;
}
