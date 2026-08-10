import { assertNever } from "./types";
import type { AvailabilityState } from "./types";

/**
 * Ticket #143 (TDD §2's module map) owns the full `judgement.ts` —
 * `tierUsed`, `confidence`, `basedOnVideos`, `provisional` and the full
 * seven-member `unavailableReason` enum — and has not started (no branch,
 * no PR, as of this ticket). This file is deliberately narrow: ticket #169
 * (PRD R-13.5.3/R-13.5.3a/R-13.5.3b, AC-30; TDD §5.3; DESIGN-3B §5 rows 1
 * and 3) exists to make ONE fact reachable and distinguishable before #143
 * is dispatched — see that ticket's "must land before #143" sequencing
 * note. #143 must import `resolveHiddenCountsUnavailableReason` from here
 * for this slice of its own resolution rather than re-deriving it (this IS
 * the module TDD §2 names for this logic — it is not a second home).
 *
 * The other five `unavailableReason` values (`REACH_UNKNOWN`,
 * `CONTENT_KIND_UNSUPPORTED`, `REACH_NOT_ON_FIRST_SLIDE`,
 * `NO_AUDIENCE_DATA`, `INSUFFICIENT_HISTORY`) are out of scope here and
 * this function returns `null` for every case that isn't one of the two
 * facts below — callers must not treat `null` as "no reason", only as
 * "not this function's concern".
 */

/**
 * The two facts R-13.5.3a says must not share one enum value. A
 * discriminated string-literal union, not `string` — a caller cannot pass
 * (or a mapping cannot silently produce) a third value that collapses row
 * 1 and row 3 without `tsc` rejecting it.
 */
export type HiddenCountsUnavailableReason = "REACH_HIDDEN" | "CAUSE_NOT_DETERMINABLE";

/**
 * Instagram's `like_and_view_counts_disabled` tri-state as it survives to
 * this resolver (TDD §1.6): `true` (confirmed), `false` (confirmed not),
 * or absent (`null`/`undefined` — payload never carried the key, or it was
 * never fetched). `false` is deliberately NOT treated as "absent" — a
 * confirmed `false` means we KNOW the counts are not hidden, which is a
 * different epistemic state from "we cannot tell" (R-13.5.3).
 */
type HiddenCountsFlag = boolean | null | undefined;

/**
 * DESIGN-3B §5 rows 1 and 3 / TDD §5.3 / PRD R-13.5.3, R-13.5.3a.
 *
 * - **Row 1 (`REACH_HIDDEN`):** the flag is CONFIRMED `true`. This wins
 *   unconditionally, regardless of whether any input happens to be usable
 *   — comments are unaffected by the flag (V1) and can still be present on
 *   a counts-hidden post, but that does not change the creator's setting.
 * - **Row 3 (`CAUSE_NOT_DETERMINABLE`):** no usable performance input
 *   exists (reach, likes and comments are all unresolvable — `UNKNOWN` or
 *   `HIDDEN`, never `AVAILABLE`/`ZERO`) AND the flag is ABSENT from the
 *   payload. Absence means we genuinely cannot tell whether the creator
 *   hid their counts (R-13.5.3) — asserting `REACH_HIDDEN` here would be
 *   Decision 6's forbidden fabrication (a confident-looking wrong cause).
 * - A confirmed `false` flag with no usable inputs is NEITHER of these two
 *   facts (we know it isn't hidden) — that case belongs to #143's other
 *   resolvers (e.g. `REACH_UNKNOWN`), so this function returns `null`.
 * - Any state with at least one usable input is not an absence case at
 *   all — a score is computable — so this function returns `null` there
 *   too, regardless of the flag.
 */
export function resolveHiddenCountsUnavailableReason(params: {
  likeAndViewCountsDisabled: HiddenCountsFlag;
  reachState: AvailabilityState;
  likeState: AvailabilityState;
  commentState: AvailabilityState;
}): HiddenCountsUnavailableReason | null {
  if (params.likeAndViewCountsDisabled === true) {
    return "REACH_HIDDEN";
  }

  const isFlagAbsent =
    params.likeAndViewCountsDisabled === null || params.likeAndViewCountsDisabled === undefined;
  const hasUsableInput = [params.reachState, params.likeState, params.commentState].some(
    (state) => state === "AVAILABLE" || state === "ZERO",
  );

  if (isFlagAbsent && !hasUsableInput) {
    return "CAUSE_NOT_DETERMINABLE";
  }

  return null;
}

/**
 * DESIGN-3B §5 rows 1 and 3, L1 (in-cell) short form. **The copy is not
 * touched here** — these are the exact strings DESIGN-3B already carries;
 * this function only guarantees, at the type level, that the two rows
 * cannot be mapped to the same string (an exhaustive `switch` over a
 * closed 2-member union, with `assertNever` on the impossible branch —
 * AGENTS.md/owner preference: illegal states unrepresentable, not a doc
 * comment). #144/#145 own the remaining five reasons' L1 strings and the
 * L2 popover copy for all seven — this function must not be widened to
 * cover them; it exists only to make R-13.5.3a's two-fact split provably
 * render as two different strings (AC-30).
 */
export function renderHiddenCountsReasonShortForm(reason: HiddenCountsUnavailableReason): string {
  switch (reason) {
    case "REACH_HIDDEN":
      return "Creator hid the counts";
    case "CAUSE_NOT_DETERMINABLE":
      return "No performance data published";
    default:
      return assertNever(reason);
  }
}
