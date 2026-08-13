import type { FilterDimension } from "@/app/app/analyses/types";

/**
 * Human-readable trigger labels per dimension — internal `FilterDimension` values are lowercase.
 * `account` renders as `Creator` (DESIGN-3C §6.2's filter name for this dimension); the internal
 * key stays `account` to avoid renaming the URL param / every existing call site.
 */
export const DIMENSION_LABELS: Record<FilterDimension, string> = {
  account: "Creator",
  platform: "Platform",
  contentKind: "Content kind",
  tier: "Tier",
  status: "Status",
};

export const KEYWORD_PLACEHOLDER = "Search title, caption, prompt...";
export const KEYWORD_INPUT_ARIA_LABEL = "Search title, caption, and prompt";
export const KEYWORD_CLEAR_ARIA_LABEL = "Clear search";
export const CLEAR_FILTERS_ARIA_LABEL = "Clear all filters";
