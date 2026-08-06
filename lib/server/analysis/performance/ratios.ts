import type {
  FollowerDenominatedRatio,
  ReachDenominatedRatio,
  ReachKind,
  Tier1Ratio,
  Tier3Ratio,
} from "./types";

/**
 * Tier 1 / Tier 3 arithmetic (TDD §2 module placement, ticket #140 step 4).
 *
 * `computeEngagementRate` is RELOCATED here from
 * `lib/server/profiles/helpers.ts` by ticket #139 (OR-12) — it is not new
 * code and its arithmetic is unchanged. The correction is what it returns:
 * previously a bare `number | null` that the prompt builder rendered under
 * the unqualified label "Engagement rate" on every content type (a live
 * R-12.3.1 violation, TDD §1.1). It now returns a denominator-tagged
 * result so a caller cannot drop the "this is follower-denominated, not
 * reach-denominated" fact even by accident (R-12.2.2).
 *
 * Ticket #140 completes `Tier1Ratio` into the full discriminated union
 * (TDD §7) and adds the `REACH` counterpart plus Tier 3. Per R-12.3.5,
 * dropping the `denominator` discriminator on construction is a `tsc`
 * failure, not a silent presentation bug — see `ratios.test.ts`'s
 * `@ts-expect-error` case. Precedent: PR #122's type-level guard on the
 * fingerprint client.
 *
 * Both ratio functions apply the same OR-20 negative-count discipline as
 * `availability.ts`: a negative `likeCount`/`commentCount` is never
 * subtracted, never propagated — it is treated identically to an absent
 * count (contributes nothing to the sum), so no ratio function in this
 * module can ever return a negative value from a negative input. This is
 * a defence-in-depth measure — in the real pipeline, `likeCount`/
 * `commentCount` reach this module only after passing through
 * `availability.ts`'s resolvers, which already turn a negative sentinel
 * into `null` before it gets anywhere near arithmetic.
 *
 * Not wired into the pipeline by this ticket — these are pure primitives.
 * `judgement.ts`/`computeBlock.ts` (3B-5) call them only when the
 * corresponding input's availability state is `AVAILABLE`/`ZERO`.
 */

/** Treats an absent OR negative count identically — never fabricates a value, never propagates a negative. */
function usableCount(value: number | null | undefined): number {
  if (value == null || value < 0) {
    return 0;
  }
  return value;
}

/**
 * (likes + comments) / followers, as a fraction (e.g. 0.0432), never a
 * percentage — formatting is a presentation concern per AGENTS.md.
 *
 * Returns null when followerCount is null or 0 (R-12.2.4 — no substitute
 * denominator may be invented). Never divides by zero, never coerces an
 * unknown follower count to 0 — a real 0% engagement rate and "we don't
 * know the follower count" are different facts.
 */
export function computeEngagementRate({
  likeCount,
  commentCount,
  followerCount,
}: {
  likeCount: number | null | undefined;
  commentCount: number | null | undefined;
  followerCount: number | null | undefined;
}): FollowerDenominatedRatio | null {
  if (followerCount == null || followerCount === 0) {
    return null;
  }

  const likes = usableCount(likeCount);
  const comments = usableCount(commentCount);

  return { denominator: "FOLLOWERS", ratio: (likes + comments) / followerCount };
}

/**
 * (likes + comments) / reach, as a fraction. `reachValue` must already be a
 * resolved `AVAILABLE`/`ZERO` reach figure (i.e. state-checked upstream by
 * `reach.ts`) — this function does not itself accept a `ReachResult` and
 * does not re-derive availability; it is pure arithmetic over an already-
 * trusted number, mirroring `computeEngagementRate`'s contract.
 *
 * Returns `null` when `reachValue` is null/non-positive, or when
 * `reachKind` is `null`/`"UNKNOWN"` — R-4.3.2: a ratio may only be computed
 * against a reach value we actually trust the kind of. `reachValue: 0`
 * (a corroborated genuine zero) is deliberately excluded too: dividing by
 * zero reach is undefined, not "0% engagement", and PRD §4.4's `ZERO`
 * state for reach is vanishingly rare precisely because it is this
 * unusable as a denominator.
 */
export function computeReachEngagementRatio({
  likeCount,
  commentCount,
  reachValue,
  reachKind,
}: {
  likeCount: number | null | undefined;
  commentCount: number | null | undefined;
  reachValue: number | null | undefined;
  reachKind: ReachKind | null | undefined;
}): ReachDenominatedRatio | null {
  if (reachValue == null || reachValue <= 0) {
    return null;
  }
  if (reachKind == null || reachKind === "UNKNOWN") {
    return null;
  }

  const likes = usableCount(likeCount);
  const comments = usableCount(commentCount);

  return { denominator: "REACH", ratio: (likes + comments) / reachValue, reachKind };
}

/**
 * Tier 3 (PRD §5.1 / TDD §7): reach / followers. Not denominator-tagged —
 * this ratio is always follower-denominated by construction, so
 * `Tier3Ratio` has no discriminant to drop. Same non-substitution
 * discipline as Tier 1: both inputs must be genuinely present and
 * positive, or the result is `null`, never a fabricated figure.
 */
export function computeReachPerFollower({
  reachValue,
  followerCount,
}: {
  reachValue: number | null | undefined;
  followerCount: number | null | undefined;
}): Tier3Ratio | null {
  if (reachValue == null || reachValue < 0) {
    return null;
  }
  if (followerCount == null || followerCount <= 0) {
    return null;
  }

  return { reachPerFollower: reachValue / followerCount };
}

export type { FollowerDenominatedRatio, ReachDenominatedRatio, Tier1Ratio, Tier3Ratio };
