import type { AvailabilityState, CountAvailabilityResult } from "./types";

/**
 * Availability resolution for likes/comments (TDD §3a / §5.4, ticket #140
 * step 3). The four-state model (PRD §4.4): `AVAILABLE` / `HIDDEN` /
 * `UNKNOWN` / `ZERO`.
 *
 * ## The `-1` sentinel (owner ruling OR-20, TDD §1.7) — binding, not a footnote
 *
 * V1 (`.claude/context/fixtures/scrapecreators-instagram/ig_post_counts_disabled.json`)
 * proved that on a genuinely counts-disabled Instagram post,
 * `edge_media_preview_like.count` is `-1` — present, populated, and
 * actively wrong — with `edges[]` still carrying real usernames. Three
 * binding rules, both enforced here independently of each other:
 *
 * 1. **Never read the count before checking `like_and_view_counts_disabled`.**
 *    `resolveInstagramLikeAvailability()` below checks the flag and
 *    returns before the count field is ever dereferenced when the flag is
 *    `true`.
 * 2. **An explicit negative guard, independent of rule 1.** Any count `< 0`
 *    resolves to `UNKNOWN` — enforced even when the flag is `false` or
 *    absent, so a future contributor forgetting rule 1 (or a payload where
 *    the flag itself is missing/stripped) still cannot produce a negative
 *    ratio.
 * 3. **Never clamp.** No `Math.max(x, 0)`, no `?? 0`. An unusable count
 *    becomes `{ state: "UNKNOWN", value: null }`, never a number.
 *
 * Comments are NOT gated by `like_and_view_counts_disabled` — V1 confirms
 * `edge_media_to_parent_comment.count: 1` survives un-nulled on the same
 * counts-disabled fixture. `resolveInstagramCommentAvailability()` therefore
 * never reads the disabled flag at all, but keeps the same independent
 * negative guard (rule 2 is universal: "any count < 0 from any source").
 */

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Shared terminal step once a raw count has been extracted: never negative, never clamped. */
function resolveFromCount(rawCount: unknown): CountAvailabilityResult {
  const count = toFiniteNumber(rawCount);

  if (count === null) {
    return { value: null, state: "UNKNOWN" };
  }
  // Rule 2 — the negative guard. Independent of any flag check; fires even
  // if this function is ever called without one (e.g. comments, or a
  // caller that forgot rule 1).
  if (count < 0) {
    return { value: null, state: "UNKNOWN" };
  }
  if (count === 0) {
    return { value: 0, state: "ZERO" };
  }
  return { value: count, state: "AVAILABLE" };
}

/**
 * `like_and_view_counts_disabled` is read `=== true` STRICTLY — absent is
 * NOT `false` (AC-19). `fetcher/adapter.ts:236` already does this
 * correctly; this must not regress it.
 */
export function resolveInstagramLikeAvailability(params: {
  rawCount: unknown;
  likeAndViewCountsDisabled: unknown;
}): CountAvailabilityResult {
  // Rule 1 — the flag is checked FIRST, and the count is not read at all
  // on this branch. `=== true` strict: absent/false/anything-else falls
  // through to the count-based resolution below.
  if (params.likeAndViewCountsDisabled === true) {
    return { value: null, state: "HIDDEN" };
  }

  return resolveFromCount(params.rawCount);
}

/** Comments are unaffected by `like_and_view_counts_disabled` (V1) — never widen this guard to comments. */
export function resolveInstagramCommentAvailability(rawCount: unknown): CountAvailabilityResult {
  return resolveFromCount(rawCount);
}

/**
 * YouTube `likeCountInt` — OR-21, the conservative rule, FINAL (not a
 * placeholder waiting on V2, which was checkpointed at 0 credits spent and
 * closed by owner ruling rather than blocked on). `0`, `null` and
 * field-absent ALL resolve to `UNKNOWN`. Never `ZERO`, never a fabricated
 * score. Accepted cost, stated so nobody "fixes" it: a genuinely
 * zero-like video reads "unknown".
 */
export function resolveYoutubeLikeAvailability(likeCountInt: unknown): CountAvailabilityResult {
  const count = toFiniteNumber(likeCountInt);

  if (count === null || count === 0) {
    return { value: null, state: "UNKNOWN" };
  }
  if (count < 0) {
    return { value: null, state: "UNKNOWN" };
  }

  return { value: count, state: "AVAILABLE" };
}

/**
 * YouTube `commentCountInt` — not subject to OR-21 (that ruling is
 * `likeCountInt`-specific), but still carries the universal negative guard
 * (rule 2) and treats absence/non-finite as `UNKNOWN` rather than a
 * fabricated `0`, consistent with every other resolver in this module.
 */
export function resolveYoutubeCommentAvailability(commentCountInt: unknown): CountAvailabilityResult {
  return resolveFromCount(commentCountInt);
}

/** Re-exported for callers that already have a resolved `AvailabilityState` and just need the type. */
export type { AvailabilityState };
