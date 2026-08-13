"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LOCKED_COLUMN_TOOLTIP } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/menus/AnalysisColumnsMenu/constants";
import type { AnalysisColumnsMenuColumn, AnalysisColumnsMenuProps } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/menus/AnalysisColumnsMenu/types";

/**
 * Ticket #149 / DESIGN-3C §6.3 — the `Columns` menu. **R-15.2.2: this is the ONLY route to the
 * Style column**, on every load (Style's visibility is never persisted, ticket #149 scope
 * addition, 2026-08-09 ruling) — a build that ships this menu without a working Style entry
 * ships Style as dead code. Four columns are LOCKED (Content, Performance, both engagement
 * columns): their checkbox is disabled and un-clickable, and hovering/focusing the row shows the
 * tooltip verbatim from DESIGN-3C §6.3 (AC assertion: attempting to toggle a locked column off
 * through the UI does nothing — the checkbox stays checked).
 */
export function AnalysisColumnsMenu({ columns, visibleColumnIds, onToggle }: AnalysisColumnsMenuProps) {
  const hiddenCount = columns.filter((c) => !c.locked && !visibleColumnIds.has(c.id)).length;

  return (
    <Popover modal="trap-focus">
      <PopoverTrigger
        aria-label={hiddenCount > 0 ? `Columns, ${hiddenCount} hidden` : "Columns"}
        render={<Button type="button" variant="outline" size="sm" className="gap-1.5" />}
      >
        Columns
        <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={6} className="w-64 flex-col gap-0 p-2">
        <div role="listbox" aria-multiselectable="true" className="flex flex-col">
          {columns.map((column) => (
            <ColumnRow
              key={column.id}
              column={column}
              checked={column.locked || visibleColumnIds.has(column.id)}
              onToggle={onToggle}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ColumnRow({
  column,
  checked,
  onToggle,
}: {
  column: AnalysisColumnsMenuColumn;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipId = useId();
  const rowRef = useRef<HTMLDivElement>(null);

  const disabled = !column.interactive;

  const row = (
    <div
      ref={rowRef}
      role="option"
      aria-selected={checked}
      aria-disabled={disabled}
      aria-describedby={column.locked && tooltipOpen ? tooltipId : undefined}
      tabIndex={column.locked ? 0 : -1}
      onMouseEnter={() => column.locked && setTooltipOpen(true)}
      onMouseLeave={() => setTooltipOpen(false)}
      onFocus={() => column.locked && setTooltipOpen(true)}
      onBlur={() => setTooltipOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setTooltipOpen(false);
      }}
      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-sm outline-none focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => column.interactive && onToggle(column.id)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed"
      >
        <Checkbox checked={checked} disabled={disabled} readOnly tabIndex={-1} className="pointer-events-none" />
        <span className="truncate">{column.label}</span>
      </button>
    </div>
  );

  if (!column.locked) {
    return row;
  }

  return (
    <PopoverPrimitive.Root open={tooltipOpen} onOpenChange={(next) => setTooltipOpen(next)}>
      {row}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={rowRef}
          side="left"
          align="center"
          sideOffset={6}
          collisionPadding={8}
          className="z-50"
        >
          <PopoverPrimitive.Popup
            id={tooltipId}
            role="tooltip"
            initialFocus={false}
            finalFocus={false}
            className="w-56 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md"
          >
            {LOCKED_COLUMN_TOOLTIP}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
