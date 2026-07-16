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

export function createProgress(total: number): ProgressState {
  return {
    step: "classifying",
    current: 0,
    total,
    message: `Classifying ${total} URL(s)...`,
  };
}

export function updateProgress(
  state: ProgressState,
  step: AnalysisStep,
  current: number,
  message: string,
): ProgressState {
  return { ...state, step, current, message };
}
