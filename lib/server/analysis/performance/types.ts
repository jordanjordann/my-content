/**
 * Types for the performance module (TDD §2 module placement, §6 type
 * unions). This ticket (#140) only needs the subset that `reach.ts`,
 * `availability.ts` and `ratios.ts` produce/consume — `Tier`, `Confidence`,
 * `UnavailableReason` and the full `ComputedPerformanceBlock` belong to
 * `judgement.ts`/`computeBlock.ts` (3B-5, out of scope here) and are not
 * declared prematurely.
 */

/**
 * R-4.3.1: every stored/displayed reach value carries a kind, and the UI
 * and Gemini prose must use the matching word — a play count must never
 * be labelled "Views". `null` (not a member of this union) is reserved for
 * "no reach field exists at all" (`derivedFrom: "NONE"`) — a fundamentally
 * different fact from "we read a field but couldn't trust its value"
 * (`kind: "UNKNOWN"`).
 */
export type ReachKind = "PLAYS" | "VIEWS" | "UNKNOWN";

/**
 * What `resolveReach()` derived the post-level reach figure from (TDD §3 /
 * §5.2). Read by the confidence ladder (judgement.ts, out of scope here) —
 * `CAROUSEL_FIRST_SLIDE` costs a confidence demotion (D4).
 */
export type ReachDerivedFrom = "TOP_LEVEL" | "CAROUSEL_FIRST_SLIDE" | "NONE";

/**
 * The four-state availability model (PRD §4.4 / TDD §5.4), shared by reach,
 * likes and comments. `ZERO` is only ever assertable when a field is
 * explicitly present as 0 AND uncontradicted by a sibling field AND the
 * disabled flag (where one exists) is confirmed false — never inferred
 * from absence.
 */
export type AvailabilityState = "AVAILABLE" | "HIDDEN" | "UNKNOWN" | "ZERO";

/** Result of `resolveReach()` / `resolveInstagramReach()` / `resolveYoutubeReach()`. */
export interface ReachResult {
  /** Never negative. `null` whenever `state !== "AVAILABLE" && state !== "ZERO"`. */
  value: number | null;
  /** `null` only when `derivedFrom === "NONE"` — no reach field exists at all. */
  kind: ReachKind | null;
  state: AvailabilityState;
  derivedFrom: ReachDerivedFrom;
  /**
   * OR-26 / ticket #155. Carousel only. `true` when slide 0 carries neither
   * reach key but some later slide does — the post has reach data that D4's
   * first-slide rule did not consult. Always `false` on every non-carousel
   * and every YouTube path. Consumed by ticket #143 to pick
   * `REACH_NOT_ON_FIRST_SLIDE` over `CONTENT_KIND_UNSUPPORTED` on
   * `perf_unavailable_reason` — this field does not itself change
   * `derivedFrom`, which stays `"NONE"` either way.
   */
  someSlideHasReach: boolean;
}

/** Result of a count-availability resolver (`availability.ts`). */
export interface CountAvailabilityResult {
  /** Never negative. `null` whenever `state !== "AVAILABLE" && state !== "ZERO"`. */
  value: number | null;
  state: AvailabilityState;
}

/** R-12.2.2 / R-12.2.5: the denominator a Tier 1 ratio is expressed against. */
export type Denominator = "REACH" | "FOLLOWERS";

/**
 * R-12.3.5: a discriminated union, not an object with an optional
 * `denominator` string — dropping the discriminator on construction is a
 * `tsc` failure, not a silent presentation bug. Precedent: PR #122's
 * type-level guard on the fingerprint client.
 */
export type Tier1Ratio =
  | { denominator: "REACH"; ratio: number; reachKind: ReachKind }
  | { denominator: "FOLLOWERS"; ratio: number };

export type ReachDenominatedRatio = Extract<Tier1Ratio, { denominator: "REACH" }>;
export type FollowerDenominatedRatio = Extract<Tier1Ratio, { denominator: "FOLLOWERS" }>;

/** Tier 3 (PRD §5.1 / TDD §7) — always follower-denominated by construction, so no discriminant is needed. */
export interface Tier3Ratio {
  reachPerFollower: number;
}
