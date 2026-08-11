import { ANALYSES_TABLE_COLUMNS } from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";

type AnalysisSinkDividerProps = {
  label: string;
};

/**
 * R-S2 — the sink group is visible, labelled and counted; silence here is what makes a
 * user think the table is broken. Also used for the failed/non-completed group at the
 * very bottom (design §3.3), with its own distinct label.
 */
export function AnalysisSinkDivider({ label }: AnalysisSinkDividerProps) {
  return (
    <tr aria-hidden="false">
      <td colSpan={ANALYSES_TABLE_COLUMNS.length} className="border-b bg-muted/30 px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </td>
    </tr>
  );
}
