import { EngagementCount } from "@/app/app/analyses/components/counts/EngagementCount";
import { ABSENT_COUNT_REASON_COPY } from "@/lib/api/analyses/constants";
import type { AnalysisCountsCellProps } from "@/app/app/analyses/components/grids/AnalysisDataTable/components/cells/AnalysisCountsCell/types";

/**
 * Column 4 — Counts (ticket #146, TDD §9.5 / DESIGN-3C §2.2). Reuses the four shipped count
 * states (`EngagementCount`) verbatim — no second visual language is invented here.
 *
 * OR-11's three-case absent-count reason is the one genuinely new piece of copy this cell
 * adds: when the reach figure is `"unknown"` (never fetched / not resolvable), the bare `—`
 * the shared component renders is followed by a plain-language reason instead of standing
 * alone. Case 1 (`CREATOR_DISABLED`) is structurally unreachable here — a `true` disabled flag
 * always classifies as `"hidden"`, not `"unknown"` (`classifyReachCountState`), and that state
 * already carries its own explanation via `EngagementCount`'s info tooltip — so only case 2
 * (`TYPE_NOT_REPORTED`) and case 3 (`NOT_AVAILABLE`, the mandatory non-fallback default) ever
 * render from this branch.
 */
export function AnalysisCountsCell({
  reachCountState,
  likeCountState,
  absentCountReason,
  comfortable,
}: AnalysisCountsCellProps) {
  return (
    <>
      <EngagementCount state={reachCountState} metric="views" />
      {reachCountState.kind === "unknown" && (
        <p className="text-xs text-muted-foreground">{ABSENT_COUNT_REASON_COPY[absentCountReason]}</p>
      )}
      {comfortable && (
        <p className="text-xs text-muted-foreground">
          <EngagementCount state={likeCountState} metric="likes" /> · <span aria-hidden="true">—</span>
        </p>
      )}
    </>
  );
}
