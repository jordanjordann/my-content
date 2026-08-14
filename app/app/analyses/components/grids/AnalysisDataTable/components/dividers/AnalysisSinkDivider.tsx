type AnalysisSinkDividerProps = {
  label: string;
  /** Ticket #149 — the number of currently-visible columns (varies with the Style toggle). */
  colSpan: number;
};

/**
 * R-S2 — the sink group is visible, labelled and counted; silence here is what makes a
 * user think the table is broken. Also used for the failed/non-completed group at the
 * very bottom (design §3.3), with its own distinct label.
 */
export function AnalysisSinkDivider({ label, colSpan }: AnalysisSinkDividerProps) {
  return (
    <tr aria-hidden="false">
      <td colSpan={colSpan} className="border-b bg-muted/30 px-3 py-1.5">
        <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </td>
    </tr>
  );
}
