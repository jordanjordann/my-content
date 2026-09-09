import { AnalysisScoreExplainPopover } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/popovers/AnalysisScoreExplainPopover";
import { ScorePerformanceGroup } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisScoreCell";
import type { AnalysisPerformanceCellProps } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisPerformanceCell/types";

/**
 * The Performance cell/field's full branch set — failed, no performance block, `dash`,
 * `no-judgement`, `reason`, and the real score — factored out of `AnalysisTableRow.tsx`'s
 * private `PerformanceCell` (PR #348 review, P2) so the table and the <640px card
 * (`AnalysisSummaryCard`, ticket #337) render this copy from one shared source instead of two
 * hand-mirrored copies that can drift apart. The single thing that varies between the two call
 * sites is `withExplainTrigger` — see `types.ts`.
 */
export function AnalysisPerformanceCell({ row, failed, withExplainTrigger }: AnalysisPerformanceCellProps) {
  if (failed) {
    return <span className="text-[12.5px] text-muted-foreground">Not analysed</span>;
  }

  if (row.tableDerived == null) {
    // Row 9 (DESIGN-3B §5.5) — a completed analysis with no performance block at all. NOT
    // the failed treatment: nothing failed, so no rose edge and no "Not analysed" (that
    // string is row 7's). There is no computed block for a popover to show, so this row
    // carries no `ⓘ` — the affordance must never open onto an empty popover.
    return <p className="text-[11px] text-muted-foreground">Performance wasn&apos;t measured</p>;
  }

  const cell = row.tableDerived.performanceCell;

  if (cell.kind === "dash") {
    // `INSUFFICIENT_HISTORY` — declared on `UnavailableReason`, never produced (DESIGN-3B
    // §5.5). No approved copy exists for it; the muted "—" stays, on purpose.
    return <span className="text-[12.5px] text-muted-foreground">—</span>;
  }

  if (cell.kind === "no-judgement") {
    // Row 8 (DESIGN-3B §5.5) — a performance block exists and the model declined to score
    // it. The row keeps its single `ⓘ` when one is available: a computed block exists, so
    // the popover has real content.
    return (
      <p className="text-[11px] text-muted-foreground">
        No 1–5 for this post
        {withExplainTrigger && (
          <>
            {" "}
            <AnalysisScoreExplainPopover row={row} />
          </>
        )}
      </p>
    );
  }

  if (cell.kind === "reason") {
    return <p className="text-[11px] text-muted-foreground">{cell.text}</p>;
  }

  return (
    <ScorePerformanceGroup
      score={cell.score}
      tierPhrase={cell.tierPhrase}
      isTier3={cell.isTier3}
      confidenceWord={cell.confidenceWord}
      explainTrigger={withExplainTrigger ? <AnalysisScoreExplainPopover row={row} /> : null}
    />
  );
}
