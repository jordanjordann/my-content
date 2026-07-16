"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { AnalysisFilterBarProps } from "@/app/app/analyses/types";

const PLATFORM_OPTIONS = [
  { label: "All", value: undefined },
  { label: "IG", value: "instagram" as const },
  { label: "YT", value: "youtube" as const },
];

const MEDIA_TYPE_OPTIONS = [
  { label: "Reel", value: "reel" as const },
  { label: "Post", value: "post" as const },
  { label: "Carousel", value: "carousel" as const },
  { label: "Short", value: "short" as const },
];

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" as const },
  { label: "Oldest", value: "oldest" as const },
];

const activeButtonClass =
  "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-900 dark:hover:bg-indigo-500 border-transparent";
const inactivePlatformClass =
  "border border-input bg-background text-foreground hover:bg-muted";
const platformCommonClass = "h-8 px-3 rounded-md text-sm font-medium transition-colors";

const inactiveChipClass =
  "border border-input text-muted-foreground hover:bg-muted hover:text-foreground";
const chipCommonClass = "h-7 px-2.5 rounded-full text-xs font-medium transition-colors";

/** Full filter bar with account select, platform toggle, media type chips, sort select, and clear all. */
export function AnalysisFilterSection({
  accounts,
  filters,
  onFiltersChange,
  hasActiveFilters,
  onClearAll,
}: AnalysisFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Account Select */}
      <Select
        value={filters.account ?? "__all__"}
        onValueChange={(v) =>
          onFiltersChange({ ...filters, account: v === "__all__" ? null : v })
        }
      >
        <SelectTrigger className="h-8 w-[180px] text-sm">
          <SelectValue placeholder="All accounts" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All accounts</SelectItem>
          {accounts.map((account) => (
            <SelectItem key={account} value={account}>
              {account}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="h-4" />

      {/* Platform Toggle */}
      <div role="radiogroup" aria-label="Filter by platform" className="flex gap-0">
        {PLATFORM_OPTIONS.map((option) => {
          const isActive = filters.platform === option.value;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={isActive}
              onClick={() =>
                onFiltersChange({ ...filters, platform: option.value })
              }
              className={cn(
                platformCommonClass,
                isActive ? activeButtonClass : inactivePlatformClass,
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <Separator orientation="vertical" className="h-4" />

      {/* Media Type Chips */}
      <div role="group" aria-label="Filter by media type" className="flex gap-0">
        {MEDIA_TYPE_OPTIONS.map((option) => {
          const isSelected = filters.mediaTypes.includes(option.value);
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                const next = isSelected
                  ? filters.mediaTypes.filter((t) => t !== option.value)
                  : [...filters.mediaTypes, option.value];
                onFiltersChange({ ...filters, mediaTypes: next });
              }}
              className={cn(
                chipCommonClass,
                isSelected ? activeButtonClass : inactiveChipClass,
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <Separator orientation="vertical" className="h-4" />

      {/* Sort Select */}
      <Select
        value={filters.sort}
        onValueChange={(v) =>
          onFiltersChange({ ...filters, sort: v as "newest" | "oldest" })
        }
      >
        <SelectTrigger className="h-8 w-[140px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear All */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-auto text-xs text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-2 cursor-pointer"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
