import { BarChart3, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ANALYSES_TABLE_COLUMNS } from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";

type AnalysisTableEmptyStateProps =
  | { variant: "nothing-analysed"; onNewAnalysis: () => void }
  | { variant: "no-match"; onClearFilters: () => void };

/**
 * Design §7 — two DISTINCT empty states, different copy and a different action.
 * Renders inside the table frame, header intact (caller keeps the `<thead>` mounted).
 */
export function AnalysisTableEmptyState(props: AnalysisTableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={ANALYSES_TABLE_COLUMNS.length} className="py-16">
        <div className="flex flex-col items-center justify-center text-center">
          {props.variant === "nothing-analysed" ? (
            <>
              <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
              <h2 className="mb-2 text-lg font-semibold">No analyses yet</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Paste some URLs and get AI-powered insights on your content.
              </p>
              <Button onClick={props.onNewAnalysis}>Analyse a post</Button>
            </>
          ) : (
            <>
              <SearchX className="mb-4 h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
              <h2 className="mb-2 text-lg font-semibold">No analyses match these filters</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Try widening or clearing your filters to see more results.
              </p>
              <Button variant="outline" onClick={props.onClearFilters}>
                Clear all filters
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
