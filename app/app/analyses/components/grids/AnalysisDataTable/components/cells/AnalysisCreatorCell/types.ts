import type { AnalysisPlatform } from "@/lib/api/analyses/types";

export type AnalysisCreatorCellProps = {
  username: string;
  platform: AnalysisPlatform;
  comfortable: boolean;
};
