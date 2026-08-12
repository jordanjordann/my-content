"use client";

import { useId, useRef, useState } from "react";
import { InfoIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import {
  SCORE_EXPLAIN_DRIVERS_HEADING,
  SCORE_EXPLAIN_HEADING,
  SCORE_EXPLAIN_JUDGEMENT_INTRO,
  SCORE_EXPLAIN_MEASURED_HEADING,
  SCORE_EXPLAIN_OPERANDS_HEADING,
  SCORE_EXPLAIN_TRIGGER_LABEL,
  scoreExplainFooter,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/components/popovers/AnalysisScoreExplainPopover/constants";
import {
  buildOperandRows,
  formatMeasuredDate,
  formatMeasuredEngagementLine,
  formatMeasuredMultiplierLine,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/components/popovers/AnalysisScoreExplainPopover/helpers";
import type { AnalysisScoreExplainPopoverProps } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/popovers/AnalysisScoreExplainPopover/types";

/**
 * TDD §9.4 / DESIGN-3B §7 — the ONE `ⓘ` per row, in the Performance cell only (§5.1).
 * Reuses the shipped ticket-#70 interaction contract exactly as `CountInfoTooltip`
 * (`app/app/analyses/components/counts/EngagementCount/components/tooltips/CountInfoTooltip.tsx`)
 * already does — real `<button>`, hover AND keyboard-focus open, `role="tooltip"` +
 * `aria-describedby`, `Escape`/outside-press/blur dismiss, never a native `title`. Only the
 * content differs (structured explanation, not a one-line string) — the open/close
 * mechanism is copied deliberately, not reinvented.
 *
 * `data-row-exempt` on the trigger is REQUIRED: `AnalysisTableRow`'s row click-to-open-modal
 * handler explicitly skips any descendant carrying it (PR #198). Without it, clicking `ⓘ`
 * would both open this popover AND open the row detail modal underneath it.
 *
 * Note (PR #201 review, N2): this trigger's own `event.stopPropagation()` below ALSO
 * prevents the click from ever reaching the row's handler, so on this specific element the
 * two mechanisms overlap — `data-row-exempt` is defense-in-depth here, not the sole
 * safeguard. It stays required regardless: it is the general, name-agnostic contract
 * `AnalysisTableRow` documents for ANY exempt descendant, including a future one that does
 * not call `stopPropagation()` itself (e.g. #149's creator link). The guard's own
 * behaviour, independent of `stopPropagation`, is exercised directly in
 * `Analysis147ScoreCellIntegration.dom.test.tsx`.
 *
 * Content order is the ticket's exact sequence (TDD §9.4 / DESIGN-3B §7, "order is itself an
 * argument about which number to trust"):
 *   1. the judgement disclaimer, 2. the measured figures, 3. the operand list (no worked
 *   division, R-13.3.4), 4. the disagreement line (precomputed in `hooks.ts`'s `select`
 *   layer, never here), 5. `drivers[]` under "Why it did what it did" in Gemini's
 *   Indonesian, unedited, 6. the unconditional footer.
 */
export function AnalysisScoreExplainPopover({ row }: AnalysisScoreExplainPopoverProps) {
  const [open, setOpen] = useState(false);
  const popupId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);

  const computed = row.performance?.computed ?? null;
  const drivers = row.performance?.judgement.drivers ?? [];
  const disagreementLine = row.tableDerived?.disagreementLine ?? null;
  const multiplierCell = row.tableDerived?.multiplierCell ?? null;
  const bucketNoun =
    multiplierCell?.kind === "measured" || multiplierCell?.kind === "cold-start"
      ? multiplierCell.bucketNoun
      : null;
  const multiplier = multiplierCell?.kind === "measured" ? multiplierCell.multiplier : null;

  if (computed == null) {
    return null;
  }

  const measuredEngagementLine = formatMeasuredEngagementLine(computed.tier1);
  const measuredMultiplierLine = formatMeasuredMultiplierLine(multiplier, bucketNoun);
  const operandRows = buildOperandRows(computed, bucketNoun);

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setOpen(false);
      }}
    >
      <button
        ref={anchorRef}
        type="button"
        data-row-exempt="true"
        aria-label={SCORE_EXPLAIN_TRIGGER_LABEL}
        aria-describedby={open ? popupId : undefined}
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
        <InfoIcon className="size-3.5" aria-hidden="true" />
      </button>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={anchorRef}
          side="top"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-50"
        >
          <PopoverPrimitive.Popup
            id={popupId}
            role="tooltip"
            initialFocus={false}
            finalFocus={false}
            className="w-80 space-y-3 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-md"
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold">{SCORE_EXPLAIN_HEADING}</p>
              <p className="text-muted-foreground">{SCORE_EXPLAIN_JUDGEMENT_INTRO}</p>
            </div>

            {(measuredEngagementLine != null || measuredMultiplierLine != null) && (
              <div className="space-y-1">
                <p className="font-medium">{SCORE_EXPLAIN_MEASURED_HEADING}</p>
                {measuredEngagementLine != null && <p>{measuredEngagementLine}</p>}
                {measuredMultiplierLine != null && <p>{measuredMultiplierLine}</p>}
              </div>
            )}

            {operandRows.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium">{SCORE_EXPLAIN_OPERANDS_HEADING}</p>
                <dl className="space-y-0.5">
                  {operandRows.map((operandRow) => (
                    <div key={operandRow.label} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{operandRow.label}</dt>
                      <dd className="tabular-nums">{operandRow.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {disagreementLine != null && <p className="font-medium">{disagreementLine}</p>}

            {drivers.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium">{SCORE_EXPLAIN_DRIVERS_HEADING}</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {drivers.map((driver, index) => (
                    // Indonesian, verbatim from Gemini — never translated or edited (TDD §9.4
                    // item 5). No stable id on the string itself; index is safe because this
                    // list is never reordered or mutated after render.
                    <li key={index}>{driver}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="border-t pt-2 text-muted-foreground">
              {scoreExplainFooter(formatMeasuredDate(row.createdAt))}
            </p>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
