import type { AbsentCountReason, CountState } from "@/lib/api/analyses/types";

export type AnalysisCountsCellProps = {
  /** Sourced from `performance.computed.reach`, never the raw `viewCountState` (PR #198
   * review blocker 4) — see `deriveAnalysisTablePerformance`. */
  reachCountState: CountState;
  likeCountState: CountState;
  /** Ticket #205 — sourced from `performance.computed.comments` via `classifyCommentCountState`
   * (`deriveAnalysisTablePerformance`), the same way `reachCountState` is sourced from
   * `performance.computed.reach`. */
  commentCountState: CountState;
  /** OR-11 (TDD §9.5) — always present; only rendered when `reachCountState.kind` is
   * `"unknown"` (case 1, `CREATOR_DISABLED`, always yields the `"hidden"` state instead, which
   * already carries its own explanation via `EngagementCount`'s tooltip). */
  absentCountReason: AbsentCountReason;
  /** DESIGN-3C §3.1/§3.2 — the likes line only renders in Comfortable density. */
  comfortable: boolean;
};
