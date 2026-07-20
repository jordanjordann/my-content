import type { FilterDimension } from "@/app/app/analyses/types";

/** Human-readable trigger labels per dimension — internal `FilterDimension` values are lowercase. */
export const DIMENSION_LABELS: Record<FilterDimension, string> = {
  account: "Account",
  platform: "Platform",
  status: "Status",
};

export const KEYWORD_PLACEHOLDER = "Search title, caption, prompt...";
export const KEYWORD_INPUT_ARIA_LABEL = "Search title, caption, and prompt";
export const KEYWORD_CLEAR_ARIA_LABEL = "Clear search";
export const CLEAR_FILTERS_ARIA_LABEL = "Clear all filters";
