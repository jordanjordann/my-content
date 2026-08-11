import { MATURITY_FLOOR_HOURS, BASELINE_MIN_SAMPLE } from "./constants";
import {
  renderUnavailableReasonShortForm,
  type UnavailableReasonShortForm,
} from "@/lib/analysis/performance/render";
import type {
  AvailabilityState,
  BaselineResult,
  Confidence,
  ConfidenceReason,
  ReachDerivedFrom,
  ReachResult,
  Tier,
  Tier1Ratio,
  Tier3Ratio,
  UnavailableReason,
} from "./types";

/**
 * Ticket #143 (TDD §2's module map, TDD §4, PRD §5.1/§5.2 OR-13) — the full
 * judgement module: `tierUsed`, `confidence` (+ its demotion reason),
 * `basedOnVideos`, `provisional`, and the full seven-member
 * `unavailableReason` enum.
 *
 * `resolveHiddenCountsUnavailableReason` below is #169's — kept as-is, not
 * re-derived (TDD §4's "unavailableReason has TWO origins" subsection: #143
 * IMPORTS this slice rather than reimplementing it).
 *
 * `renderUnavailableReasonShortForm` (below) is ticket #144's — it REPLACES
 * #169's `renderHiddenCountsReasonShortForm` (PR #179 review / the #144
 * scope note folded onto this ticket): that function only covered two of
 * the seven `UnavailableReason` members (DESIGN-3B §5 rows 1 and 3).
 * #144 owns the FULL seven-member renderer so the canonical L1 copy has
 * exactly one home, never two competing renderers drifting out of sync.
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
 * Ticket #144 — the full seven-member `UnavailableReason` L1 (in-cell)
 * short-form renderer, typed as a literal-string union (not `string`) per
 * the PR #179 review's explicit ask: *"it costs nothing and makes a future
 * edit to the copy visible at every call site."* **The copy is not
 * invented here** — five of the seven strings are DESIGN-3B §5's exact L1
 * cells (rows 1/2/3/4) or TDD §3.1's exact plain-language sentences
 * (`CONTENT_KIND_UNSUPPORTED`, `REACH_NOT_ON_FIRST_SLIDE`).
 *
 * Two deliberate exceptions, neither of which fabricates copy:
 *
 * - `REACH_NOT_ON_FIRST_SLIDE` — R-N1 (DESIGN-3C §5.4) requires the actual
 *   later-slide figure and its kind to accompany this state ("a later
 *   slide reports 0 views"); that figure is not part of the enum this
 *   function receives, so what's returned here is TDD §3.1's own
 *   context-free framing sentence, not DESIGN-3C's per-row cell copy. A
 *   caller that has the figure (e.g. a future L1 cell renderer) composes
 *   the two; this function does not synthesize a fake specific number.
 * - `INSUFFICIENT_HISTORY` — declared on `UnavailableReason` but
 *   intentionally never produced by `resolveUnavailableReason` (TDD §5.3,
 *   PR #191 review, Leo's note). No DESIGN-3B/DESIGN-3C row exists for it
 *   and no scenario in the corpus reaches it, so there is no approved copy
 *   to render. Per the standing instruction to never invent user-facing
 *   copy, this returns `null` rather than a fabricated sentence — a caller
 *   reaching this branch should treat it as unreachable in production and
 *   flag it, not display it.
 *
 * An exhaustive `switch` over the closed seven-member union, with
 * `assertNever` on the impossible default branch, guarantees at the type
 * level that no two members can be silently mapped to the same string by
 * accident (AGENTS.md/owner preference: illegal states unrepresentable,
 * not a doc comment) — the same discipline #169's narrower version used
 * for its two rows, extended to all seven.
 *
 * The implementation itself now lives in the isomorphic `lib/analysis/performance/render.ts`
 * (ticket #145's PR #198 review) — this module re-exports it rather than keeping a second copy,
 * so the client (the analyses table row) and the server import the exact same function instead
 * of two renderers that can drift apart.
 */
export type { UnavailableReasonShortForm };
export { renderUnavailableReasonShortForm };

/** `true` for the two states a numerator/denominator input can actually contribute — R-4.3.1's corroborated zero counts (AVAILABLE/ZERO), UNKNOWN/HIDDEN do not. */
function isUsable(state: AvailabilityState): boolean {
  return state === "AVAILABLE" || state === "ZERO";
}

/**
 * PR #191 review, blocker N1 — the single home for "is the engagement
 * numerator (likes + comments) trustworthy enough to compute a SUM from".
 * Before this fix, `computeBlock.ts`'s `resolveTier1Ratio` gated the same
 * question with `&&` (blocker B2's owner-ruled fix: a partial sum dressed
 * up as complete is a confident-looking wrong number) while this module
 * gated a DIFFERENT branch of the same question with `||` — two
 * independently-maintained copies of one predicate that had already
 * drifted (TR-1/TR-2's exact failure class). `computeBlock.ts` and
 * `judgement.ts` both import THIS function now; neither keeps its own
 * inline expression.
 *
 * `||` ("is there ANY usable numerator at all") is still a genuinely
 * different question — it answers "does this content expose literally
 * nothing to score" (`CONTENT_KIND_UNSUPPORTED`'s PRD §12.6 collapse case)
 * — and is kept as its own local check in `resolveUnavailableReason` below,
 * not folded into this function.
 */
export function hasComputableEngagementNumerator(params: {
  likeState: AvailabilityState;
  commentState: AvailabilityState;
}): boolean {
  return isUsable(params.likeState) && isUsable(params.commentState);
}

/**
 * `provisional` — PRD §4.5 point 2 / TDD §4: `post_age_hours < MATURITY_FLOOR_HOURS`.
 * `null` age (unresolvable `postDate`) is NOT treated as provisional — there
 * is no evidence the post is young, and asserting "early" without evidence
 * would itself be a confident-looking guess (reliability over coverage).
 */
export function computeProvisional(postAgeHours: number | null): boolean {
  if (postAgeHours == null) {
    return false;
  }
  return postAgeHours < MATURITY_FLOOR_HOURS;
}

/**
 * TDD §4 confidence ladder. Applied top-to-bottom, each rule overriding the
 * previous when it fires:
 *
 *   1. Start `HIGH`.
 *   2. `-1` (-> `MEDIUM`) when the reach came from a carousel's first slide
 *      (D4 — one slide, not the whole post, informed the number).
 *   3. Cap `MEDIUM` when the Tier 1 ratio (if any) is `FOLLOWERS`-denominated
 *      OR the tier actually used is `AUDIENCE_FALLBACK` (Tier 3) — both read
 *      against a cached follower count, never a same-capture measurement
 *      (R-12.2.5).
 *   4. `LOW` when a Tier 2 figure's own sample is thin. Under the current
 *      `BaselineResult` union `tierUsed === "CREATOR_BASELINE"` implies
 *      `sampleSize >= BASELINE_MIN_SAMPLE` by construction (`computeBaseline`
 *      only returns `MEASURED` above the threshold) — so this branch is
 *      defence-in-depth (the same posture `ratios.ts`/`baseline.ts` already
 *      take for facts that are "true by construction upstream, guarded again
 *      here anyway"), exercised directly by unit tests that pass a
 *      below-threshold sample size to this pure function.
 *   5. `NONE` when `tierUsed === "UNAVAILABLE"` — overrides everything above.
 *
 * PR #191 review, C1 — **ruling, recorded explicitly rather than left
 * implicit**: `confidenceReason` is a single `ConfidenceReason | null`, not
 * a set, so when TWO demotion causes both fire on the same post (reachable:
 * a carousel whose slide 0 has usable reach but no engagement numerator,
 * where `tierUsed` falls through to `AUDIENCE_FALLBACK` — rule 3 fires
 * because `tier1Ratio` never got the chance to be `FOLLOWERS`-denominated,
 * the ratio is simply `null` — AND rule 2 fires because
 * `reachDerivedFrom === "CAROUSEL_FIRST_SLIDE"`), the rules are applied
 * top-to-bottom and the LAST one to fire wins the stored `confidenceReason`
 * — rule 3 (`CACHED_FOLLOWER_DENOMINATOR`) overwrites rule 2
 * (`CAROUSEL_FIRST_SLIDE`) in that case. The confidence *value* (`MEDIUM`)
 * is correct either way; only the persisted *cause* is single-valued. This
 * is a deliberate simplification, not an oversight: `perf_confidence_reason`
 * (migration 012) is a single-valued `TEXT` column, and DESIGN-3B §4.3's L2
 * popover was scoped to one sentence, not a list — widening either is a
 * schema/copy change out of this ticket's scope. See
 * `judgement.test.ts`'s "double demotion" pin for the exact fixture.
 */
export function computeConfidence(params: {
  tierUsed: Tier;
  reachDerivedFrom: ReachDerivedFrom;
  tier1Ratio: Tier1Ratio | null;
  baselineSampleSize: number;
}): { confidence: Confidence; confidenceReason: ConfidenceReason | null } {
  if (params.tierUsed === "UNAVAILABLE") {
    return { confidence: "NONE", confidenceReason: null };
  }

  let confidence: Confidence = "HIGH";
  let confidenceReason: ConfidenceReason | null = null;

  if (params.reachDerivedFrom === "CAROUSEL_FIRST_SLIDE") {
    confidence = "MEDIUM";
    confidenceReason = "CAROUSEL_FIRST_SLIDE";
  }

  if (params.tier1Ratio?.denominator === "FOLLOWERS" || params.tierUsed === "AUDIENCE_FALLBACK") {
    confidence = "MEDIUM";
    confidenceReason = "CACHED_FOLLOWER_DENOMINATOR";
  }

  if (params.tierUsed === "CREATOR_BASELINE" && params.baselineSampleSize < BASELINE_MIN_SAMPLE) {
    confidence = "LOW";
    confidenceReason = "THIN_SAMPLE";
  }

  return { confidence, confidenceReason };
}

/**
 * OR-13 (PRD §3.3/§5.1, DESIGN-3B §3.1): which tier actually produced a
 * score. `CREATOR_BASELINE` (Tier 2) wins whenever it is `MEASURED` — it is
 * the headline per §3.5/§12.4. Otherwise `REACH_ONLY` (Tier 1 — reach- OR
 * follower-denominated, DESIGN-3B §3.1's table) whenever a Tier 1 ratio
 * exists. Otherwise `AUDIENCE_FALLBACK` (Tier 3) whenever reach ÷ followers
 * is computable. Otherwise `UNAVAILABLE`.
 */
export function determineTierUsed(params: {
  baseline: BaselineResult;
  tier1Ratio: Tier1Ratio | null;
  tier3Ratio: Tier3Ratio | null;
}): Tier {
  if (params.baseline.state === "MEASURED") {
    return "CREATOR_BASELINE";
  }
  if (params.tier1Ratio != null) {
    return "REACH_ONLY";
  }
  if (params.tier3Ratio != null) {
    return "AUDIENCE_FALLBACK";
  }
  return "UNAVAILABLE";
}

/**
 * TDD §4's "two origins" subsection, Path A — resolved here from the §5.4
 * availability states, the hidden-counts tri-state (§1.6) and content-kind
 * facts. Path B (`REACH_NOT_ON_FIRST_SLIDE`) is read from
 * `reach.laterSlideReach.usable` — never re-derived (binding on #143).
 *
 * Only called when `tierUsed === "UNAVAILABLE"` (a score was NOT produced);
 * callers must not call this otherwise, since every branch here assumes no
 * tier could be computed.
 *
 * Priority, in order:
 *
 * 1. **YouTube** (PR #191 review, C2 — checked BEFORE #169's resolver, not
 *    after). `like_and_view_counts_disabled` is an Instagram-only concept:
 *    on YouTube the flag param is always `undefined` (structurally absent,
 *    never confirmed `true` or `false`), which is NOT epistemic uncertainty
 *    about a hidden-counts SETTING — that setting does not exist on this
 *    platform. Calling `resolveHiddenCountsUnavailableReason` first (the
 *    pre-C2 order) read "flag absent + nothing usable" as
 *    `CAUSE_NOT_DETERMINABLE` for a YouTube video whose reach genuinely
 *    never came back — the truthful reason is `REACH_UNKNOWN`, not "we
 *    can't tell if this creator hid their counts" (a fact that cannot even
 *    apply to this platform). Never `CONTENT_KIND_UNSUPPORTED` or
 *    `REACH_NOT_ON_FIRST_SLIDE` either (both carousel/Instagram-only, TDD
 *    §5.3 binding rule) — an unusable reach is always `REACH_UNKNOWN`, a
 *    usable one with no audience data is always `NO_AUDIENCE_DATA`.
 * 2. **#169's two rows** (`REACH_HIDDEN` / `CAUSE_NOT_DETERMINABLE`), via
 *    `resolveHiddenCountsUnavailableReason` — imported, not re-derived.
 *    Instagram only, by construction now that YouTube returns above.
 * 3. **Instagram, no reach field at all** (`derivedFrom === "NONE"`):
 *      a. a later slide carries a usable count (`laterSlideReach.usable`)
 *         -> `REACH_NOT_ON_FIRST_SLIDE` (Path B mapping, OR-26).
 *      b. no usable engagement numerator at all (likes AND comments both
 *         unusable) -> `CONTENT_KIND_UNSUPPORTED` (PRD §12.6's collapse
 *         case — content genuinely exposes nothing to score). **This is
 *         also the AC-30 fix's Instagram branch**: a CONFIRMED-`false`
 *         hidden-counts flag with no usable inputs used to fall through
 *         `resolveHiddenCountsUnavailableReason` as `null` (the PR #179/#184
 *         fold-in's "AC-30 hole") — it now lands here instead of falling
 *         off the end of this function.
 *      c. a numerator exists but no follower count -> `NO_AUDIENCE_DATA`
 *         (R-12.2.4).
 *      d. a numerator exists AND a follower count exists (PR #191 review,
 *         N1) -> `CAUSE_NOT_DETERMINABLE`. The only way `UNAVAILABLE` is
 *         reached with both present is `computeBlock.ts`'s
 *         `resolveTier1Ratio` rejecting a PARTIAL numerator via the shared
 *         `hasComputableEngagementNumerator` gate (one of like/comment
 *         usable, not both) — owner-ruled: this is an epistemic gap, not a
 *         missing-audience-data one, so it must not share
 *         `NO_AUDIENCE_DATA`'s enum value (R-13.5.3a).
 * 4. **Instagram, reach field exists but is unusable**
 *    (`derivedFrom !== "NONE"`, state not `AVAILABLE`/`ZERO`) ->
 *    `REACH_UNKNOWN`. This is the AC-30 fix's video-content branch — the
 *    PR #179 fold-in flagged this exact state (confirmed-`false` flag, no
 *    usable inputs, on a reel/video-bearing carousel) as reachable in
 *    production and previously unreasoned.
 * 5. **Reach usable, but neither Tier 1 nor Tier 3 could be built** — the
 *    only way to reach `UNAVAILABLE` from here is a missing follower count
 *    (Tier 3 needs no likes/comments at all, so if followers existed, Tier 3
 *    would have fired) -> `NO_AUDIENCE_DATA`.
 * 6. **Defensive catch-all** — should not be reachable given 1-5 are
 *    exhaustive over the inputs this function receives, but a reason must
 *    never be `null` here (that is exactly the blank-cell AC-30 forbids), so
 *    this falls back to `CAUSE_NOT_DETERMINABLE` rather than returning
 *    `null`.
 *
 * `INSUFFICIENT_HISTORY` is declared on `UnavailableReason` (TDD §5.3) but
 * is deliberately NOT produced by this function. Per PRD §12.4/§14.2 and
 * DESIGN-3B §5 row 5, a Tier 2 cold start is an explicit NON-`unavailable`
 * partial-absence state (R-C4: "not an unavailable reason and does not
 * suppress the Performance cell") — Tier 1/Tier 3 still render if available.
 * No documented scenario in the PRD/TDD/DESIGN-3B corpus reaches
 * `tierUsed === "UNAVAILABLE"` for a reason distinct from the six above;
 * inventing a trigger condition for `INSUFFICIENT_HISTORY` would risk
 * asserting a cause this module cannot evidence (the exact failure class
 * `CAUSE_NOT_DETERMINABLE` exists to avoid) — reliability over coverage.
 */
export function resolveUnavailableReason(params: {
  platform: "instagram" | "youtube";
  reach: ReachResult;
  likeAndViewCountsDisabled: boolean | null | undefined;
  likeState: AvailabilityState;
  commentState: AvailabilityState;
  followerCount: number | null;
}): UnavailableReason {
  const reachUsable = isUsable(params.reach.state);
  // "ANY usable numerator at all" — a different question from the shared
  // `hasComputableEngagementNumerator` gate below (see that function's doc):
  // this one only decides the true collapse case, `CONTENT_KIND_UNSUPPORTED`.
  const hasAnyUsableNumerator = isUsable(params.likeState) || isUsable(params.commentState);
  const hasComputableNumerator = hasComputableEngagementNumerator({
    likeState: params.likeState,
    commentState: params.commentState,
  });
  const hasFollowerCount = params.followerCount != null && params.followerCount > 0;

  // C2 (PR #191 review): checked BEFORE `resolveHiddenCountsUnavailableReason`
  // — `like_and_view_counts_disabled` is an Instagram-only concept, so on
  // YouTube the flag is always structurally absent (never a real epistemic
  // "we don't know if it's hidden" fact) and must never route through
  // #169's `CAUSE_NOT_DETERMINABLE`/`REACH_HIDDEN` rows.
  if (params.platform === "youtube") {
    if (!reachUsable) {
      return "REACH_UNKNOWN";
    }
    // Reach IS usable on YouTube here; the only way UNAVAILABLE was reached
    // is a missing audience count (Tier 3 needs no likes/comments).
    return "NO_AUDIENCE_DATA";
  }

  const hidden = resolveHiddenCountsUnavailableReason({
    likeAndViewCountsDisabled: params.likeAndViewCountsDisabled,
    reachState: params.reach.state,
    likeState: params.likeState,
    commentState: params.commentState,
  });
  if (hidden != null) {
    return hidden;
  }

  if (params.reach.derivedFrom === "NONE") {
    if (params.reach.laterSlideReach.usable) {
      return "REACH_NOT_ON_FIRST_SLIDE";
    }
    if (!hasAnyUsableNumerator) {
      return "CONTENT_KIND_UNSUPPORTED";
    }
    if (!hasFollowerCount) {
      return "NO_AUDIENCE_DATA";
    }
    if (!hasComputableNumerator) {
      // PR #191 review, N1 (owner ruling): a numerator component IS usable
      // and a follower count IS known, but the shared
      // `hasComputableEngagementNumerator` gate (the same one
      // `computeBlock.ts`'s `resolveTier1Ratio` uses) rejected this
      // PARTIAL numerator — one of like/comment usable, not both (B2's
      // reliability-over-coverage rule forbids summing a partial numerator
      // and calling it complete). We genuinely cannot determine engagement
      // here; asserting "no follower count" would be false (one exists) —
      // exactly the confident-wrong-fact class `CAUSE_NOT_DETERMINABLE`
      // exists to name instead (R-13.5.3a).
      return "CAUSE_NOT_DETERMINABLE";
    }
    // Both numerator components usable AND a follower count exists —
    // `resolveTier1Ratio` would already have produced a `FOLLOWERS`-
    // denominated Tier 1 ratio, so `tierUsed` could not be `UNAVAILABLE`
    // here. Defensive catch-all only, not a documented scenario — same
    // posture as item 6's catch-all below, mapped to the same truthful
    // reason rather than a thrown assertion.
    return "CAUSE_NOT_DETERMINABLE";
  }

  if (!reachUsable) {
    return "REACH_UNKNOWN";
  }

  if (!hasFollowerCount) {
    return "NO_AUDIENCE_DATA";
  }

  return "CAUSE_NOT_DETERMINABLE";
}

/**
 * Orchestrator TDD §4/§5.1 name for this module's output — `computeBlock.ts`
 * calls this once it has resolved reach, availability, the Tier 1/2/3
 * figures and the bucket/baseline. Pure function: every DB/network call
 * (the baseline read) has already happened by the time this runs.
 */
export function computeJudgement(params: {
  platform: "instagram" | "youtube";
  reach: ReachResult;
  likeAndViewCountsDisabled: boolean | null | undefined;
  likeState: AvailabilityState;
  commentState: AvailabilityState;
  followerCount: number | null;
  tier1Ratio: Tier1Ratio | null;
  tier3Ratio: Tier3Ratio | null;
  baseline: BaselineResult;
  postAgeHours: number | null;
}): {
  tierUsed: Tier;
  confidence: Confidence;
  confidenceReason: ConfidenceReason | null;
  basedOnVideos: number;
  provisional: boolean;
  unavailableReason: UnavailableReason | null;
} {
  const tierUsed = determineTierUsed({
    baseline: params.baseline,
    tier1Ratio: params.tier1Ratio,
    tier3Ratio: params.tier3Ratio,
  });

  const { confidence, confidenceReason } = computeConfidence({
    tierUsed,
    reachDerivedFrom: params.reach.derivedFrom,
    tier1Ratio: params.tier1Ratio,
    baselineSampleSize: params.baseline.sampleSize,
  });

  const unavailableReason =
    tierUsed === "UNAVAILABLE"
      ? resolveUnavailableReason({
          platform: params.platform,
          reach: params.reach,
          likeAndViewCountsDisabled: params.likeAndViewCountsDisabled,
          likeState: params.likeState,
          commentState: params.commentState,
          followerCount: params.followerCount,
        })
      : null;

  return {
    tierUsed,
    confidence,
    confidenceReason,
    basedOnVideos: params.baseline.sampleSize,
    provisional: computeProvisional(params.postAgeHours),
    unavailableReason,
  };
}
