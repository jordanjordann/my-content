"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FilterChipProps } from "@/app/app/analyses/components/sections/AnalysisFilterSection/types";

/**
 * Removable pill representing a single active filter value. One shared component for all four
 * chip types (Account/Platform/Status/Search) — parameterized by `dimensionLabel`/`valueLabel`
 * rather than forked per dimension (design §1).
 */
export function FilterChip({
  dimensionLabel,
  valueLabel,
  onRemove,
  isMono,
}: FilterChipProps) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted py-1 pr-1.5 pl-2.5 text-xs">
      <span className="shrink-0 text-muted-foreground">{dimensionLabel}</span>
      <span
        title={valueLabel}
        className={cn(
          "max-w-[140px] truncate text-foreground",
          isMono && "font-mono"
        )}
      >
        {valueLabel}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${dimensionLabel} filter: ${valueLabel}`}
        className="ml-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </span>
  );
}
