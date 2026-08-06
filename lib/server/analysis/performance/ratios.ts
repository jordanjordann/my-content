/**
 * Tier 1 / Tier 3 arithmetic (TDD §2 module placement).
 *
 * `computeEngagementRate` is RELOCATED here from
 * `lib/server/profiles/helpers.ts` by ticket #139 (OR-12) — it is not new
 * code and its arithmetic is unchanged. The correction is what it returns:
 * previously a bare `number | null` that the prompt builder rendered under
 * the unqualified label "Engagement rate" on every content type (a live
 * R-12.3.1 violation, TDD §1.1). It now returns a denominator-tagged
 * result so a caller cannot drop the "this is follower-denominated, not
 * reach-denominated" fact even by accident (R-12.2.2) — the discriminant
 * is a real, single-member union today and grows a `REACH` counterpart
 * (`{ denominator: "REACH"; ratio: number; reachKind }`) in 3B-2, at which
 * point `Tier1Ratio` becomes the full discriminated union documented in
 * TDD §7.
 *
 * Not wired into the pipeline by this ticket — #139 only relocates and
 * retypes the primitive. It becomes an input to `judgement.ts`/
 * `computeBlock.ts` in 3B-5.
 */

export interface FollowerDenominatedRatio {
  denominator: "FOLLOWERS";
  ratio: number;
}

/**
 * (likes + comments) / followers, as a fraction (e.g. 0.0432), never a
 * percentage — formatting is a presentation concern per AGENTS.md.
 *
 * Returns null when followerCount is null or 0. Never divides by zero,
 * never coerces an unknown follower count to 0 — a real 0% engagement rate
 * and "we don't know the follower count" are different facts.
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

  const likes = likeCount ?? 0;
  const comments = commentCount ?? 0;

  return { denominator: "FOLLOWERS", ratio: (likes + comments) / followerCount };
}
