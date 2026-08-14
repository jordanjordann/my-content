import { cn } from "@/lib/utils";
import { ENGAGEMENT_CELL_QUALIFIER_CLASSNAME } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisEngagementCell/constants";
import {
  formatEngagementAccessiblePhrase,
  formatEngagementQualifierLabel,
  formatEngagementValueLabel,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisEngagementCell/helpers";
import type { AnalysisEngagementCellProps } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisEngagementCell/types";

/**
 * Columns 8/9 — Eng. / reach, Eng. / followers (ticket #146, OR-3 / R-12.3.4). ONE component,
 * a `denominator` prop selects which of the two dedicated columns this instance renders —
 * there is no single "engagement" column and no code path that could interleave the two
 * denominators (that is the whole point of the ruling: structurally impossible, not
 * merely tested-for).
 *
 * Every row fills exactly one of the two columns; the other renders `cell.kind === "reason"`
 * (a plain-language reason, never a blank) or `"dash"` (no performance data for this row at
 * all — the same honest `—` every other absent metric in this table uses).
 *
 * Three always-on distinguishers, all rendered with no hover and no legend (R-8.4.7):
 * different qualifier text per cell (`helpers.ts`), the mandatory `≈` prefix on every
 * follower-denominated figure, and the amber/teal colour families on the QUALIFIER line as a
 * redundant third channel only (`constants.ts`, §9.2) — never the only signal (WCAG 1.4.1).
 * The value line (the percentage) always renders in the default foreground colour.
 */
export function AnalysisEngagementCell({ cell, denominator }: AnalysisEngagementCellProps) {
  if (cell.kind === "dash") {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  if (cell.kind === "reason") {
    return <p className="text-xs text-muted-foreground">{cell.text}</p>;
  }

  // AC-16 / PR #200 review, blocker B2 — `ReachKind` is a three-member union
  // (`"PLAYS" | "VIEWS" | "UNKNOWN"`); a stored kind of `UNKNOWN` means the server itself
  // could not say whether this figure is views or plays. Rendering either word would be a
  // confident, specific, WRONG attribution (R-4.3.1). Reuse the same honest `—` this
  // component already renders for `cell.kind === "dash"`, rather than guessing.
  if (cell.kind === "value" && cell.denominator === "REACH" && cell.reachKind === "UNKNOWN") {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const valueLabel = formatEngagementValueLabel(cell);
  const qualifierLabel = formatEngagementQualifierLabel(cell);
  const accessiblePhrase = formatEngagementAccessiblePhrase(cell);

  return (
    // `role="img"` collapses the two visible lines into the one accessible phrase named
    // below — the same technique `EngagementCount`'s `unknown` state already uses in this
    // codebase — so a screen reader announces "4.1 percent of 482,100 views" as a single
    // phrase, never the value and the qualifier as two detached fragments.
    <div role="img" aria-label={accessiblePhrase}>
      <p aria-hidden="true" className="text-sm font-medium tabular-nums text-foreground">
        {valueLabel}
      </p>
      <p aria-hidden="true" className={cn("text-xs", ENGAGEMENT_CELL_QUALIFIER_CLASSNAME[denominator])}>
        {qualifierLabel}
      </p>
    </div>
  );
}
