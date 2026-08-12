import type { AnalysisTableEngagementCell, Denominator } from "@/lib/api/analyses/types";

export type AnalysisEngagementCellProps = {
  /** Precomputed in `lib/api/analyses/helpers.ts`'s `deriveEngagementCell` (`hooks.ts`
   * `select`) — this component formats, it never re-derives. */
  cell: AnalysisTableEngagementCell;
  /** Which of the two dedicated columns this is (OR-3 / R-12.3.4) — drives the colour family
   * and the `≈` prefix, never which figure is shown (that is `cell.kind`/`cell.denominator`,
   * already resolved upstream). */
  denominator: Denominator;
};
