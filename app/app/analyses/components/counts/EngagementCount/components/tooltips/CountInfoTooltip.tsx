"use client";

import { useEffect, useId, useRef, useState } from "react";
import { InfoIcon } from "lucide-react";

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
 */
export function CountInfoTooltip({ metric }: CountInfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleOutsideInteraction(event: MouseEvent | TouchEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideInteraction);
    document.addEventListener("touchstart", handleOutsideInteraction);
    return () => {
      document.removeEventListener("mousedown", handleOutsideInteraction);
      document.removeEventListener("touchstart", handleOutsideInteraction);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-flex">
      <button
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
      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute right-0 top-full z-10 mt-1 w-64 rounded-md border bg-popover p-2.5 text-xs text-popover-foreground shadow-md"
        >
          {ENGAGEMENT_HIDDEN_TOOLTIP_COPY}
        </div>
      )}
    </span>
  );
}
