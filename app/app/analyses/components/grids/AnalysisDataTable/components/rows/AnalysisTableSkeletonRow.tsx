import { ANALYSES_TABLE_COLUMNS, ROW_HEIGHT_PX } from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";

/**
 * Loading state (design §7): skeleton rows in the EXACT column grid, never a centred
 * spinner. The header renders real (see `AnalysisTableColumnHeaders`), so the page does
 * not reflow when data lands.
 */
export function AnalysisTableSkeletonRow() {
  return (
    <tr style={{ height: ROW_HEIGHT_PX.comfortable }} className="border-b" aria-hidden="true">
      {ANALYSES_TABLE_COLUMNS.map((column) => (
        <td key={column.id} className="p-3 align-middle">
          {column.id === "content" ? (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          )}
        </td>
      ))}
    </tr>
  );
}
