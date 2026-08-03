"use client";

import { useId, useRef, useState } from "react";
import { InfoIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import {
  ENGAGEMENT_HIDDEN_TOOLTIP_COPY,
  ENGAGEMENT_HIDDEN_TRIGGER_LABEL,
  ENGAGEMENT_INFO_ICON_CLASSNAME,
} from "@/app/app/analyses/components/counts/EngagementCount/constants";
import type { CountInfoTooltipProps } from "@/app/app/analyses/components/counts/EngagementCount/types";

/**
 * The `hidden`-state info trigger (design §2, §6, §7). Replicates the ticket #70
 * `DimensionScoreRow` tooltip mechanism — a real focusable `<button>` with
 * `aria-describedby` pointing at a `role="tooltip"` element, opened on hover, focus,
 * OR click/tap, dismissed on blur/mouse-out/`Escape`/outside click/tap/second click.
 * Deliberately NOT a native `title` attribute (not reliably keyboard/screen-reader
 * reachable, per #70's own note).
 *
 * The click/tap handler exists because this trigger can render inside an ancestor
 * click region (e.g. `AnalysisCard`'s whole-row click-to-open-detail area) and
 * because touch devices have no hover — `stopPropagation`/`preventDefault` keep
 * activation from bubbling into that ancestor, and the click-toggle is what makes
 * the tooltip reachable at all on touch.
 *
 * Diverges from #70 only in color: the icon renders info-blue instead of
 * `text-muted-foreground`, a design-approved divergence (design §2) — this is a
 * standalone info affordance the analyst must notice, not an inline "why?" link.
 *
 * Portal/flip (#103, decision D2): the popup previously rendered as a plain
 * `absolute right-0 top-full` `<div>` positioned relative to a wrapping `<span>`. That
 * broke on the two surfaces this ticket adds: `components/ui/table.tsx` wraps every
 * table in a `relative overflow-auto` div, which both clips AND scroll-jails an
 * absolutely-positioned descendant, and `<Card>` (#102) is `overflow-hidden`. Both
 * surfaces need the popup to escape their nearest clipping ancestor and to flip away
 * from viewport/container edges (design §6: "default above-and-right ... flip to below
 * or left"). The repo's `components/ui/popover.tsx` Base UI primitives solve exactly
 * this: `Portal` renders into `document.body` (escapes the clipping/scroll ancestor)
 * and `Positioner` runs Floating UI's collision-aware flip/shift natively, so there is
 * no hand-rolled edge detection here.
 *
 * Only the RENDERING of the popup is delegated to the primitive — the open/close
 * interaction contract below (hover, `:focus-visible`-guarded focus-open, click-toggle
 * with `stopPropagation`, `Escape`) is unchanged from #70/#102. No `Popover.Trigger` is
 * rendered (the real `<button>` below is the anchor instead, referenced explicitly via
 * `Positioner`'s `anchor` prop), so the primitive never opens the popup on its own —
 * only our own handlers call `setOpen(true)`. `Popover.Root`'s `onOpenChange` only ever
 * fires `false` here (outside-press or `Escape`, both handled internally by the
 * primitive against the *portaled* popup), which is accepted unconditionally. This is
 * also what avoids the outside-click regression a naive portal swap would introduce:
 * the previous implementation closed on any `mousedown`/`touchstart` outside a
 * `containerRef` that wrapped both the button AND the popup — once the popup moves into
 * a portal it is no longer a DOM descendant of that ref, so a click INSIDE the
 * (now-portaled) popup would have been misread as an outside click and closed itself
 * instantly. Delegating outside-press detection to the primitive sidesteps that: it
 * already knows the portaled popup and the anchor button are both "inside".
 */
export function CountInfoTooltip({ metric }: CountInfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);

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
        aria-label={ENGAGEMENT_HIDDEN_TRIGGER_LABEL[metric]}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={(event) => {
          // Only auto-open for genuine keyboard focus. A tap also fires `focus`
          // immediately before `click` — if this opened unconditionally, the
          // click's toggle below would immediately flip it back closed, making
          // the tooltip unreachable on touch again (the exact bug this fixes).
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
        className={`inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ENGAGEMENT_INFO_ICON_CLASSNAME}`}
      >
        <InfoIcon className="size-3.5" aria-hidden="true" />
      </button>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={anchorRef}
          side="top"
          align="end"
          sideOffset={4}
          collisionPadding={8}
          className="z-50"
        >
          <PopoverPrimitive.Popup
            id={tooltipId}
            role="tooltip"
            initialFocus={false}
            finalFocus={false}
            className="w-64 rounded-md border bg-popover p-2.5 text-xs text-popover-foreground shadow-md"
          >
            {ENGAGEMENT_HIDDEN_TOOLTIP_COPY}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
