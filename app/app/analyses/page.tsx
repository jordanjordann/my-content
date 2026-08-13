import { Suspense } from "react";

import { AnalysesContent } from "@/app/app/analyses/components/AnalysesContent";
import { AnalysisGridSkeleton } from "@/app/app/analyses/components/grids/AnalysisGridSkeleton";

/**
 * Ticket #149 — `AnalysisGridSkeleton` (docs/RUNBOOK.md §8.5) documents itself as "live and
 * imported", but as of this ticket nothing in `app/` actually rendered it — `AnalysesContent`
 * reads `useSearchParams`, so this `Suspense` boundary's fallback is what shows during that
 * bail-out, and it had regressed to a plain "Loading..." div. Restored to the RUNBOOK's own
 * documented shape rather than left stale (and rather than silently deleting a module the
 * ticket explicitly says is NOT dead code).
 */
export default function AnalysesPage() {
  return (
    <Suspense fallback={<div className="p-6"><AnalysisGridSkeleton /></div>}>
      <AnalysesContent />
    </Suspense>
  );
}
