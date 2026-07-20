"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AnalysisNoResultsSectionProps } from "@/app/app/analyses/components/sections/types";

/**
 * Filtered-empty state (design §5.5): at least one filter/keyword is active and the result set
 * is empty. Renders below the filter bar, which stays mounted and interactive above this — the
 * user can adjust filters directly without losing context. The "Clear filters" button here is an
 * intentional duplicate of the bar's Clear-filters link (design §0), wired to the same
 * `clearAll()`.
 */
export function AnalysisNoResultsSection({ onClearFilters }: AnalysisNoResultsSectionProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-24 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-border bg-card">
        <Search className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h2 className="mb-1 text-sm font-medium text-foreground">No results match your filters</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Try removing a filter or clearing your search.
      </p>
      <Button type="button" variant="secondary" onClick={onClearFilters}>
        Clear filters
      </Button>
    </div>
  );
}
