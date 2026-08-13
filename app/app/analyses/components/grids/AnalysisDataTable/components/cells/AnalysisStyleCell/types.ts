import type { StyleAttributes } from "@/lib/api/analyses/types";

export type AnalysisStyleCellProps = {
  /** `null` when the row has no analysis result yet (pending/failed) or predates the redesign. */
  style: StyleAttributes | null;
};
