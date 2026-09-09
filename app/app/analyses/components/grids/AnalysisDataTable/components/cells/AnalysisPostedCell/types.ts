import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";

export type AnalysisPostedCellProps = {
  row: AnalysisListItemIndexed;
  failed: boolean;
};
