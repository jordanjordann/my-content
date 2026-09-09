import {
  formatPostedAge,
  formatPostedDate,
} from "@/app/app/analyses/components/grids/AnalysisDataTable/helpers";
import type { AnalysisPostedCellProps } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisPostedCell/types";

/**
 * The `Posted` cell/field, factored out of `AnalysisTableRow.tsx`'s inline `"posted"` render
 * branch (PR #348 review, P2) so the table and the <640px card (`AnalysisSummaryCard`, ticket
 * #337) render this from one shared source instead of two hand-mirrored copies. `formatPostedDate`
 * / `formatPostedAge` were already shared pure formatters; this component shares the JSX
 * structure (the `—` failed fallback and the "Early" provisional badge) around them too.
 */
export function AnalysisPostedCell({ row, failed }: AnalysisPostedCellProps) {
  if (failed) {
    return <span className="text-[12.5px] text-muted-foreground">—</span>;
  }
  return (
    <>
      <p className="text-[12.5px]">{formatPostedDate(row.postDate) ?? "—"}</p>
      <p className="text-[11px] text-muted-foreground">
        {formatPostedAge(row.postDate) ?? "—"}
        {row.performance?.computed.provisional && (
          <>
            {" · "}
            <span className="rounded bg-accent/12 px-1.5 py-0.5 text-[10px] font-semibold text-accent">Early</span>
          </>
        )}
      </p>
    </>
  );
}
