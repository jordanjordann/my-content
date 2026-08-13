import { CONTENT_KIND_LABELS, MODE_CHIP_LABELS } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisContentCell/constants";
import type { AnalysisContentCellProps } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisContentCell/types";
import { cn } from "@/lib/utils";

/**
 * Ticket #149 / DESIGN-3C §2.1 — column 1, absorbing the old "column #3" (content kind +
 * `analysis_mode`). Kind badge overlaid on the thumbnail, title/caption snippet, and a mode
 * chip (`Caption only` / `Images only`) shown **only** when the mode is not `full_video`
 * (AC-13 — the labelled badge is in the rendered text, never colour/icon alone, WCAG 1.4.1).
 *
 * Contrast (AC-17, §8.4.6 method, re-measured against this app's real dark tokens, not
 * DESIGN-3C §9's stand-in values) — both badges share one pattern, `bg-slate-300/10
 * text-slate-300`: **11.87 / 11.20 / 10.53 / 9.85** against background / card / row-hover /
 * muted. All ≥ 4.5:1 with wide margin.
 */
export function AnalysisContentCell({
  title,
  caption,
  thumbnailUrl,
  mediaType,
  analysisMode,
  comfortable,
  failedLabel,
}: AnalysisContentCellProps) {
  const failed = failedLabel != null;
  const modeChipLabel = !failed && analysisMode != null ? MODE_CHIP_LABELS[analysisMode] : undefined;

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted" aria-hidden="true">
        {thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- proxied/external thumbnails, same as the rest of this table.
          <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
        )}
        <span className="absolute right-0 bottom-0 rounded-tl bg-slate-300/10 px-1 py-0.5 text-[9px] leading-none font-medium text-slate-300">
          {CONTENT_KIND_LABELS[mediaType]}
        </span>
      </div>
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-medium", failed && "text-muted-foreground")}>
          {title || caption || "Untitled"}
        </p>
        {failed && <p className="text-xs text-muted-foreground">{failedLabel}</p>}
        {!failed && modeChipLabel && (
          <span className="mt-0.5 inline-block rounded bg-slate-300/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
            {modeChipLabel}
          </span>
        )}
        {/* PR #198 review blocker 7 — line 2 is never truncated; the column widens instead if
            the text doesn't fit. No `truncate` class here, deliberately. */}
        {!failed && comfortable && caption && (
          <p className="text-xs text-muted-foreground">{caption}</p>
        )}
      </div>
    </div>
  );
}
