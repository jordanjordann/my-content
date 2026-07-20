import type {
  AnalysisFilters,
  FilterDimension,
  OptionCounts,
} from "@/app/app/analyses/types";

/** Props for the assembled filter bar — control row + conditional chip row + live region. */
export type AnalysisFilterSectionProps = {
  /** Current filter state, parsed from the URL — source of truth. */
  filters: AnalysisFilters;
  /** Per-dimension option metadata (label, contextual count). */
  counts: OptionCounts;
  /** Size of `filtered` — drives the live-region announcement. */
  filteredCount: number;
  /** Size of the unfiltered dataset — drives the live-region announcement. */
  totalCount: number;
  /** Whether any dimension has a selection or the keyword is non-empty. */
  anyActive: boolean;
  /** Toggles one value within a dimension. Fires immediately (design §5.3). */
  onToggle: (dimension: FilterDimension, value: string) => void;
  /** Empties one dimension's selection only. */
  onClearSelection: (dimension: FilterDimension) => void;
  /** Removes exactly one value from a dimension (chip-driven removal). */
  onRemove: (dimension: FilterDimension, value: string) => void;
  /** Debounced keyword write (300ms) — the URL updates after the user pauses typing. */
  onSetKeyword: (q: string) => void;
  /** Immediate keyword clear — bypasses the debounce (explicit ✕ / chip removal). */
  onClearKeyword: () => void;
  /** Resets every dimension and the keyword in one write. */
  onClearAll: () => void;
};

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
  /**
   * Wraps the *visible* `valueLabel` in straight quotes (matches the approved prototype's
   * keyword-chip treatment). Never affects the accessible name — the remove button's
   * `aria-label` always uses the raw, unquoted `valueLabel`.
   */
  isQuoted?: boolean;
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
