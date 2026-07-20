"use client";

import { FilterChip } from "@/app/app/analyses/components/sections/AnalysisFilterSection/components/chips/FilterChip";
import type { ActiveFilterRowProps } from "@/app/app/analyses/components/sections/AnalysisFilterSection/types";
import type { FilterOption } from "@/app/app/analyses/types";

/** Human-readable chip label per dimension — internal `FilterDimension` values are lowercase. */
const DIMENSION_CHIP_LABELS = {
  account: "Account",
  platform: "Platform",
  status: "Status",
  keyword: "Search",
} as const;

/**
 * Resolves a selected value's display label from its dimension's option list. Falls back to the
 * raw value when no match is found — this only happens for a stale-but-selected value (e.g. a
 * hand-edited URL with an account that no longer appears in the account list), and the chip
 * must still render so the user can see and remove it (TDD §7.1).
 */
function resolveChipLabel(options: FilterOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

/**
 * Secondary row of removable chips beneath the filter bar, one per active filter value. Fixed
 * dimension order — Account, then Platform, then Status, then the Search chip last — regardless
 * of the order the user selected them, so the row never visually reshuffles (design §5.2).
 *
 * Stateless and mount-agnostic: the parent decides whether this renders at all (only when at
 * least one filter or the keyword is active).
 */
export function ActiveFilterRow({
  filters,
  counts,
  onRemove,
  onClearKeyword,
}: ActiveFilterRowProps) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 px-1">
      {filters.account.map((value) => (
        <FilterChip
          key={`account-${value}`}
          dimensionLabel={DIMENSION_CHIP_LABELS.account}
          valueLabel={resolveChipLabel(counts.account, value)}
          isMono
          onRemove={() => onRemove("account", value)}
        />
      ))}
      {filters.platform.map((value) => (
        <FilterChip
          key={`platform-${value}`}
          dimensionLabel={DIMENSION_CHIP_LABELS.platform}
          valueLabel={resolveChipLabel(counts.platform, value)}
          onRemove={() => onRemove("platform", value)}
        />
      ))}
      {filters.status.map((value) => (
        <FilterChip
          key={`status-${value}`}
          dimensionLabel={DIMENSION_CHIP_LABELS.status}
          valueLabel={resolveChipLabel(counts.status, value)}
          onRemove={() => onRemove("status", value)}
        />
      ))}
      {filters.q !== "" && (
        <FilterChip
          dimensionLabel={DIMENSION_CHIP_LABELS.keyword}
          valueLabel={filters.q}
          isQuoted
          onRemove={onClearKeyword}
        />
      )}
    </div>
  );
}
