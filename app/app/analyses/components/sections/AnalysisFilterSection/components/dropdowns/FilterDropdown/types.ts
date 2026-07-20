import type { FilterOption } from "@/app/app/analyses/types";

export type FilterDropdownProps = {
  /** Dimension name shown on the trigger and used to build accessible names, e.g. "Account". */
  label: string;
  /** Selectable options for this dimension, each carrying a contextual match count. */
  options: FilterOption[];
  /** Currently selected values for this dimension (OR'd together). */
  selected: string[];
  /** Fires immediately on checkbox toggle — no debounce, no "Apply" step (design §5.3). */
  onToggle: (value: string) => void;
  /** Empties this dimension's selection only, leaving other dimensions untouched. */
  onClearSelection: () => void;
  /** Renders a local search-within-list field above the option list. `true` for Account only. */
  hasSearch?: boolean;
  /** Extra classes applied to each option's value label, e.g. `font-mono` for account handles. */
  valueClassName?: string;
};
