import type { AnalysisListItemIndexed, AnalysisMode } from "@/lib/api/analyses/types";

export type AnalysisContentCellProps = {
  title: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  mediaType: AnalysisListItemIndexed["mediaType"];
  /** `null` when no performance block exists — renders no mode chip (never guessed). */
  analysisMode: AnalysisMode | null;
  comfortable: boolean;
  /** OR-4 whole-row failed treatment (design §3.3) — `null` when the row is not failed/pending. */
  failedLabel: string | null;
};
