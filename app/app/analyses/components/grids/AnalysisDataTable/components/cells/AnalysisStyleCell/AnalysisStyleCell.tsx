import { EnumValueBadge } from "@/app/app/analyses/components/sections/AnalysisStyleSection/components/badges/EnumValueBadge";
import { FORMAT_ARCHETYPE_LABELS, HOOK_TYPE_LABELS } from "@/lib/analysis/taxonomy/labels";
import type { AnalysisStyleCellProps } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisStyleCell/types";

/**
 * Ticket #149 / Q3 (DESIGN-3C §6.3, ruled 2026-08-09) — the optional Style column
 * (`formatArchetype` + `hookType`), OFF BY DEFAULT and reachable only from the `Columns` menu
 * (R-15.2.2). Reuses `EnumValueBadge` verbatim — the same badge `AnalysisStyleSection` already
 * ships on the detail page — rather than a second badge component.
 *
 * Contrast (AC-17, §8.4.6 method, real dark tokens): `EnumValueBadge`'s `bg-primary/10
 * text-primary` pattern, re-measured in this NEW surface (a table cell, not the detail page) —
 * **6.36 / 6.04 / 5.72 / 5.38** against background / card / row-hover / muted. All ≥ 4.5:1.
 */
export function AnalysisStyleCell({ style }: AnalysisStyleCellProps) {
  if (style == null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <EnumValueBadge label={FORMAT_ARCHETYPE_LABELS[style.formatArchetype]} identifier={style.formatArchetype} />
      <EnumValueBadge label={HOOK_TYPE_LABELS[style.hookType]} identifier={style.hookType} />
    </div>
  );
}
