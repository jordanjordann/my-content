"use client";

import { useId, useState } from "react";
import { InfoIcon } from "lucide-react";

import {
  ENGAGEMENT_HIDDEN_TOOLTIP_COPY,
  ENGAGEMENT_HIDDEN_TRIGGER_LABEL,
  ENGAGEMENT_INFO_ICON_CLASSNAME,
} from "@/app/app/analyses/components/counts/EngagementCount/constants";
import type { CountInfoTooltipProps } from "@/app/app/analyses/components/counts/EngagementCount/types";

/**
 * The `hidden`-state info trigger (design §2, §6, §7). Replicates the ticket #70
 * `DimensionScoreRow` tooltip mechanism exactly — a real focusable `<button>` with
 * `aria-describedby` pointing at a `role="tooltip"` element, opened on hover OR
 * focus, dismissed on blur/mouse-out/`Escape`. Deliberately NOT a native `title`
 * attribute (not reliably keyboard/screen-reader reachable, per #70's own note).
 *
 * Diverges from #70 only in color: the icon renders info-blue instead of
 * `text-muted-foreground`, a design-approved divergence (design §2) — this is a
 * standalone info affordance the analyst must notice, not an inline "why?" link.
 */
export function CountInfoTooltip({ metric }: CountInfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={ENGAGEMENT_HIDDEN_TRIGGER_LABEL[metric]}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
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
