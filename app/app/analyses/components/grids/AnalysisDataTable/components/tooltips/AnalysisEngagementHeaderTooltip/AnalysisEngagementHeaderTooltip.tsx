"use client";

import { useId, useRef, useState } from "react";
import { InfoIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import {
  ENGAGEMENT_HEADER_TOOLTIP_BODY,
  ENGAGEMENT_HEADER_TOOLTIP_COMPARISON,
  ENGAGEMENT_HEADER_TOOLTIP_HEADING,
  ENGAGEMENT_HEADER_TOOLTIP_OPERANDS,
  ENGAGEMENT_HEADER_TOOLTIP_TRIGGER_LABEL,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/components/tooltips/AnalysisEngagementHeaderTooltip/constants";
import type { AnalysisEngagementHeaderTooltipProps } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/tooltips/AnalysisEngagementHeaderTooltip/types";

/**
 * DESIGN-3C §4.2 (amendment A6) / DESIGN-3B §4.6 (amendment B7) — the two engagement
 * column-header tooltips (`Eng. / reach`, `Eng. / followers`). Renders ONCE per column, in
 * the `<th>`, never per cell or per row (R-D5).
 *
 * R-D6 — the caller renders this as a SIBLING of the column's sort `<button>` inside the
 * same `<th>`, never nested inside it. This component owns only its own trigger button and
 * popup; it does not wrap or contain the sort control.
 *
 * R-D7 — reuses the shipped ticket-#70 interaction contract exactly as `CountInfoTooltip`
 * and `AnalysisScoreExplainPopover` already do: real `<button>`, opens on hover AND
 * keyboard focus, `role="tooltip"` on the popup, `aria-describedby` wired from the trigger
 * while open, dismissal on `Escape`, blur and outside press, never a native `title`.
 *
 * The trigger's own `stopPropagation` on click keeps it from ever reaching the sort
 * button's `onClick` — the two are siblings, not ancestor/descendant, so there is no click
 * bubbling from the trigger INTO the sort button in the first place; the guard here is for
 * completeness against any future ancestor click handler on the `<th>`.
 *
 * Icon colour is `text-muted-foreground`, deliberately NOT `headerColorClassName` — R-D18's
 * accent/teal is reserved for the sort control in every state (idle/hover/active-sort) and
 * must never compete with a second colour-carrying element in the same `<th>` (§9.2.1).
 */
export function AnalysisEngagementHeaderTooltip({ columnId }: AnalysisEngagementHeaderTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);

  const operands = ENGAGEMENT_HEADER_TOOLTIP_OPERANDS[columnId];

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        // Only ever called with `false` (outside-press / `Escape`) — no `Trigger` is
        // rendered, so the primitive never opens the popup on its own.
        if (!nextOpen) setOpen(false);
      }}
    >
      <button
        ref={anchorRef}
        type="button"
        aria-label={ENGAGEMENT_HEADER_TOOLTIP_TRIGGER_LABEL[columnId]}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={(event) => {
          if (event.target.matches(":focus-visible")) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className="inline-flex items-center text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <InfoIcon className="size-3" aria-hidden="true" />
      </button>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={anchorRef}
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-50"
        >
          <PopoverPrimitive.Popup
            id={tooltipId}
            role="tooltip"
            initialFocus={false}
            finalFocus={false}
            className="w-72 space-y-2 rounded-md border bg-popover p-3 text-xs normal-case text-popover-foreground shadow-md"
          >
            <p className="text-sm font-semibold">{ENGAGEMENT_HEADER_TOOLTIP_HEADING[columnId]}</p>
            <div className="space-y-0.5 text-center">
              <p data-testid="operand-numerator">{operands.numerator}</p>
              <p data-testid="operand-denominator" className="border-t pt-0.5">
                {operands.denominator}
              </p>
            </div>
            <p>{ENGAGEMENT_HEADER_TOOLTIP_BODY[columnId]}</p>
            <p>{ENGAGEMENT_HEADER_TOOLTIP_COMPARISON[columnId]}</p>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
