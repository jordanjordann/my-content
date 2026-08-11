/**
 * Isomorphic (no DB, no `server-only`, no node builtin) — the single home for turning
 * `UnavailableReason` (and the row-3/row-3b `CAUSE_NOT_DETERMINABLE` disambiguation, DESIGN-3B
 * §5.4) into the approved L1 copy. Both `lib/server/analysis/performance/judgement.ts` (server)
 * and the analyses table row (client) import from here — never a second copy that can drift
 * (judgement.ts's own header: "exactly one home, never two competing renderers").
 *
 * No fallback branch exists anywhere in this module: every case is explicit, and
 * `null`/unmapped propagates as `null`, never silently becomes another row's sentence
 * (DESIGN-3B §5.2 — there is no fallback string).
 */

export type UnavailableReason =
  | "REACH_HIDDEN"
  | "REACH_UNKNOWN"
  | "CONTENT_KIND_UNSUPPORTED"
  | "REACH_NOT_ON_FIRST_SLIDE"
  | "NO_AUDIENCE_DATA"
  | "INSUFFICIENT_HISTORY"
  | "CAUSE_NOT_DETERMINABLE";

/**
 * The four-state availability model (PRD §4.4 / TDD §5.4) as it applies to the two engagement
 * numerator components read by the row-3/row-3b matrix below.
 */
export type UsabilityAvailabilityState = "AVAILABLE" | "HIDDEN" | "UNKNOWN" | "ZERO";

/** Exhaustiveness helper — mirrors `lib/server/analysis/performance/types.ts`'s `assertNever`. */
function assertNever(value: never): never {
  throw new Error(`assertNever: unreachable case reached with value ${JSON.stringify(value)}`);
}

/**
 * Ticket #144 — the full seven-member `UnavailableReason` L1 (in-cell) short-form renderer.
 * The copy is not invented here — five of the seven strings are DESIGN-3B §5's exact L1 cells
 * (rows 1/2/3/4) or TDD §3.1's exact plain-language sentences (`CONTENT_KIND_UNSUPPORTED`,
 * `REACH_NOT_ON_FIRST_SLIDE`).
 *
 * Two deliberate `null` returns, neither of which fabricates copy:
 *
 * - `INSUFFICIENT_HISTORY` — declared on `UnavailableReason` but intentionally never produced
 *   server-side (TDD §5.3). No approved copy exists for it, so this returns `null` rather than
 *   fabricating a string. A caller reaching this branch should treat it as unreachable in
 *   production and flag it, not display a substitute sentence.
 * - The exhaustive `switch` has no `default` fallback — `assertNever` guarantees at the type
 *   level that no case can silently degrade to another row's copy.
 *
 * `REACH_NOT_ON_FIRST_SLIDE` returns TDD §3.1's own context-free framing sentence — a caller
 * that also has the actual later-slide figure (R-N1) composes the two; this function does not
 * synthesize a fake specific number, and it must never be special-cased to another row's copy.
 */
export type UnavailableReasonShortForm =
  | "Creator hid the counts"
  | "No view count published"
  | "No performance data published"
  | "No follower count available"
  | "This post type doesn't report view counts."
  | "Views are reported on later slides of this carousel, but the score reads the first slide only."
  | null;

export function renderUnavailableReasonShortForm(reason: UnavailableReason): UnavailableReasonShortForm {
  switch (reason) {
    case "REACH_HIDDEN":
      return "Creator hid the counts";
    case "REACH_UNKNOWN":
      return "No view count published";
    case "CAUSE_NOT_DETERMINABLE":
      return "No performance data published";
    case "NO_AUDIENCE_DATA":
      return "No follower count available";
    case "CONTENT_KIND_UNSUPPORTED":
      return "This post type doesn't report view counts.";
    case "REACH_NOT_ON_FIRST_SLIDE":
      return "Views are reported on later slides of this carousel, but the score reads the first slide only.";
    case "INSUFFICIENT_HISTORY":
      return null;
    default:
      return assertNever(reason);
  }
}

/** `true` for the two states usable as a performance input — UNKNOWN/HIDDEN are not (R-4.3.1). */
function isUsableAvailability(state: UsabilityAvailabilityState): boolean {
  return state === "AVAILABLE" || state === "ZERO";
}

/**
 * DESIGN-3B §5.4 — `CAUSE_NOT_DETERMINABLE` is reached by two different routes (row 3 vs
 * row 3b) that must not share one sentence (R-13.5.3a). "Usable" means `AVAILABLE` or `ZERO`;
 * `UNKNOWN`/`HIDDEN` are not usable.
 *
 * Row 3b (`"Engagement data incomplete"`) — follower count known AND exactly one of
 * like/comment usable (§5.4 table, row 2). Everything else that resolves to
 * `CAUSE_NOT_DETERMINABLE` reads as row 3 (`"No performance data published"`).
 */
export function renderCauseNotDeterminableCopy(params: {
  followerKnown: boolean;
  likeState: UsabilityAvailabilityState;
  commentState: UsabilityAvailabilityState;
}): string {
  const likeUsable = isUsableAvailability(params.likeState);
  const commentUsable = isUsableAvailability(params.commentState);
  const exactlyOneUsable = likeUsable !== commentUsable;

  if (params.followerKnown && exactlyOneUsable) {
    return "Engagement data incomplete";
  }

  return "No performance data published";
}

/**
 * The single entry point callers use for an absent-score reason: routes `CAUSE_NOT_DETERMINABLE`
 * through the row-3/row-3b matrix above and every other reason through
 * `renderUnavailableReasonShortForm` unchanged — no reason is special-cased to another row's
 * copy. `null` in, `null` out (DESIGN-3B §5.2 — no fallback string); callers decide their own
 * honest placeholder for the `null` case, never a fabricated sentence.
 */
export function resolveUnavailableReasonCopy(params: {
  unavailableReason: UnavailableReason | null;
  followerKnown: boolean;
  likeState: UsabilityAvailabilityState;
  commentState: UsabilityAvailabilityState;
}): string | null {
  if (params.unavailableReason == null) {
    return null;
  }
  if (params.unavailableReason === "CAUSE_NOT_DETERMINABLE") {
    return renderCauseNotDeterminableCopy(params);
  }
  return renderUnavailableReasonShortForm(params.unavailableReason);
}
