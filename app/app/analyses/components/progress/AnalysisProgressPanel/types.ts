import type { AnalyzeFailure } from "@/lib/api/analyses/types";

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
  /** Ticket #289 — per-URL server reasons. Empty/absent on the happy path. */
  failures?: AnalyzeFailure[];
}

export interface AnalysisProgressPanelProps {
  progress: ProgressState | null;
  onDismiss: () => void;
  onRetry?: () => void;
}
