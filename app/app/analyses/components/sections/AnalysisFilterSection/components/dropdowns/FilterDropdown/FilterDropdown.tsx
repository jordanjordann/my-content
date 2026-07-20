"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  FILTER_DROPDOWN_OPTION_LIST_MAX_HEIGHT,
  FILTER_DROPDOWN_PANEL_WIDTH,
  FILTER_DROPDOWN_PANEL_WIDTH_WITH_SEARCH,
} from "./constants";
import { filterOptionsBySearch } from "./helpers";
import type { FilterDropdownProps } from "./types";

/**
 * One shared dropdown component for all three filter dimensions (Account/Platform/Status) — do
 * not fork into three separate implementations (design §1). Built on the `Popover` primitive,
 * which supplies outside-click, `Escape`, focus return, and a focus trap (via `modal="trap-focus"`
 * plus the rendered `Popover.Close` "Done" button) for free (TDD §6.1, §7.4).
 *
 * Checkbox toggles fire `onToggle` immediately — there is no "Apply" step. "Done" only closes
 * the panel; it performs no state mutation of its own.
 */
export function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
  onClearSelection,
  hasSearch = false,
  valueClassName,
}: FilterDropdownProps) {
  const [search, setSearch] = useState("");

  const hasSelection = selected.length > 0;
  const triggerAriaLabel = hasSelection
    ? `${label}, ${selected.length} selected`
    : label;

  const visibleOptions = hasSearch ? filterOptionsBySearch(options, search) : options;

  return (
    <Popover
      modal="trap-focus"
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
    >
      <PopoverTrigger
        aria-haspopup="listbox"
        aria-label={triggerAriaLabel}
        render={
          <Button
            variant="outline"
            className={cn(
              "min-h-8 gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium",
              hasSelection
                ? "border-primary/60 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                : "border-input text-foreground"
            )}
          />
        }
      >
        <span>{label}</span>
        {hasSelection && (
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none font-semibold text-primary-foreground">
            {selected.length}
          </span>
        )}
        <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>

      <PopoverContent
        role="listbox"
        aria-multiselectable="true"
        align="start"
        sideOffset={6}
        className={cn(
          "w-auto flex-col gap-0 p-2",
          hasSearch ? FILTER_DROPDOWN_PANEL_WIDTH_WITH_SEARCH : FILTER_DROPDOWN_PANEL_WIDTH
        )}
      >
        {hasSearch && (
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search accounts..."
            aria-label="Search accounts"
            className="mb-2 h-7 text-xs"
          />
        )}

        <div className={cn("overflow-y-auto", FILTER_DROPDOWN_OPTION_LIST_MAX_HEIGHT)}>
          {visibleOptions.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {hasSearch
                ? `No accounts match "${search.trim()}"`
                : "No options"}
            </p>
          ) : (
            visibleOptions.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-label={`${option.label}, ${option.count} matching analyses`}
                  onClick={() => onToggle(option.value)}
                  className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Checkbox
                      checked={isSelected}
                      readOnly
                      tabIndex={-1}
                      className="pointer-events-none"
                    />
                    <span className={cn("truncate", valueClassName)}>{option.label}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {option.count}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          {hasSelection && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              aria-label={`Clear ${label} selection`}
              className="h-auto px-1 py-0.5 text-xs text-muted-foreground hover:bg-transparent hover:text-destructive"
            >
              Clear selection
            </Button>
          )}
          <PopoverPrimitive.Close
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto h-auto px-1 py-0.5 text-xs text-primary hover:bg-transparent hover:text-primary"
              />
            }
          >
            Done
          </PopoverPrimitive.Close>
        </div>
      </PopoverContent>
    </Popover>
  );
}
