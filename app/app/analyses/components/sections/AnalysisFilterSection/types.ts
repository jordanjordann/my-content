import type {
  AnalysisFilters,
  FilterDimension,
  OptionCounts,
} from "@/app/app/analyses/types";

/** Props for the shared pill used for every active-filter chip type (Account/Platform/Status/Search). */
export type FilterChipProps = {
  /** Left segment of the chip, e.g. "Account", "Platform", "Status", "Search". */
  dimensionLabel: string;
  /** Right segment of the chip — the selected value's display label. */
  valueLabel: string;
  /** Removes exactly this chip's value (or clears the keyword, for the Search chip). */
  onRemove: () => void;
  /** Renders `valueLabel` in monospace — account handles only. */
  isMono?: boolean;
};

/** Props for the secondary row of removable chips beneath the filter bar. */
export type ActiveFilterRowProps = {
  /** Current filter state — drives which chips render and in what order. */
  filters: AnalysisFilters;
  /** Per-dimension option metadata (label, count), used to resolve a selected value's display label. */
  counts: OptionCounts;
  /** Removes one value from a dropdown-driven dimension (Account/Platform/Status). */
  onRemove: (dimension: FilterDimension, value: string) => void;
  /** Clears the keyword chip specifically — keyword is a single string, not a multi-select. */
  onClearKeyword: () => void;
};
