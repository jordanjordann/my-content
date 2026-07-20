"use client";

import { useState, type ChangeEvent } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterDropdown } from "@/app/app/analyses/components/sections/AnalysisFilterSection/components/dropdowns/FilterDropdown";
import { ActiveFilterRow } from "@/app/app/analyses/components/sections/AnalysisFilterSection/components/rows/ActiveFilterRow";
import {
  CLEAR_FILTERS_ARIA_LABEL,
  DIMENSION_LABELS,
  KEYWORD_CLEAR_ARIA_LABEL,
  KEYWORD_INPUT_ARIA_LABEL,
  KEYWORD_PLACEHOLDER,
} from "@/app/app/analyses/components/sections/AnalysisFilterSection/constants";
import { buildResultCountAnnouncement } from "@/app/app/analyses/components/sections/AnalysisFilterSection/helpers";
import type { AnalysisFilterSectionProps } from "@/app/app/analyses/components/sections/AnalysisFilterSection/types";

/**
 * Assembles the filter bar (control row + conditional chip row) from `FilterDropdown` /
 * `FilterChip` / `ActiveFilterRow` (#21), plus the persistent result-count live region left to
 * this ticket. Row order left → right (design §5.2): Account → Platform → Status → divider →
 * keyword input → Clear filters link. The view-toggle slot is intentionally left empty — #23 is
 * deferred and this ticket targets the table view only.
 */
export function AnalysisFilterSection({
  filters,
  counts,
  filteredCount,
  totalCount,
  anyActive,
  onToggle,
  onClearSelection,
  onRemove,
  onSetKeyword,
  onClearKeyword,
  onClearAll,
}: AnalysisFilterSectionProps) {
  // Local draft so typing is instant — the hook's `setKeyword` write is debounced. Seeded from
  // the URL and re-synced whenever `filters.q` changes from outside this input (back/forward,
  // `clearAll()`, the debounce's own eventual write once it catches up to what's already typed).
  // Adjusted during render (React's documented pattern for resetting state on a prop change)
  // rather than in an effect, per this repo's `react-hooks/set-state-in-effect` rule.
  const [draft, setDraft] = useState(filters.q);
  const [prevUrlKeyword, setPrevUrlKeyword] = useState(filters.q);

  if (filters.q !== prevUrlKeyword) {
    setPrevUrlKeyword(filters.q);
    setDraft(filters.q);
  }

  const handleKeywordChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setDraft(value);
    onSetKeyword(value);
  };

  const handleClearKeyword = () => {
    setDraft("");
    onClearKeyword();
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
        <FilterDropdown
          label={DIMENSION_LABELS.account}
          options={counts.account}
          selected={filters.account}
          onToggle={(value) => onToggle("account", value)}
          onClearSelection={() => onClearSelection("account")}
          hasSearch
          valueClassName="font-mono"
        />
        <FilterDropdown
          label={DIMENSION_LABELS.platform}
          options={counts.platform}
          selected={filters.platform}
          onToggle={(value) => onToggle("platform", value)}
          onClearSelection={() => onClearSelection("platform")}
        />
        <FilterDropdown
          label={DIMENSION_LABELS.status}
          options={counts.status}
          selected={filters.status}
          onToggle={(value) => onToggle("status", value)}
          onClearSelection={() => onClearSelection("status")}
        />

        <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />

        <div className="relative min-w-[220px] max-w-[360px] flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={draft}
            onChange={handleKeywordChange}
            placeholder={KEYWORD_PLACEHOLDER}
            aria-label={KEYWORD_INPUT_ARIA_LABEL}
            className="h-8 pr-7 pl-7"
          />
          {draft !== "" && (
            <button
              type="button"
              onClick={handleClearKeyword}
              aria-label={KEYWORD_CLEAR_ARIA_LABEL}
              className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          )}
        </div>

        {anyActive && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            aria-label={CLEAR_FILTERS_ARIA_LABEL}
            className="gap-1 px-2 text-muted-foreground hover:bg-transparent hover:text-destructive"
          >
            <X className="size-3" aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </div>

      {anyActive && (
        <ActiveFilterRow
          filters={filters}
          counts={counts}
          onRemove={onRemove}
          onClearKeyword={handleClearKeyword}
        />
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {buildResultCountAnnouncement(filteredCount, totalCount)}
      </span>
    </div>
  );
}
