import type { AnalysisPlatform, AnalysisStatus } from "@/lib/api/analyses/types";
import type { FilterDimension } from "@/app/app/analyses/types";

export const PLATFORM_OPTIONS: { value: AnalysisPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
];

export const STATUS_OPTIONS: { value: AnalysisStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

export const FILTER_PARAM_KEYS: Record<FilterDimension | "keyword", string> = {
  account: "account",
  platform: "platform",
  status: "status",
  keyword: "q",
};

export const KEYWORD_DEBOUNCE_MS = 300;
