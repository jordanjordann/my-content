import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ANALYSES_TABLE_COLUMNS } from "@/app/app/analyses/components/grids/AnalysisDataTable/constants";

type AnalysisTableErrorStateProps = {
  message: string;
  onRetry: () => void;
};

/** Design §7 — rose-marked, distinguished from the empty states by colour AND a retry action. */
export function AnalysisTableErrorState({ message, onRetry }: AnalysisTableErrorStateProps) {
  return (
    <tr>
      <td colSpan={ANALYSES_TABLE_COLUMNS.length} className="py-16">
        <div className="flex flex-col items-center justify-center text-center">
          <AlertTriangle className="mb-4 h-12 w-12 text-rose-500" aria-hidden="true" />
          <h2 className="mb-2 text-lg font-semibold text-rose-500">Couldn&apos;t load analyses</h2>
          <p className="mb-6 text-sm text-muted-foreground">{message}</p>
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </td>
    </tr>
  );
}
